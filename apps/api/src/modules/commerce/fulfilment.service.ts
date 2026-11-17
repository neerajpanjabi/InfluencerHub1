import { Injectable, Logger } from '@nestjs/common';
import { Payment, Prisma } from '@influencehub/database';
import { entitlementExpiry, toMinor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { LedgerService, nextNumber } from '../finance/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Applies the business consequences of a confirmed payment inside the webhook transaction. */
@Injectable()
export class FulfilmentService {
  private readonly logger = new Logger(FulfilmentService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async onPaymentSucceeded(tx: Prisma.TransactionClient, payment: Payment): Promise<() => Promise<void>> {
    if (payment.purpose === 'CONTACT') return this.fulfilContact(tx, payment);
    return this.fulfilOrder(tx, payment);
  }

  async onPaymentFailed(tx: Prisma.TransactionClient, payment: Payment): Promise<() => Promise<void>> {
    if (payment.contactPurchaseId) {
      await tx.contactPurchase.update({ where: { id: payment.contactPurchaseId }, data: { status: 'FAILED' } });
    }
    let userId: string | undefined;
    let reference = '';
    if (payment.orderId) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { business: true } });
      userId = order.business.userId;
      reference = order.number;
      // The order stays PENDING_PAYMENT so the business can retry; campaigns remain PAYMENT_PENDING.
    } else if (payment.contactPurchaseId) {
      const cp = await tx.contactPurchase.findUniqueOrThrow({ where: { id: payment.contactPurchaseId }, include: { business: true } });
      userId = cp.business.userId;
      reference = 'contact unlock';
    }
    return async () => {
      if (userId) await this.notifications.notify(userId, 'PAYMENT_FAILED', { reference }, '/business/payments');
    };
  }

  private async fulfilContact(tx: Prisma.TransactionClient, payment: Payment) {
    const cp = await tx.contactPurchase.findUniqueOrThrow({ where: { id: payment.contactPurchaseId! }, include: { business: true, influencer: true } });
    await tx.contactPurchase.update({ where: { id: cp.id }, data: { status: 'SUCCEEDED' } });
    const existing = await tx.contactEntitlement.findFirst({ where: { businessId: cp.businessId, influencerId: cp.influencerId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    const settings = await this.settings.contact();
    if (!existing) {
      // Expired-but-unrevoked entitlements are revoked so the "one live entitlement" index holds.
      await tx.contactEntitlement.updateMany({ where: { businessId: cp.businessId, influencerId: cp.influencerId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.contactEntitlement.create({ data: { businessId: cp.businessId, influencerId: cp.influencerId, source: 'PURCHASE', purchaseId: cp.id, expiresAt: entitlementExpiry(settings) } });
    }
    const conv = await tx.conversation.upsert({
      where: { businessUserId_influencerUserId: { businessUserId: cp.business.userId, influencerUserId: cp.influencer.userId } },
      update: { isLocked: false },
      create: { businessUserId: cp.business.userId, influencerUserId: cp.influencer.userId, participants: { create: [{ userId: cp.business.userId }, { userId: cp.influencer.userId }] } },
    });
    const amount = toMinor(cp.amount.toString());
    const vat = toMinor(cp.vatAmount.toString());
    await this.ledger.post(tx, { type: 'CONTACT_PURCHASE', id: cp.id }, [
      { account: 'CASH_CLEARING', direction: 'DEBIT', amountMinor: amount + vat, businessId: cp.businessId, description: 'Contact fee received' },
      { account: 'PLATFORM_CONTACT_FEE_REVENUE', direction: 'CREDIT', amountMinor: amount, businessId: cp.businessId, influencerId: cp.influencerId, description: 'Contact fee revenue' },
      { account: 'VAT_PAYABLE', direction: 'CREDIT', amountMinor: vat, businessId: cp.businessId, description: 'VAT on contact fee' },
    ]);
    await this.postProcessingFee(tx, payment, cp.businessId);
    await this.issueInvoice(tx, { contactPurchaseId: cp.id, business: cp.business, lines: [{ description: `Contact access — ${cp.influencer.displayName}`, net: cp.amount.toString(), vat: cp.vatAmount.toString() }], subtotal: cp.amount.toString(), vatTotal: cp.vatAmount.toString(), total: cp.totalAmount.toString() });
    if (existing) {
      // Defensive: a duplicate entitlement purchase is flagged for automatic refund review.
      await tx.refund.create({ data: { paymentId: payment.id, amount: cp.totalAmount, reason: 'DUPLICATE_CONTACT_ENTITLEMENT', idempotencyKey: `dup-contact-${payment.id}`, status: 'REQUESTED' } });
    }
    return async () => {
      await this.notifications.notify(cp.business.userId, 'CONTACT_PURCHASED', { name: cp.influencer.displayName }, `/business/messages?c=${conv.id}`);
      await this.notifications.notify(cp.influencer.userId, 'NEW_ENQUIRY', { business: cp.business.businessName }, `/influencer/messages?c=${conv.id}`);
      await this.notifications.notify(cp.business.userId, 'PAYMENT_SUCCEEDED', { amount: cp.totalAmount.toString(), reference: 'contact unlock' }, '/business/payments');
    };
  }

  private async fulfilOrder(tx: Prisma.TransactionClient, payment: Payment) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId! },
      include: { business: true, items: { include: { influencer: { include: { categories: true } }, campaign: true } } },
    });
    if (order.status === 'PAID') return async () => undefined;
    await tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() } });

    const lines: Parameters<LedgerService['post']>[2] = [{ account: 'CASH_CLEARING', direction: 'DEBIT', amountMinor: toMinor(order.grandTotal.toString()), businessId: order.businessId, description: `Order ${order.number} payment` }];
    const notify: Array<() => Promise<void>> = [];
    for (const item of order.items) {
      const primaryCat = item.influencer.categories.find((c) => c.isPrimary)?.categoryId ?? null;
      const totalComm = toMinor(item.businessCommission.toString()) + toMinor(item.influencerCommission.toString());
      await tx.commission.create({
        data: {
          orderItemId: item.id,
          influencerId: item.influencerId,
          grossAmount: item.grossAmount,
          rate: item.commissionRate,
          payer: item.commissionPayer,
          businessPortion: item.businessCommission,
          influencerPortion: item.influencerCommission,
          totalCommission: new Prisma.Decimal((totalComm / 100).toFixed(2)),
          influencerNet: item.influencerNet,
        },
      });
      lines.push(
        { account: 'INFLUENCER_PAYABLE', direction: 'CREDIT', amountMinor: toMinor(item.influencerNet.toString()), influencerId: item.influencerId, businessId: order.businessId, categoryId: primaryCat, description: `Creator payable ${order.number}` },
        { account: 'PLATFORM_COMMISSION_REVENUE', direction: 'CREDIT', amountMinor: totalComm, influencerId: item.influencerId, businessId: order.businessId, categoryId: primaryCat, description: `Commission ${order.number}` },
        { account: 'VAT_PAYABLE', direction: 'CREDIT', amountMinor: toMinor(item.vatAmount.toString()), influencerId: item.influencerId, businessId: order.businessId, categoryId: primaryCat, description: `VAT ${order.number}` },
      );
      // Booking creates/extends a contact entitlement so the parties can communicate.
      const live = await tx.contactEntitlement.findFirst({ where: { businessId: order.businessId, influencerId: item.influencerId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (!live) {
        await tx.contactEntitlement.updateMany({ where: { businessId: order.businessId, influencerId: item.influencerId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.contactEntitlement.create({ data: { businessId: order.businessId, influencerId: item.influencerId, source: 'BOOKING' } });
      }
      await tx.conversation.upsert({
        where: { businessUserId_influencerUserId: { businessUserId: order.business.userId, influencerUserId: item.influencer.userId } },
        update: { isLocked: false },
        create: { businessUserId: order.business.userId, influencerUserId: item.influencer.userId, participants: { create: [{ userId: order.business.userId }, { userId: item.influencer.userId }] } },
      });
      if (item.campaign) {
        await tx.campaign.update({ where: { id: item.campaign.id }, data: { status: 'CONFIRMED' } });
        await tx.campaignEvent.create({ data: { campaignId: item.campaign.id, fromStatus: item.campaign.status, toStatus: 'CONFIRMED', note: `Payment received (${order.number})` } });
        if (item.quotationId) await tx.quotation.update({ where: { id: item.quotationId }, data: { campaignId: item.campaign.id } });
        const camp = item.campaign;
        notify.push(() => this.notifications.notify(item.influencer.userId, 'BOOKING_CONFIRMED', { number: order.number, service: item.description, campaign: camp.number }, `/influencer/campaigns/${camp.id}`));
      }
    }
    await this.ledger.post(tx, { type: 'ORDER', id: order.id }, lines);
    await this.postProcessingFee(tx, payment, order.businessId);
    await this.issueInvoice(tx, {
      orderId: order.id,
      business: order.business,
      lines: order.items.map((i) => ({ description: i.description, quantity: i.quantity, net: (Number(i.grossAmount) + Number(i.businessCommission)).toFixed(2), vat: i.vatAmount.toString(), commissionIncluded: i.businessCommission.toString() })),
      subtotal: (Number(order.subtotal) - Number(order.discountTotal) + Number(order.businessCommissionTotal)).toFixed(2),
      vatTotal: order.vatTotal.toString(),
      total: order.grandTotal.toString(),
    });
    return async () => {
      await this.notifications.notify(order.business.userId, 'PAYMENT_SUCCEEDED', { amount: order.grandTotal.toString(), reference: order.number }, `/business/orders/${order.id}`);
      for (const n of notify) await n();
    };
  }

  private async postProcessingFee(tx: Prisma.TransactionClient, payment: Payment, businessId: string) {
    if (!payment.processingFee) return;
    const fee = toMinor(payment.processingFee.toString());
    if (fee <= 0) return;
    await this.ledger.post(tx, { type: 'PAYMENT', id: payment.id }, [
      { account: 'PROCESSING_FEE_EXPENSE', direction: 'DEBIT', amountMinor: fee, businessId, description: `Processing fee (${payment.provider})` },
      { account: 'CASH_CLEARING', direction: 'CREDIT', amountMinor: fee, businessId, description: `Processing fee (${payment.provider})` },
    ]);
  }

  private async issueInvoice(
    tx: Prisma.TransactionClient,
    d: { orderId?: string; contactPurchaseId?: string; business: { businessName: string; businessEmail: string; trnNumber: string | null; emirate: string | null; city: string | null }; lines: unknown[]; subtotal: string; vatTotal: string; total: string },
  ) {
    const platform = await this.settings.platform();
    return tx.invoice.create({
      data: {
        number: await nextNumber(tx, 'invoice_number_seq', 'INV'),
        orderId: d.orderId,
        contactPurchaseId: d.contactPurchaseId,
        issuedTo: { name: d.business.businessName, email: d.business.businessEmail, trn: d.business.trnNumber, emirate: d.business.emirate, city: d.business.city },
        issuedBy: { name: platform.legalName, trn: platform.trn, address: platform.address },
        lines: d.lines as Prisma.InputJsonValue,
        subtotal: d.subtotal,
        vatTotal: d.vatTotal,
        total: d.total,
      },
    });
  }
}
