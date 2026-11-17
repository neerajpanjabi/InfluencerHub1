import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { normalizeText } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { sandboxAllowed } from '../../config/env';
import { applyVisibility, PUBLIC_CARD_SELECT } from './search.service';

@Injectable()
export class InfluencersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async refreshSearchText(influencerId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { id: influencerId },
      include: { categories: { include: { category: true } }, socialAccounts: { where: { status: 'CONNECTED' } }, services: { where: { status: 'ACTIVE', deletedAt: null }, select: { price: true, promoPrice: true, promoEndsAt: true } } },
    });
    if (!p) return;
    const parts = [p.displayName, p.displayNameAr, p.bio, p.bioAr, p.city, ...p.specialities, ...p.contentNiches, ...p.categories.flatMap((c) => [c.category.nameEn, c.category.nameAr, c.category.slug]), ...p.socialAccounts.map((s) => s.username)];
    const now = new Date();
    const prices = p.services.map((s) => Number(s.promoPrice && (!s.promoEndsAt || s.promoEndsAt > now) ? s.promoPrice : s.price));
    await this.prisma.influencerProfile.update({
      where: { id: influencerId },
      data: { searchText: normalizeText(parts.filter(Boolean).join(' ')), startingPrice: prices.length ? Math.min(...prices) : null },
    });
  }

  async publicProfile(slug: string, viewer?: { id: string; type: string }) {
    const p = await this.prisma.influencerProfile.findFirst({
      where: { slug, deletedAt: null, user: { status: 'ACTIVE' } },
      select: {
        ...PUBLIC_CARD_SELECT,
        userId: true,
        isPublic: true,
        bio: true,
        bioAr: true,
        gender: true,
        specialities: true,
        contentNiches: true,
        audienceLocations: true,
        coverImageUrl: true,
        advertiserPermitStatus: true,
        socialAccounts: {
          where: { status: { in: ['CONNECTED', 'TOKEN_EXPIRED'] } },
          select: { id: true, platform: true, username: true, profileUrl: true, isSandbox: true, lastSyncedAt: true, status: true, accountType: true },
        },
        services: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { price: 'asc' },
          select: { id: true, title: true, titleAr: true, description: true, descriptionAr: true, platform: true, deliverables: true, price: true, promoPrice: true, promoEndsAt: true, currency: true, deliveryDays: true, revisions: true, usageRights: true, exclusivityDays: true, addOns: true, catalog: { select: { key: true, nameEn: true, nameAr: true } } },
        },
        packages: { where: { status: 'ACTIVE' }, select: { id: true, title: true, titleAr: true, description: true, price: true, deliveryDays: true, items: { select: { quantity: true, service: { select: { title: true, titleAr: true } } } } } },
        reviews: { where: { isHidden: false }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, rating: true, comment: true, response: true, createdAt: true, business: { select: { businessName: true } } } },
      },
    });
    const isOwner = viewer && p && p.userId === viewer.id;
    if (!p || (!p.isPublic && !isOwner && viewer?.type !== 'ADMIN')) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!sandboxAllowed() && p.socialAccounts.some((s) => s.isSandbox)) throw new NotFoundException({ code: 'NOT_FOUND' });

    const vis = (p.visibility ?? {}) as Record<string, boolean>;
    const metrics: Record<string, unknown[]> = {};
    for (const acc of p.socialAccounts) {
      const rows = await this.prisma.$queryRaw<Array<{ metricType: string; value: Prisma.Decimal; verificationStatus: string; source: string; collectedAt: Date; sampleSize: number | null }>>`
        SELECT DISTINCT ON ("metricType") "metricType", value, "verificationStatus", source, "collectedAt", "sampleSize"
        FROM social_metric_snapshots WHERE "socialAccountId" = ${acc.id}::uuid
        AND "metricType" IN ('FOLLOWERS','AVG_REEL_VIEWS','AVG_STORY_VIEWS','AVG_VIDEO_VIEWS','ENGAGEMENT_RATE')
        ORDER BY "metricType", "collectedAt" DESC`;
      metrics[acc.id] = rows
        .filter((r) => vis.showStoryViews !== false || r.metricType !== 'AVG_STORY_VIEWS')
        .map((r) => ({ ...r, value: Number(r.value), verificationStatus: acc.status === 'TOKEN_EXPIRED' && r.verificationStatus === 'API_VERIFIED' ? 'EXPIRED' : r.verificationStatus }));
    }
    let audience: Array<{ key: string; value: number }> = [];
    if (vis.showAudience !== false && p.socialAccounts.length) {
      const aud = await this.prisma.audienceInsight.findMany({ where: { socialAccountId: { in: p.socialAccounts.map((s) => s.id) }, dimension: 'COUNTRY' }, orderBy: { collectedAt: 'desc' }, take: 10 });
      const seen = new Set<string>();
      audience = aud.filter((a) => !seen.has(a.key) && seen.add(a.key)).map((a) => ({ key: a.key, value: Number(a.value) }));
    }
    const score = await this.prisma.influencerScore.findFirst({ where: { influencerId: p.id, isCurrent: true }, select: { score: true, grade: true, breakdown: true, dataCoverage: true, computedAt: true } });

    let viewerState: Record<string, unknown> | undefined;
    if (viewer?.type === 'BUSINESS') {
      const biz = await this.prisma.businessProfile.findUnique({ where: { userId: viewer.id }, select: { id: true } });
      if (biz) {
        const [saved, ent] = await Promise.all([
          this.prisma.savedInfluencer.findUnique({ where: { businessId_influencerId: { businessId: biz.id, influencerId: p.id } } }),
          this.prisma.contactEntitlement.findFirst({ where: { businessId: biz.id, influencerId: p.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
        ]);
        viewerState = { saved: !!saved, canContact: !!ent };
      }
    }
    const { userId, visibility, isPublic, gender, ...rest } = p as any;
    return {
      ...applyVisibility({ ...rest, visibility }),
      gender: vis.showGender === false ? null : gender,
      isPublic,
      metrics,
      audience,
      performance: score
        ? { score: score.score, grade: score.grade, coverage: score.dataCoverage, computedAt: score.computedAt, components: (score.breakdown as any)?.components ?? [], reason: (score.breakdown as any)?.reason }
        : { grade: 'NOT_RATED' },
      viewer: viewerState,
      isOwner: !!isOwner,
    };
  }

  async homeSections() {
    const base = { isPublic: true, deletedAt: null, user: { status: 'ACTIVE' as const }, ...(sandboxAllowed() ? {} : { socialAccounts: { none: { isSandbox: true } } }) };
    const [featured, topRated, trending, newest, services] = await Promise.all([
      this.prisma.influencerProfile.findMany({ where: { ...base, isFeatured: true }, select: PUBLIC_CARD_SELECT, take: 8, orderBy: { currentScore: { sort: 'desc', nulls: 'last' } } }),
      this.prisma.influencerProfile.findMany({ where: { ...base, currentGrade: { in: ['S', 'A'] } }, select: PUBLIC_CARD_SELECT, take: 8, orderBy: { currentScore: { sort: 'desc', nulls: 'last' } } }),
      this.prisma.influencerProfile.findMany({ where: { ...base, engagementRate: { not: null } }, select: PUBLIC_CARD_SELECT, take: 8, orderBy: { engagementRate: 'desc' } }),
      this.prisma.influencerProfile.findMany({ where: base, select: PUBLIC_CARD_SELECT, take: 4, orderBy: { createdAt: 'desc' } }),
      this.prisma.serviceCatalog.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { key: true, nameEn: true, nameAr: true, platform: true, _count: { select: { influencerServices: { where: { status: 'ACTIVE', deletedAt: null } } } } } }),
    ]);
    const popular = services.sort((a, b) => b._count.influencerServices - a._count.influencerServices).slice(0, 8).map(({ _count, ...s }) => ({ ...s, offerCount: _count.influencerServices }));
    const stats = { creators: await this.prisma.influencerProfile.count({ where: base }), categories: await this.prisma.category.count({ where: { isActive: true, parentId: null } }) };
    return { featured: featured.map(applyVisibility), topRated: topRated.map(applyVisibility), trending: trending.map(applyVisibility), newest: newest.map(applyVisibility), popularServices: popular, stats };
  }

  // ── Creator self-service ────────────────────────────────────────
  async myProfile(userId: string) {
    const p = await this.prisma.influencerProfile.findUnique({
      where: { userId },
      include: {
        categories: { include: { category: true } },
        medicalCredentials: { orderBy: { createdAt: 'desc' } },
        availability: { where: { endsOn: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { startsOn: 'asc' } },
        user: { select: { email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true } },
      },
    });
    if (!p) throw new NotFoundException();
    const verifications = await this.prisma.verificationRecord.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return { ...p, verifications };
  }

  async updateProfile(userId: string, dto: any) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId } });
    const { categoryIds, primaryCategoryId, advertiserPermitExpiry, visibility, ...fields } = dto;
    if (fields.isPublic === true) {
      const cats = categoryIds ?? (await this.prisma.influencerCategory.findMany({ where: { influencerId: p.id } }));
      if (!cats.length) throw new BadRequestException({ code: 'CATEGORY_REQUIRED_TO_PUBLISH' });
      const consent = await this.prisma.consentRecord.findFirst({ where: { userId, type: 'PUBLIC_PROFILE', granted: true } });
      if (!consent) await this.prisma.consentRecord.create({ data: { userId, type: 'PUBLIC_PROFILE', version: '2026-11', granted: true } });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.influencerProfile.update({
        where: { id: p.id },
        data: {
          ...fields,
          ...(visibility ? { visibility: { ...((p.visibility as object) ?? {}), ...visibility } } : {}),
          ...(advertiserPermitExpiry !== undefined ? { advertiserPermitExpiry: advertiserPermitExpiry ? new Date(advertiserPermitExpiry) : null } : {}),
          ...(fields.advertiserPermitNumber ? { advertiserPermitStatus: 'PENDING' } : {}),
          onboardingCompleted: p.onboardingCompleted || !!(categoryIds?.length && (fields.bio ?? p.bio)),
        },
      });
      if (categoryIds) {
        const valid = await tx.category.count({ where: { id: { in: categoryIds }, isActive: true } });
        if (valid !== categoryIds.length) throw new BadRequestException({ code: 'INVALID_CATEGORY' });
        await tx.influencerCategory.deleteMany({ where: { influencerId: p.id } });
        await tx.influencerCategory.createMany({ data: categoryIds.map((id: string) => ({ influencerId: p.id, categoryId: id, isPrimary: id === (primaryCategoryId ?? categoryIds[0]) })) });
        const medical = await tx.category.count({ where: { id: { in: categoryIds }, requiresMedicalCompliance: true } });
        if (medical) await tx.influencerProfile.update({ where: { id: p.id }, data: { isMedicalProfessional: true } });
      }
    });
    if (fields.advertiserPermitNumber) {
      await this.prisma.verificationRecord.create({ data: { userId, type: 'ADVERTISER_PERMIT', status: 'PENDING', data: { permitNumber: fields.advertiserPermitNumber, expiry: advertiserPermitExpiry } } });
    }
    await this.refreshSearchText(p.id);
    return this.myProfile(userId);
  }

  async addAvailability(userId: string, dto: { startsOn: string; endsOn: string; isAvailable: boolean; note?: string }) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId } });
    if (new Date(dto.endsOn) < new Date(dto.startsOn)) throw new BadRequestException({ code: 'INVALID_RANGE' });
    return this.prisma.availabilitySlot.create({ data: { influencerId: p.id, startsOn: new Date(dto.startsOn), endsOn: new Date(dto.endsOn), isAvailable: dto.isAvailable, note: dto.note } });
  }

  async removeAvailability(userId: string, id: string) {
    const r = await this.prisma.availabilitySlot.deleteMany({ where: { id, influencer: { userId } } });
    if (!r.count) throw new NotFoundException();
    return { ok: true };
  }

  async submitMedicalCredential(userId: string, dto: { profession: string; speciality?: string; licensingAuthority: string; licenceNumber: string; licenceExpiry?: string; documentId?: string }) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId } });
    if (dto.documentId) {
      const doc = await this.prisma.attachment.findFirst({ where: { id: dto.documentId, ownerId: userId } });
      if (!doc) throw new ForbiddenException({ code: 'ATTACHMENT_NOT_OWNED' });
    }
    const cred = await this.prisma.medicalCredential.create({
      data: { influencerId: p.id, profession: dto.profession, speciality: dto.speciality, licensingAuthority: dto.licensingAuthority, licenceNumber: dto.licenceNumber, licenceExpiry: dto.licenceExpiry ? new Date(dto.licenceExpiry) : null, documentId: dto.documentId },
    });
    await this.prisma.influencerProfile.update({ where: { id: p.id }, data: { isMedicalProfessional: true, medicalStatus: 'PENDING' } });
    await this.prisma.verificationRecord.create({ data: { userId, type: 'MEDICAL_QUALIFICATION', status: 'PENDING', referenceId: cred.id, documentIds: dto.documentId ? [dto.documentId] : [] } });
    await this.audit.log({ actorId: userId }, 'influencer.medical.submit', 'MedicalCredential', cred.id);
    return cred;
  }

  async requestIdentityVerification(userId: string, documentIds: string[]) {
    const owned = await this.prisma.attachment.count({ where: { id: { in: documentIds }, ownerId: userId } });
    if (owned !== documentIds.length) throw new ForbiddenException({ code: 'ATTACHMENT_NOT_OWNED' });
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId } });
    await this.prisma.influencerProfile.update({ where: { id: p.id }, data: { identityStatus: 'PENDING' } });
    return this.prisma.verificationRecord.create({ data: { userId, type: 'IDENTITY', status: 'PENDING', documentIds } });
  }

  async dashboard(userId: string) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId } });
    const [pendingQuotes, activeCampaigns, completed, earnings, unreadMessages, enquiries] = await Promise.all([
      this.prisma.quotation.count({ where: { influencerId: p.id, status: 'REQUESTED' } }),
      this.prisma.campaign.count({ where: { influencerId: p.id, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'CONTENT_SUBMITTED', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED'] } } }),
      this.prisma.campaign.count({ where: { influencerId: p.id, status: 'COMPLETED' } }),
      this.prisma.commission.aggregate({ where: { influencerId: p.id }, _sum: { influencerNet: true, reversedAmount: true } }),
      this.prisma.conversationParticipant.count({ where: { userId, conversation: { lastMessageAt: { not: null } } } }),
      this.prisma.contactEntitlement.count({ where: { influencerId: p.id, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    ]);
    return {
      grade: p.currentGrade,
      score: p.currentScore,
      followers: p.totalFollowers,
      avgReelViews: p.avgReelViews,
      avgStoryViews: p.avgStoryViews,
      avgVideoViews: p.avgVideoViews,
      engagementRate: p.engagementRate,
      pendingQuotes,
      activeCampaigns,
      completedCampaigns: completed,
      lifetimeEarnings: Number(earnings._sum.influencerNet ?? 0) - Number(earnings._sum.reversedAmount ?? 0),
      conversations: unreadMessages,
      enquiriesLast30Days: enquiries,
      isPublic: p.isPublic,
      onboardingCompleted: p.onboardingCompleted,
    };
  }
}
