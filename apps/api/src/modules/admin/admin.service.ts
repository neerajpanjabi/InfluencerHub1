import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { mergeGradingConfig, DEFAULT_GRADING_CONFIG, type GradingConfig } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService, AuditContext } from '../../common/services/audit.service';
import { SettingsService } from '../../common/services/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GradingService } from '../grading/grading.service';
import { QueueService, QUEUES } from '../queue/queue.service';
import { SocialService } from '../social/social.service';
import { PaymentsService } from '../payments/payments.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly grading: GradingService,
    private readonly queue: QueueService,
    private readonly social: SocialService,
    private readonly payments: PaymentsService,
    private readonly campaigns: CampaignsService,
    private readonly finance: FinanceService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────
  async dashboard() {
    const p = this.prisma;
    const [users, influencers, businesses, verifiedInf, activeCampaigns, completedOrders, pendingVerifications, openDisputes, gbv, ledger, refunds, integrations, failedSyncs] = await Promise.all([
      p.user.count({ where: { status: { not: 'DELETED' } } }),
      p.influencerProfile.count({ where: { deletedAt: null } }),
      p.businessProfile.count({ where: { deletedAt: null } }),
      p.influencerProfile.count({ where: { identityStatus: 'VERIFIED' } }),
      p.campaign.count({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'CONTENT_SUBMITTED', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED'] } } }),
      p.order.count({ where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } }),
      p.verificationRecord.count({ where: { status: 'PENDING' } }),
      p.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      p.order.aggregate({ where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } }, _sum: { subtotal: true, discountTotal: true } }),
      p.$queryRaw<Array<{ account: string; direction: string; total: Prisma.Decimal }>>`SELECT account, direction, SUM(amount) AS total FROM financial_ledger WHERE account IN ('PLATFORM_COMMISSION_REVENUE','PLATFORM_CONTACT_FEE_REVENUE','REFUNDS') GROUP BY 1, 2`,
      p.refund.count({ where: { status: { in: ['REQUESTED', 'PROCESSING'] } } }),
      p.integrationConfig.findMany({ select: { provider: true, status: true, mode: true, isEnabled: true, lastCheckedAt: true, lastError: true } }),
      p.socialSyncLog.count({ where: { status: 'FAILED', startedAt: { gt: new Date(Date.now() - 86_400_000) } } }),
    ]);
    const sumAcc = (acc: string) => ledger.filter((l) => l.account === acc).reduce((a, l) => a + Number(l.total) * (l.direction === 'CREDIT' ? 1 : -1), 0);
    return {
      users,
      influencers,
      businesses,
      verifiedInfluencers: verifiedInf,
      activeCampaigns,
      completedOrders,
      grossBookingValue: (Number(gbv._sum.subtotal ?? 0) - Number(gbv._sum.discountTotal ?? 0)).toFixed(2),
      commissionRevenue: sumAcc('PLATFORM_COMMISSION_REVENUE').toFixed(2),
      contactFeeRevenue: sumAcc('PLATFORM_CONTACT_FEE_REVENUE').toFixed(2),
      refundsTotal: sumAcc('REFUNDS').toFixed(2),
      pendingRefunds: refunds,
      pendingVerifications,
      openDisputes,
      failedSyncs24h: failedSyncs,
      integrations,
      socialProviders: this.social.providerStatus(),
      paymentProviders: this.payments.providerStatus(),
    };
  }

  // ── Users ──────────────────────────────────────────────────────
  listUsers(q: { type?: string; status?: string; search?: string; page?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const where: Prisma.UserWhereInput = {
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.search
        ? { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { businessProfile: { businessName: { contains: q.search, mode: 'insensitive' } } }, { influencerProfile: { displayName: { contains: q.search, mode: 'insensitive' } } }] }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true, email: true, type: true, status: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true, twoFactorEnabled: true,
          roles: { select: { role: { select: { key: true } } } },
          businessProfile: { select: { id: true, businessName: true, verificationStatus: true, freeContactCredits: true } },
          influencerProfile: { select: { id: true, displayName: true, slug: true, identityStatus: true, currentGrade: true, isPublic: true, isFeatured: true } },
        },
      }),
    ]).then(([total, items]) => ({ total, items, page }));
  }

  async setUserStatus(ctx: AuditContext, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.id === ctx.actorId) throw new BadRequestException({ code: 'CANNOT_CHANGE_SELF' });
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === 'SUSPENDED') await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(ctx, 'admin.user.status', 'User', userId, { status: u.status }, { status });
    return { ok: true };
  }

  async setAdminRoles(ctx: AuditContext, userId: string, roles: string[]) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { roles: { include: { role: true } } } });
    if (u.type !== 'ADMIN') throw new BadRequestException({ code: 'NOT_ADMIN' });
    const roleRows = await this.prisma.role.findMany({ where: { key: { in: roles } } });
    if (roleRows.length !== roles.length) throw new BadRequestException({ code: 'UNKNOWN_ROLE' });
    if (u.id === ctx.actorId && !roles.includes('SUPER_ADMIN')) throw new BadRequestException({ code: 'CANNOT_DEMOTE_SELF' });
    await this.prisma.$transaction([this.prisma.userRole.deleteMany({ where: { userId } }), this.prisma.userRole.createMany({ data: roleRows.map((r) => ({ userId, roleId: r.id, grantedBy: ctx.actorId })) })]);
    await this.audit.log(ctx, 'admin.user.roles', 'User', userId, { roles: u.roles.map((r) => r.role.key) }, { roles });
    return { ok: true };
  }

  async createAdmin(ctx: AuditContext, email: string, password: string, roles: string[]) {
    const argon2 = await import('argon2');
    const roleRows = await this.prisma.role.findMany({ where: { key: { in: roles } } });
    const u = await this.prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: await argon2.hash(password, { type: argon2.argon2id }), type: 'ADMIN', emailVerifiedAt: new Date(), roles: { create: roleRows.map((r) => ({ roleId: r.id, grantedBy: ctx.actorId })) }, preferences: { create: {} } },
    });
    await this.audit.log(ctx, 'admin.user.create_admin', 'User', u.id, undefined, { email, roles });
    return { id: u.id };
  }

  async grantContactCredits(ctx: AuditContext, businessId: string, credits: number) {
    const b = await this.prisma.businessProfile.update({ where: { id: businessId }, data: { freeContactCredits: { increment: credits } } });
    await this.audit.log(ctx, 'admin.contact.grant_credits', 'BusinessProfile', businessId, undefined, { credits });
    return b;
  }

  async grantContactAccess(ctx: AuditContext, businessId: string, influencerId: string, days: number | null) {
    const e = await this.prisma.$transaction(async (tx) => {
      await tx.contactEntitlement.updateMany({ where: { businessId, influencerId, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.contactEntitlement.create({ data: { businessId, influencerId, source: 'ADMIN_GRANT', grantedById: ctx.actorId, expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null } });
    });
    await this.audit.log(ctx, 'admin.contact.grant_access', 'ContactEntitlement', e.id, undefined, { businessId, influencerId, days });
    return e;
  }

  async setInfluencerFlags(ctx: AuditContext, influencerId: string, data: { isFeatured?: boolean; isPublic?: boolean }) {
    const before = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { id: influencerId }, select: { isFeatured: true, isPublic: true } });
    await this.prisma.influencerProfile.update({ where: { id: influencerId }, data });
    await this.audit.log(ctx, 'admin.influencer.flags', 'InfluencerProfile', influencerId, before, data);
    return { ok: true };
  }

  // ── Verification ───────────────────────────────────────────────
  listVerifications(type?: string, status = 'PENDING') {
    return this.prisma.verificationRecord.findMany({
      where: { status: status as any, ...(type ? { type: type as any } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { user: { select: { email: true, type: true, influencerProfile: { select: { id: true, displayName: true, slug: true } }, businessProfile: { select: { id: true, businessName: true, tradeLicenceNumber: true } } } } },
    });
  }

  async decideVerification(ctx: AuditContext, id: string, decision: 'VERIFIED' | 'REJECTED', notes?: string) {
    const rec = await this.prisma.verificationRecord.findUniqueOrThrow({ where: { id }, include: { user: { include: { influencerProfile: true, businessProfile: true } } } });
    if (rec.status !== 'PENDING') throw new BadRequestException({ code: 'ALREADY_DECIDED' });
    await this.prisma.$transaction(async (tx) => {
      await tx.verificationRecord.update({ where: { id }, data: { status: decision, notes, reviewedById: ctx.actorId, reviewedAt: new Date() } });
      const inf = rec.user.influencerProfile;
      const biz = rec.user.businessProfile;
      switch (rec.type) {
        case 'IDENTITY':
          if (inf) await tx.influencerProfile.update({ where: { id: inf.id }, data: { identityStatus: decision } });
          break;
        case 'MEDICAL_QUALIFICATION':
          if (rec.referenceId) await tx.medicalCredential.update({ where: { id: rec.referenceId }, data: { status: decision, reviewNotes: notes, reviewedById: ctx.actorId, reviewedAt: new Date() } });
          if (inf) {
            const anyVerified = await tx.medicalCredential.count({ where: { influencerId: inf.id, status: 'VERIFIED' } });
            await tx.influencerProfile.update({ where: { id: inf.id }, data: { medicalStatus: anyVerified ? 'VERIFIED' : decision } });
          }
          break;
        case 'BUSINESS_LICENCE':
          if (biz) await tx.businessProfile.update({ where: { id: biz.id }, data: { verificationStatus: decision } });
          break;
        case 'ADVERTISER_PERMIT':
          if (inf) await tx.influencerProfile.update({ where: { id: inf.id }, data: { advertiserPermitStatus: decision } });
          break;
        case 'SOCIAL_ACCOUNT':
          // Manually submitted metric review
          if ((rec.data as any)?.kind === 'MANUAL_METRIC' && rec.referenceId) {
            // Snapshots are history; a verification decision appends a corrected record rather than editing.
            const snap = await tx.socialMetricSnapshot.findUnique({ where: { id: rec.referenceId } });
            if (snap) await tx.socialMetricSnapshot.update({ where: { id: snap.id }, data: { verificationStatus: decision === 'VERIFIED' ? 'MANUALLY_SUBMITTED' : 'SUSPICIOUS' } });
          }
          break;
      }
      await this.audit.log(ctx, 'admin.verification.decide', 'VerificationRecord', id, { status: 'PENDING' }, { status: decision, type: rec.type, notes }, tx);
    });
    if (rec.user.influencerProfile) await this.grading.recompute(rec.user.influencerProfile.id).catch(() => undefined);
    await this.notifications.notify(rec.userId, decision === 'VERIFIED' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED', { type: rec.type.replace(/_/g, ' ').toLowerCase(), notes: notes ?? '' });
    return { ok: true };
  }

  // ── Categories & catalogue ─────────────────────────────────────
  async upsertCategory(ctx: AuditContext, dto: { id?: string; slug: string; nameEn: string; nameAr: string; parentId?: string | null; icon?: string; sortOrder?: number; isActive?: boolean; requiresMedicalCompliance?: boolean; commissionRate?: number | null; descriptionEn?: string; descriptionAr?: string }) {
    const { id, ...data } = dto;
    if (id && data.parentId === id) throw new BadRequestException({ code: 'INVALID_PARENT' });
    const before = id ? await this.prisma.category.findUnique({ where: { id } }) : null;
    const row = id ? await this.prisma.category.update({ where: { id }, data }) : await this.prisma.category.create({ data });
    await this.audit.log(ctx, id ? 'admin.category.update' : 'admin.category.create', 'Category', row.id, before, row);
    return row;
  }

  async upsertCatalog(ctx: AuditContext, dto: { id?: string; key: string; platform: any; nameEn: string; nameAr: string; descriptionEn?: string; descriptionAr?: string; complexityFactor?: number; isActive?: boolean; commissionRate?: number | null; defaultDeliverables?: any }) {
    const { id, ...data } = dto;
    const before = id ? await this.prisma.serviceCatalog.findUnique({ where: { id } }) : null;
    const row = id ? await this.prisma.serviceCatalog.update({ where: { id }, data }) : await this.prisma.serviceCatalog.create({ data: { ...data, defaultDeliverables: data.defaultDeliverables ?? [] } });
    await this.audit.log(ctx, id ? 'admin.catalog.update' : 'admin.catalog.create', 'ServiceCatalog', row.id, before, row);
    return row;
  }

  // ── Benchmarks ─────────────────────────────────────────────────
  listBenchmarks() {
    return this.prisma.pricingBenchmark.findMany({ orderBy: [{ platform: 'asc' }, { followersMin: 'asc' }], include: { catalog: { select: { key: true, nameEn: true } }, category: { select: { slug: true, nameEn: true } } } });
  }

  async upsertBenchmark(ctx: AuditContext, dto: any) {
    const { id, ...data } = dto;
    if (!(data.minRate <= data.medianRate && data.medianRate <= data.maxRate)) throw new BadRequestException({ code: 'INVALID_RATE_ORDER' });
    if (data.isSample === false && !data.researchedAt) throw new BadRequestException({ code: 'RESEARCH_DATE_REQUIRED' });
    const payload = { ...data, researchedAt: data.researchedAt ? new Date(data.researchedAt) : null };
    const before = id ? await this.prisma.pricingBenchmark.findUnique({ where: { id } }) : null;
    const row = id ? await this.prisma.pricingBenchmark.update({ where: { id }, data: payload }) : await this.prisma.pricingBenchmark.create({ data: payload });
    await this.audit.log(ctx, id ? 'admin.benchmark.update' : 'admin.benchmark.create', 'PricingBenchmark', row.id, before, row);
    return row;
  }

  async deleteBenchmark(ctx: AuditContext, id: string) {
    const before = await this.prisma.pricingBenchmark.delete({ where: { id } });
    await this.audit.log(ctx, 'admin.benchmark.delete', 'PricingBenchmark', id, before);
    return { ok: true };
  }

  // ── Grading configuration (versioned) ──────────────────────────
  async gradingConfig() {
    const { rule, version, config } = await this.grading.activeRule();
    const versions = await this.prisma.gradingRuleVersion.findMany({ where: { ruleId: rule.id }, orderBy: { version: 'desc' }, select: { id: true, version: true, notes: true, createdAt: true, createdById: true } });
    const distribution = await this.prisma.influencerProfile.groupBy({ by: ['currentGrade'], _count: true });
    return { active: { id: version.id, version: version.version, config }, versions, distribution, defaults: DEFAULT_GRADING_CONFIG };
  }

  async publishGradingVersion(ctx: AuditContext, config: Partial<GradingConfig>, notes: string) {
    const merged = mergeGradingConfig(config);
    const total = Object.values(merged.weights).reduce((a, b) => a + b, 0);
    if (total <= 0) throw new BadRequestException({ code: 'INVALID_WEIGHTS' });
    const t = merged.thresholds;
    if (!(t.S > t.A && t.A > t.B && t.B > t.C && t.C > 0 && t.S <= 100)) throw new BadRequestException({ code: 'INVALID_THRESHOLDS' });
    const { rule } = await this.grading.activeRule();
    const last = await this.prisma.gradingRuleVersion.findFirst({ where: { ruleId: rule.id }, orderBy: { version: 'desc' } });
    const v = await this.prisma.gradingRuleVersion.create({ data: { ruleId: rule.id, version: (last?.version ?? 0) + 1, config: merged as any, notes, createdById: ctx.actorId } });
    await this.prisma.gradingRule.update({ where: { id: rule.id }, data: { activeVersionId: v.id } });
    await this.audit.log(ctx, 'admin.grading.publish', 'GradingRuleVersion', v.id, { version: last?.version }, { version: v.version, notes });
    const ids = await this.prisma.influencerProfile.findMany({ select: { id: true } });
    for (const { id } of ids) await this.queue.add(QUEUES.GRADING, 'recompute', { influencerId: id }, { jobId: `grade-${id}-v${v.version}` });
    return { version: v.version, queued: ids.length };
  }

  // ── Settings ───────────────────────────────────────────────────
  getSetting(key: string) {
    return this.settings.get(key);
  }

  async setSetting(ctx: AuditContext, key: string, value: Record<string, unknown>) {
    const before = await this.settings.get(key);
    await this.settings.set(key, { ...(before as object), ...value }, ctx.actorId ?? undefined);
    await this.audit.log(ctx, `admin.settings.${key}`, 'PlatformSetting', key, before, value);
    return this.settings.get(key);
  }

  // ── Bookings / campaigns / payments ────────────────────────────
  listOrders(status?: string) {
    return this.prisma.order.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { business: { select: { businessName: true } }, items: { select: { id: true, description: true, grossAmount: true, refundedAmount: true, vatAmount: true, businessCommission: true, influencer: { select: { displayName: true } }, campaign: { select: { id: true, number: true, status: true } } } } } });
  }

  listCampaigns(status?: string, compliance?: string) {
    return this.prisma.campaign.findMany({ where: { ...(status ? { status: status as any } : {}), ...(compliance ? { complianceStatus: compliance as any } : {}) }, orderBy: { updatedAt: 'desc' }, take: 200, include: { business: { select: { businessName: true } }, influencer: { select: { displayName: true, slug: true } } } });
  }

  async setCompliance(ctx: AuditContext, campaignId: string, status: 'APPROVED' | 'REJECTED', notes?: string) {
    const c = await this.prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { business: true, influencer: true } });
    await this.prisma.campaign.update({ where: { id: campaignId }, data: { complianceStatus: status, complianceNotes: notes } });
    await this.prisma.campaignEvent.create({ data: { campaignId, actorId: ctx.actorId, toStatus: c.status, note: `Compliance ${status}${notes ? `: ${notes}` : ''}` } });
    await this.audit.log(ctx, 'admin.campaign.compliance', 'Campaign', campaignId, { complianceStatus: c.complianceStatus }, { complianceStatus: status, notes });
    for (const uid of [c.business.userId, c.influencer.userId]) await this.notifications.notify(uid, 'CAMPAIGN_UPDATED', { campaign: c.number, status: `COMPLIANCE_${status}` });
    return { ok: true };
  }

  adminTransitionCampaign(ctx: AuditContext, id: string, to: any, note?: string) {
    return this.campaigns.transition(ctx.actorId!, id, to, note, true);
  }

  listPayments(status?: string) {
    return this.prisma.payment.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { order: { select: { number: true } }, contactPurchase: { select: { business: { select: { businessName: true } }, influencer: { select: { displayName: true } } } }, events: { select: { type: true, receivedAt: true, processedAt: true, error: true } } } });
  }

  // ── Disputes ───────────────────────────────────────────────────
  listDisputes(status?: string) {
    return this.prisma.dispute.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, include: { campaign: { select: { id: true, number: true, title: true, status: true, orderItemId: true, business: { select: { businessName: true, userId: true } }, influencer: { select: { displayName: true, userId: true } } } } } });
  }

  async resolveDispute(ctx: AuditContext, id: string, dto: { status: 'UNDER_REVIEW' | 'RESOLVED_BUSINESS' | 'RESOLVED_INFLUENCER' | 'RESOLVED_SPLIT' | 'CLOSED'; resolution?: string; refundAmount?: number; campaignOutcome?: 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS' }) {
    const d = await this.prisma.dispute.findUniqueOrThrow({ where: { id }, include: { campaign: { include: { business: true, influencer: true } } } });
    if (dto.refundAmount && dto.refundAmount > 0) {
      if (!d.campaign.orderItemId) throw new BadRequestException({ code: 'NO_ORDER_FOR_REFUND' });
      await this.finance.refund(ctx.actorId!, { orderItemId: d.campaign.orderItemId, amount: dto.refundAmount, reason: `Dispute ${id}: ${dto.resolution ?? ''}`.slice(0, 300) });
    }
    await this.prisma.dispute.update({ where: { id }, data: { status: dto.status, resolution: dto.resolution, refundAmount: dto.refundAmount, assignedToId: ctx.actorId, resolvedAt: dto.status.startsWith('RESOLVED') || dto.status === 'CLOSED' ? new Date() : null } });
    if (dto.campaignOutcome && d.campaign.status === 'DISPUTED') {
      const fresh = await this.prisma.campaign.findUniqueOrThrow({ where: { id: d.campaignId } });
      if (fresh.status === 'DISPUTED') await this.campaigns.transition(ctx.actorId!, d.campaignId, dto.campaignOutcome, dto.resolution, true);
    }
    await this.audit.log(ctx, 'admin.dispute.resolve', 'Dispute', id, { status: d.status }, dto);
    for (const uid of [d.campaign.business.userId, d.campaign.influencer.userId]) await this.notifications.notify(uid, 'DISPUTE_UPDATED', { campaign: d.campaign.number, status: dto.status });
    return { ok: true };
  }

  // ── Moderation ─────────────────────────────────────────────────
  listReports(status = 'OPEN') {
    return this.prisma.contentReport.findMany({ where: { status: status as any }, orderBy: { createdAt: 'asc' }, take: 100, include: { reporter: { select: { email: true } } } });
  }

  async actionReport(ctx: AuditContext, id: string, action: 'DISMISS' | 'REMOVE_CONTENT' | 'SUSPEND_USER') {
    const r = await this.prisma.contentReport.findUniqueOrThrow({ where: { id } });
    if (action === 'REMOVE_CONTENT') {
      if (r.targetType === 'MESSAGE') await this.prisma.message.update({ where: { id: r.targetId }, data: { status: 'REMOVED' } });
      if (r.targetType === 'REVIEW') await this.prisma.review.update({ where: { id: r.targetId }, data: { isHidden: true } });
      if (r.targetType === 'PROFILE') await this.prisma.influencerProfile.update({ where: { id: r.targetId }, data: { isPublic: false } });
    }
    if (action === 'SUSPEND_USER') {
      let userId = r.targetType === 'USER' ? r.targetId : null;
      if (r.targetType === 'MESSAGE') userId = (await this.prisma.message.findUnique({ where: { id: r.targetId } }))?.senderId ?? null;
      if (userId) await this.setUserStatus(ctx, userId, 'SUSPENDED');
    }
    await this.prisma.contentReport.update({ where: { id }, data: { status: action === 'DISMISS' ? 'DISMISSED' : 'ACTIONED', resolvedById: ctx.actorId, resolvedAt: new Date() } });
    await this.audit.log(ctx, 'admin.moderation.action', 'ContentReport', id, undefined, { action, targetType: r.targetType, targetId: r.targetId });
    return { ok: true };
  }

  flaggedMessages() {
    return this.prisma.message.findMany({ where: { status: 'FLAGGED' }, orderBy: { createdAt: 'desc' }, take: 100, include: { sender: { select: { email: true } } } });
  }

  // ── AI ─────────────────────────────────────────────────────────
  aiLogs() {
    return this.prisma.aiSearchLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { recommendations: { select: { rank: true, influencer: { select: { displayName: true } }, feedback: { select: { helpful: true } } }, orderBy: { rank: 'asc' }, take: 5 } } });
  }

  // ── Audit / integrations / privacy ─────────────────────────────
  auditLogs(q: { entityType?: string; actorId?: string; action?: string; cursor?: string }) {
    return this.prisma.auditLog.findMany({
      where: { ...(q.entityType ? { entityType: q.entityType } : {}), ...(q.actorId ? { actorId: q.actorId } : {}), ...(q.action ? { action: { startsWith: q.action } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { actor: { select: { email: true } } },
    });
  }

  async integrations() {
    const rows = await this.prisma.integrationConfig.findMany({ orderBy: { provider: 'asc' } });
    const sync = await this.prisma.socialSyncLog.groupBy({ by: ['status'], where: { startedAt: { gt: new Date(Date.now() - 7 * 86_400_000) } }, _count: true });
    const webhooks = await this.prisma.paymentEvent.groupBy({ by: ['provider'], where: { receivedAt: { gt: new Date(Date.now() - 7 * 86_400_000) } }, _count: true });
    const webhookErrors = await this.prisma.paymentEvent.count({ where: { error: { not: null } } });
    return { configs: rows, social: this.social.providerStatus(), payments: this.payments.providerStatus(), syncLast7Days: sync, webhooksLast7Days: webhooks, webhookErrors };
  }

  async updateIntegration(ctx: AuditContext, provider: string, data: { isEnabled?: boolean; mode?: string; publicConfig?: Record<string, unknown> }) {
    const before = await this.prisma.integrationConfig.findUnique({ where: { provider } });
    if (!before) throw new NotFoundException();
    const row = await this.prisma.integrationConfig.update({ where: { provider }, data: { ...data, publicConfig: data.publicConfig as any } });
    await this.audit.log(ctx, 'admin.integration.update', 'IntegrationConfig', provider, before, row);
    return row;
  }

  listDeletionRequests() {
    return this.prisma.dataDeletionRequest.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, type: true } } } });
  }
}
