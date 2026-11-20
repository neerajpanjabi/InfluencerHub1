import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService, AuditContext } from '../../common/services/audit.service';
import { SocialService } from '../social/social.service';

/**
 * Data-subject rights (UAE PDPL-oriented — legal review required): consent records, export,
 * deletion. Deletion ANONYMISES personal data; financial history (orders, payments, invoices,
 * ledger, commissions, payouts) is retained as required for tax/accounting and is never deleted.
 */
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly social: SocialService) {}

  async recordConsent(userId: string, type: any, granted: boolean, version: string, ip?: string) {
    return this.prisma.consentRecord.create({ data: { userId, type, granted, version, ipAddress: ip } });
  }

  consents(userId: string) {
    return this.prisma.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, type: true, locale: true, createdAt: true,
        businessProfile: { include: { categories: true, orders: { include: { items: true } }, savedInfluencers: true, contactPurchases: true, reviews: true } },
        influencerProfile: { include: { categories: true, services: true, packages: true, socialAccounts: { select: { platform: true, username: true, connectedAt: true, status: true, snapshots: { take: 500, orderBy: { collectedAt: 'desc' } } } }, scoreHistory: true, medicalCredentials: true } },
        consentRecords: true,
        notifications: { take: 200, orderBy: { createdAt: 'desc' } },
        messages: { take: 1000, orderBy: { createdAt: 'desc' }, select: { body: true, createdAt: true, conversationId: true } },
      },
    });
    await this.audit.log({ actorId: userId }, 'privacy.export', 'User', userId);
    return { exportedAt: new Date().toISOString(), data: user };
  }

  async requestDeletion(userId: string, reason?: string) {
    const open = await this.prisma.dataDeletionRequest.findFirst({ where: { userId, status: { in: ['REQUESTED', 'PROCESSING'] } } });
    if (open) return open;
    const active = await this.prisma.campaign.count({ where: { OR: [{ business: { userId } }, { influencer: { userId } }], status: { in: ['CONFIRMED', 'IN_PROGRESS', 'CONTENT_SUBMITTED', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED', 'DISPUTED'] } } });
    const r = await this.prisma.dataDeletionRequest.create({ data: { userId, reason, notes: active ? `User has ${active} active campaign(s); process after completion.` : null } });
    await this.audit.log({ actorId: userId }, 'privacy.deletion.request', 'DataDeletionRequest', r.id);
    return r;
  }

  async processDeletion(ctx: AuditContext, requestId: string) {
    const req = await this.prisma.dataDeletionRequest.findUniqueOrThrow({ where: { id: requestId }, include: { user: { include: { influencerProfile: { include: { socialAccounts: true } }, businessProfile: true } } } });
    if (req.status === 'COMPLETED') return req;
    const u = req.user;
    const active = await this.prisma.campaign.count({ where: { OR: [{ business: { userId: u.id } }, { influencer: { userId: u.id } }], status: { in: ['CONFIRMED', 'IN_PROGRESS', 'CONTENT_SUBMITTED', 'AWAITING_APPROVAL', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED', 'DISPUTED'] } } });
    if (active) throw new BadRequestException({ code: 'ACTIVE_CAMPAIGNS_EXIST', count: active });
    await this.prisma.dataDeletionRequest.update({ where: { id: requestId }, data: { status: 'PROCESSING' } });
    for (const acc of u.influencerProfile?.socialAccounts ?? []) {
      if (acc.status !== 'DISCONNECTED') await this.social.disconnect(u.id, acc.id, true).catch(() => undefined);
    }
    const anon = `deleted-${u.id}@deleted.influencehub.invalid`;
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.authAccount.deleteMany({ where: { userId: u.id } });
      await tx.oneTimeToken.deleteMany({ where: { userId: u.id } });
      await tx.user.update({ where: { id: u.id }, data: { email: anon, phone: null, passwordHash: null, twoFactorSecret: null, twoFactorEnabled: false, status: 'DELETED', deletedAt: new Date() } });
      if (u.influencerProfile) {
        await tx.influencerProfile.update({
          where: { id: u.influencerProfile.id },
          data: { fullName: 'Deleted user', displayName: 'Deleted creator', displayNameAr: null, bio: null, bioAr: null, phone: null, profileImageUrl: null, coverImageUrl: null, isPublic: false, searchText: null, slug: `deleted-${u.influencerProfile.id}`, deletedAt: new Date() },
        });
        await tx.socialMediaPost.deleteMany({ where: { socialAccount: { influencerId: u.influencerProfile.id } } });
        await tx.audienceInsight.deleteMany({ where: { socialAccount: { influencerId: u.influencerProfile.id } } });
        await tx.influencerService.updateMany({ where: { influencerId: u.influencerProfile.id }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
      }
      if (u.businessProfile) {
        await tx.businessProfile.update({ where: { id: u.businessProfile.id }, data: { contactPerson: 'Deleted user', businessEmail: anon, phone: null, logoUrl: null, description: null, website: null, deletedAt: new Date() } });
      }
      await tx.message.updateMany({ where: { senderId: u.id }, data: { body: '[deleted]', status: 'REMOVED' } });
      await tx.dataDeletionRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', processedAt: new Date() } });
    });
    await this.audit.log(ctx, 'privacy.deletion.completed', 'User', u.id);
    return { ok: true };
  }
}
