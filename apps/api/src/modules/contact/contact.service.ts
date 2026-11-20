import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { calculateVat, entitlementExpiry, evaluateContact, fromMinor, toMinor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { env } from '../../config/env';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async context(userId: string, influencerId: string) {
    const business = await this.prisma.businessProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!business) throw new ForbiddenException({ code: 'BUSINESS_ONLY' });
    const influencer = await this.prisma.influencerProfile.findFirst({ where: { id: influencerId, deletedAt: null }, include: { user: true } });
    if (!influencer) throw new NotFoundException();
    const settings = await this.settings.contact();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [entitlements, freeUsed, today, blocked] = await Promise.all([
      this.prisma.contactEntitlement.findMany({ where: { businessId: business.id, influencerId } }),
      this.prisma.contactEntitlement.count({ where: { businessId: business.id, source: 'FREE_ALLOWANCE' } }),
      this.prisma.contactEntitlement.count({ where: { businessId: business.id, createdAt: { gte: startOfDay }, source: { in: ['PURCHASE', 'FREE_ALLOWANCE'] } } }),
      this.prisma.userBlock.findFirst({ where: { OR: [{ blockerId: influencer.userId, blockedId: userId }, { blockerId: userId, blockedId: influencer.userId }] } }),
    ]);
    const decision = evaluateContact({
      entitlements,
      influencerContactable: influencer.isPublic && influencer.user.status === 'ACTIVE',
      blocked: !!blocked,
      businessActive: business.user.status === 'ACTIVE',
      freeContactsUsed: freeUsed,
      adminFreeCredits: business.freeContactCredits,
      contactsUnlockedToday: today,
      settings,
    });
    return { business, influencer, settings, decision };
  }

  async status(userId: string, influencerId: string) {
    const { decision, settings } = await this.context(userId, influencerId);
    const vat = calculateVat(toMinor(settings.contactFee), 'STANDARD', await this.settings.vat());
    return { ...decision, fee: settings.contactFee, vat: fromMinor(vat), total: fromMinor(toMinor(settings.contactFee) + vat), accessDurationDays: settings.accessDurationDays, refundPolicy: settings.refundPolicy };
  }

  /**
   * Unlock contact. Never charges when a valid entitlement exists. Uses free allowance when
   * requested and available. Otherwise creates (or reuses) a pending purchase + hosted checkout.
   */
  async unlock(userId: string, influencerId: string, opts: { useFreeCredit?: boolean; idempotencyKey: string }) {
    const { business, influencer, settings, decision } = await this.context(userId, influencerId);
    if (decision.allowed) {
      const conv = await this.ensureConversation(business.userId, influencer.userId);
      return { status: 'ALREADY_UNLOCKED', conversationId: conv.id };
    }
    if (decision.reason !== 'PAYMENT_REQUIRED') {
      if (decision.reason === 'DAILY_LIMIT_REACHED') throw new HttpException({ code: decision.reason }, HttpStatus.TOO_MANY_REQUESTS);
      throw new ForbiddenException({ code: decision.reason });
    }
    if (opts.useFreeCredit) {
      if (!decision.freeAllowanceAvailable) throw new BadRequestException({ code: 'NO_FREE_CONTACTS_LEFT' });
      const conv = await this.prisma.$transaction(async (tx) => {
        await tx.contactEntitlement.updateMany({ where: { businessId: business.id, influencerId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contactEntitlement.create({ data: { businessId: business.id, influencerId, source: 'FREE_ALLOWANCE', expiresAt: entitlementExpiry(settings) } });
        return this.ensureConversation(business.userId, influencer.userId, tx);
      });
      await this.audit.log({ actorId: userId }, 'contact.unlock.free', 'InfluencerProfile', influencerId);
      await this.notifications.notify(influencer.userId, 'NEW_ENQUIRY', { business: business.businessName }, `/influencer/messages?c=${conv.id}`);
      return { status: 'UNLOCKED', conversationId: conv.id };
    }
    // Reuse a pending purchase for the same pair to avoid duplicate charges.
    const pending = await this.prisma.contactPurchase.findFirst({
      where: { businessId: business.id, influencerId, status: { in: ['CREATED', 'PENDING'] }, createdAt: { gt: new Date(Date.now() - 30 * 60_000) } },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (pending?.payments[0]) {
      const r = await this.payments.startCheckout(pending.payments[0], `Contact ${influencer.displayName}`, `/en/creators/${influencer.slug}?contact=success`, `/en/creators/${influencer.slug}`, business.user.email);
      return { status: 'PAYMENT_REQUIRED', ...r };
    }
    const vatCfg = await this.settings.vat();
    const feeMinor = toMinor(settings.contactFee);
    const vatMinor = calculateVat(feeMinor, 'STANDARD', vatCfg);
    const { purchase, payment } = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.contactPurchase.create({
        data: { businessId: business.id, influencerId, amount: fromMinor(feeMinor), vatAmount: fromMinor(vatMinor), totalAmount: fromMinor(feeMinor + vatMinor), status: 'PENDING', idempotencyKey: `${business.id}:${opts.idempotencyKey}` },
      });
      const payment = await tx.payment.create({ data: { purpose: 'CONTACT', contactPurchaseId: purchase.id, provider: env().PAYMENT_PROVIDER, amount: purchase.totalAmount, idempotencyKey: `contact-${purchase.id}` } });
      return { purchase, payment };
    });
    await this.audit.log({ actorId: userId }, 'contact.purchase.created', 'ContactPurchase', purchase.id, undefined, { influencerId, total: purchase.totalAmount.toString() });
    const r = await this.payments.startCheckout(payment, `Contact access — ${influencer.displayName}`, `/en/creators/${influencer.slug}?contact=success`, `/en/creators/${influencer.slug}`, business.user.email);
    return { status: 'PAYMENT_REQUIRED', purchaseId: purchase.id, ...r };
  }

  async ensureConversation(businessUserId: string, influencerUserId: string, tx: any = this.prisma) {
    return tx.conversation.upsert({
      where: { businessUserId_influencerUserId: { businessUserId, influencerUserId } },
      update: {},
      create: { businessUserId, influencerUserId, participants: { create: [{ userId: businessUserId }, { userId: influencerUserId }] } },
    });
  }

  async myPurchases(userId: string) {
    const b = await this.prisma.businessProfile.findUnique({ where: { userId } });
    if (!b) throw new ForbiddenException();
    return this.prisma.contactEntitlement.findMany({ where: { businessId: b.id }, orderBy: { createdAt: 'desc' }, include: { influencer: { select: { displayName: true, slug: true } }, purchase: { select: { totalAmount: true, status: true } } } });
  }
}
