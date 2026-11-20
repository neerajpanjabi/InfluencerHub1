import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma } from '@influencehub/database';
import { canTransition, allowedTransitions, type CampaignActor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SettingsService } from '../../common/services/settings.service';
import { NotificationsService } from '../notifications/notifications.service';

const DETAIL_INCLUDE = {
  business: { select: { id: true, businessName: true, userId: true, logoUrl: true } },
  influencer: { select: { id: true, displayName: true, slug: true, userId: true, profileImageUrl: true } },
  deliverables: { orderBy: { createdAt: 'asc' as const }, include: { attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } } } },
  approvals: { orderBy: { createdAt: 'desc' as const } },
  events: { orderBy: { createdAt: 'asc' as const } },
  reviews: true,
  disputes: true,
  orderItem: { select: { id: true, description: true, grossAmount: true, vatAmount: true, businessCommission: true, order: { select: { id: true, number: true } } } },
} satisfies Prisma.CampaignInclude;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notifications: NotificationsService, private readonly settings: SettingsService) {}

  private async load(userId: string, id: string, isAdmin = false) {
    const c = await this.prisma.campaign.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!c) throw new NotFoundException();
    let actor: CampaignActor;
    if (isAdmin) actor = 'ADMIN';
    else if (c.business.userId === userId) actor = 'BUSINESS';
    else if (c.influencer.userId === userId) actor = 'INFLUENCER';
    else throw new NotFoundException(); // no existence leak (IDOR protection)
    return { c, actor };
  }

  async list(userId: string, status?: string) {
    const [b, i] = await Promise.all([this.prisma.businessProfile.findUnique({ where: { userId } }), this.prisma.influencerProfile.findUnique({ where: { userId } })]);
    const where: Prisma.CampaignWhereInput = b ? { businessId: b.id } : i ? { influencerId: i.id } : { id: '00000000-0000-0000-0000-000000000000' };
    if (status) where.status = status as CampaignStatus;
    return this.prisma.campaign.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { business: { select: { businessName: true } }, influencer: { select: { displayName: true, slug: true } }, deliverables: { select: { status: true } } } });
  }

  async get(userId: string, id: string, isAdmin = false) {
    const { c, actor } = await this.load(userId, id, isAdmin);
    return { ...c, viewerRole: actor, allowedTransitions: allowedTransitions(c.status, actor) };
  }

  async transition(userId: string, id: string, to: CampaignStatus, note?: string, isAdmin = false, tx?: Prisma.TransactionClient) {
    const { c, actor } = await this.load(userId, id, isAdmin);
    if (!canTransition(c.status, to, actor)) throw new BadRequestException({ code: 'INVALID_TRANSITION', from: c.status, to });
    if (to === 'PUBLISHED' && c.complianceStatus === 'PENDING_REVIEW') throw new BadRequestException({ code: 'COMPLIANCE_REVIEW_PENDING' });
    if (to === 'PUBLISHED' && c.complianceStatus === 'REJECTED') throw new BadRequestException({ code: 'COMPLIANCE_REJECTED' });
    const client = tx ?? this.prisma;
    const data: Prisma.CampaignUpdateInput = { status: to };
    if (to === 'IN_PROGRESS' && !c.startedAt) data.startedAt = new Date();
    if (to === 'COMPLETED') data.completedAt = new Date();
    if (to === 'CANCELLED') data.cancelledAt = new Date();
    // Optimistic concurrency: only update if status is unchanged since read.
    const r = await client.campaign.updateMany({ where: { id, status: c.status }, data: data as any });
    if (!r.count) throw new BadRequestException({ code: 'CONCURRENT_UPDATE' });
    await client.campaignEvent.create({ data: { campaignId: id, actorId: userId, fromStatus: c.status, toStatus: to, note } });
    if (to === 'COMPLETED' && c.orderItem) await client.commission.updateMany({ where: { orderItemId: c.orderItem.id, releasedAt: null }, data: { releasedAt: new Date() } });
    await this.audit.log({ actorId: userId }, 'campaign.transition', 'Campaign', id, { status: c.status }, { status: to, note });
    const other = actor === 'BUSINESS' ? c.influencer.userId : c.business.userId;
    const targets = actor === 'ADMIN' ? [c.business.userId, c.influencer.userId] : [other];
    for (const t of targets) {
      const link = t === c.business.userId ? `/business/campaigns/${id}` : `/influencer/campaigns/${id}`;
      await this.notifications.notify(t, to === 'COMPLETED' ? 'CAMPAIGN_COMPLETED' : 'CAMPAIGN_UPDATED', { campaign: c.number, status: to }, link);
    }
    return this.get(userId, id, isAdmin);
  }

  async updateBrief(userId: string, id: string, dto: { title?: string; brief?: string; requiredMentions?: string[]; requiredHashtags?: string[]; postingDeadline?: string; requiresApproval?: boolean; usageRights?: string; contractTerms?: string }) {
    const { c, actor } = await this.load(userId, id);
    if (actor !== 'BUSINESS') throw new ForbiddenException();
    if (!['DRAFT', 'ENQUIRY', 'QUOTATION_REQUESTED', 'PAYMENT_PENDING', 'CONFIRMED'].includes(c.status)) throw new BadRequestException({ code: 'BRIEF_LOCKED' });
    await this.prisma.campaign.update({ where: { id }, data: { ...dto, postingDeadline: dto.postingDeadline ? new Date(dto.postingDeadline) : undefined } });
    await this.prisma.campaignEvent.create({ data: { campaignId: id, actorId: userId, toStatus: c.status, note: 'Brief updated' } });
    return this.get(userId, id);
  }

  async submitDeliverable(userId: string, id: string, deliverableId: string, dto: { draftUrl?: string; draftNotes?: string; attachmentIds?: string[] }) {
    const { c, actor } = await this.load(userId, id);
    if (actor !== 'INFLUENCER') throw new ForbiddenException();
    if (!['IN_PROGRESS', 'REVISION_REQUESTED', 'CONTENT_SUBMITTED'].includes(c.status)) throw new BadRequestException({ code: 'CAMPAIGN_NOT_IN_PROGRESS' });
    const d = c.deliverables.find((x) => x.id === deliverableId);
    if (!d) throw new NotFoundException();
    if (!['PENDING', 'REVISION_REQUESTED'].includes(d.status)) throw new BadRequestException({ code: 'DELIVERABLE_NOT_EDITABLE' });
    if (dto.attachmentIds?.length) {
      const owned = await this.prisma.attachment.count({ where: { id: { in: dto.attachmentIds }, ownerId: userId } });
      if (owned !== dto.attachmentIds.length) throw new ForbiddenException({ code: 'ATTACHMENT_NOT_OWNED' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.campaignDeliverable.update({ where: { id: d.id }, data: { status: 'SUBMITTED', draftUrl: dto.draftUrl, draftNotes: dto.draftNotes } });
      if (dto.attachmentIds?.length) await tx.attachment.updateMany({ where: { id: { in: dto.attachmentIds } }, data: { deliverableId: d.id, purpose: 'DELIVERABLE' } });
    });
    const fresh = await this.prisma.campaign.findUniqueOrThrow({ where: { id }, include: { deliverables: true } });
    const allSubmitted = fresh.deliverables.every((x) => ['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes(x.status));
    if (allSubmitted && c.status !== 'CONTENT_SUBMITTED') {
      await this.transition(userId, id, 'CONTENT_SUBMITTED', 'All deliverables submitted');
      if (c.requiresApproval) await this.transition(userId, id, 'AWAITING_APPROVAL', undefined, true).catch(() => undefined);
    }
    await this.notifications.notify(c.business.userId, 'DELIVERABLE_SUBMITTED', { campaign: c.number }, `/business/campaigns/${id}`);
    return this.get(userId, id);
  }

  async reviewDeliverable(userId: string, id: string, deliverableId: string, decision: 'APPROVED' | 'REVISION_REQUESTED', comment?: string) {
    const { c, actor } = await this.load(userId, id);
    if (actor !== 'BUSINESS') throw new ForbiddenException();
    const d = c.deliverables.find((x) => x.id === deliverableId);
    if (!d || d.status !== 'SUBMITTED') throw new BadRequestException({ code: 'DELIVERABLE_NOT_SUBMITTED' });
    if (decision === 'REVISION_REQUESTED' && d.revisionCount >= d.maxRevisions) throw new BadRequestException({ code: 'REVISION_LIMIT_REACHED' });
    await this.prisma.$transaction([
      this.prisma.campaignDeliverable.update({ where: { id: d.id }, data: { status: decision, revisionCount: decision === 'REVISION_REQUESTED' ? { increment: 1 } : undefined } }),
      this.prisma.campaignApproval.create({ data: { campaignId: id, deliverableId: d.id, decidedById: userId, decision, comment } }),
    ]);
    const fresh = await this.prisma.campaign.findUniqueOrThrow({ where: { id }, include: { deliverables: true } });
    if (decision === 'REVISION_REQUESTED') {
      if (c.status !== 'REVISION_REQUESTED') await this.transition(userId, id, 'REVISION_REQUESTED', comment);
      await this.notifications.notify(c.influencer.userId, 'REVISION_REQUESTED', { campaign: c.number, comment: comment ?? '' }, `/influencer/campaigns/${id}`);
    } else if (fresh.deliverables.every((x) => ['APPROVED', 'PUBLISHED'].includes(x.status))) {
      await this.transition(userId, id, 'APPROVED', comment);
      await this.notifications.notify(c.influencer.userId, 'DELIVERABLE_APPROVED', { campaign: c.number }, `/influencer/campaigns/${id}`);
    }
    return this.get(userId, id);
  }

  /** Creator records the live post URL as delivery evidence. */
  async publishDeliverable(userId: string, id: string, deliverableId: string, publishedUrl: string) {
    const { c, actor } = await this.load(userId, id);
    if (actor !== 'INFLUENCER') throw new ForbiddenException();
    if (c.complianceStatus === 'PENDING_REVIEW' || c.complianceStatus === 'REJECTED') throw new BadRequestException({ code: 'COMPLIANCE_REVIEW_PENDING' });
    const d = c.deliverables.find((x) => x.id === deliverableId);
    const okStatus = c.requiresApproval ? ['APPROVED'] : ['SUBMITTED', 'APPROVED'];
    if (!d || !okStatus.includes(d.status)) throw new BadRequestException({ code: 'DELIVERABLE_NOT_APPROVED' });
    await this.prisma.campaignDeliverable.update({ where: { id: d.id }, data: { status: 'PUBLISHED', publishedUrl, publishedAt: new Date() } });
    const fresh = await this.prisma.campaign.findUniqueOrThrow({ where: { id }, include: { deliverables: true } });
    if (fresh.deliverables.every((x) => x.status === 'PUBLISHED') && fresh.status !== 'PUBLISHED') await this.transition(userId, id, 'PUBLISHED', 'All deliverables published');
    return this.get(userId, id);
  }

  async review(userId: string, id: string, rating: number, comment?: string) {
    const { c, actor } = await this.load(userId, id);
    if (actor !== 'BUSINESS') throw new ForbiddenException();
    if (c.status !== 'COMPLETED') throw new BadRequestException({ code: 'CAMPAIGN_NOT_COMPLETED' });
    const review = await this.prisma.review.create({ data: { campaignId: id, businessId: c.business.id, influencerId: c.influencer.id, rating, comment } });
    const agg = await this.prisma.review.aggregate({ where: { influencerId: c.influencer.id, isHidden: false }, _avg: { rating: true }, _count: true });
    await this.prisma.influencerProfile.update({ where: { id: c.influencer.id }, data: { ratingAverage: agg._avg.rating ?? null, ratingCount: agg._count } });
    await this.notifications.notify(c.influencer.userId, 'REVIEW_RECEIVED', { rating }, `/influencer/reviews`);
    return review;
  }

  async respondToReview(userId: string, reviewId: string, response: string) {
    const r = await this.prisma.review.findUnique({ where: { id: reviewId }, include: { influencer: true } });
    if (!r || r.influencer.userId !== userId) throw new NotFoundException();
    return this.prisma.review.update({ where: { id: reviewId }, data: { response } });
  }

  async myReviews(userId: string) {
    const [b, i] = await Promise.all([this.prisma.businessProfile.findUnique({ where: { userId } }), this.prisma.influencerProfile.findUnique({ where: { userId } })]);
    return this.prisma.review.findMany({ where: b ? { businessId: b.id } : { influencerId: i?.id ?? 'none' }, orderBy: { createdAt: 'desc' }, include: { campaign: { select: { number: true, title: true } }, business: { select: { businessName: true } }, influencer: { select: { displayName: true, slug: true } } } });
  }

  async raiseDispute(userId: string, id: string, reason: string, details: string) {
    const { c } = await this.load(userId, id);
    await this.transition(userId, id, 'DISPUTED', reason);
    const d = await this.prisma.dispute.create({ data: { campaignId: id, raisedById: userId, reason, details } });
    await this.audit.log({ actorId: userId }, 'campaign.dispute.raise', 'Dispute', d.id, undefined, { campaign: c.number });
    return d;
  }

  /** Worker job: auto-complete campaigns published N days ago without business action. */
  async autoComplete() {
    const days = (await this.settings.platform()).autoCompleteDaysAfterPublish;
    const due = await this.prisma.campaign.findMany({ where: { status: 'PUBLISHED', updatedAt: { lt: new Date(Date.now() - days * 86_400_000) } }, select: { id: true, business: { select: { userId: true } } } });
    for (const c of due) await this.transition(c.business.userId, c.id, 'COMPLETED', `Auto-completed ${days} days after publication`, true).catch(() => undefined);
    return due.length;
  }
}
