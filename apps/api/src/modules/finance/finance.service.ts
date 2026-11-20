import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { fromMinor, toMinor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { SettingsService } from '../../common/services/settings.service';
import { LedgerService } from './ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  // ── Refunds ─────────────────────────────────────────────────────
  /**
   * Refund (part of) an order line or a contact purchase. Server computes the reversal split
   * (creator payable / commission / VAT) proportionally; ledger reversal is posted atomically.
   */
  async refund(actorId: string, dto: { orderItemId?: string; contactPurchaseId?: string; amount: number; reason: string }) {
    const idem = `refund-${dto.orderItemId ?? dto.contactPurchaseId}-${toMinor(String(dto.amount))}-${Date.now()}`;
    if (dto.orderItemId) {
      const item = await this.prisma.orderItem.findUnique({ where: { id: dto.orderItemId }, include: { order: { include: { payments: { where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED'] } } }, business: true } }, commission: true, campaign: true } });
      if (!item) throw new NotFoundException();
      const payment = item.order.payments[0];
      if (!payment) throw new BadRequestException({ code: 'ORDER_NOT_PAID' });
      const lineTotal = toMinor(item.grossAmount.toString()) + toMinor(item.businessCommission.toString()) + toMinor(item.vatAmount.toString());
      const already = toMinor(item.refundedAmount.toString());
      const R = toMinor(String(dto.amount));
      if (R <= 0 || R + already > lineTotal) throw new BadRequestException({ code: 'REFUND_EXCEEDS_REFUNDABLE', refundable: fromMinor(lineTotal - already) });
      if (item.commission?.payoutId) throw new BadRequestException({ code: 'ALREADY_PAID_OUT' });
      const provider = this.payments.provider(payment.provider);
      const result = await provider.refund({ providerPaymentId: payment.providerPaymentId ?? '', amountMinor: R, idempotencyKey: idem, reason: dto.reason });
      if (result.status === 'FAILED') throw new BadRequestException({ code: 'PROVIDER_REFUND_FAILED' });
      const ratio = R / lineTotal;
      const vatRev = Math.round(toMinor(item.vatAmount.toString()) * ratio);
      const netRev = Math.round(toMinor(item.influencerNet.toString()) * ratio);
      const commRev = R - vatRev - netRev;
      const refund = await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: { paymentId: payment.id, orderId: item.orderId, orderItemId: item.id, amount: fromMinor(R), reason: dto.reason, status: result.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'PROCESSING', providerRefundId: result.providerRefundId, idempotencyKey: idem, requestedById: actorId, approvedById: actorId },
        });
        await tx.orderItem.update({ where: { id: item.id }, data: { refundedAmount: { increment: fromMinor(R) } } });
        if (item.commission) await tx.commission.update({ where: { id: item.commission.id }, data: { reversedAmount: { increment: fromMinor(netRev) } } });
        await this.ledger.post(tx, { type: 'REFUND', id: refund.id }, [
          { account: 'INFLUENCER_PAYABLE', direction: 'DEBIT', amountMinor: netRev, influencerId: item.influencerId, businessId: item.order.businessId, description: `Refund reversal ${item.order.number}` },
          { account: 'PLATFORM_COMMISSION_REVENUE', direction: 'DEBIT', amountMinor: commRev, influencerId: item.influencerId, businessId: item.order.businessId, description: `Commission reversal ${item.order.number}` },
          { account: 'VAT_PAYABLE', direction: 'DEBIT', amountMinor: vatRev, businessId: item.order.businessId, description: `VAT reversal ${item.order.number}` },
          { account: 'REFUNDS', direction: 'CREDIT', amountMinor: R, businessId: item.order.businessId, description: `Refund paid ${item.order.number}` },
        ]);
        const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId }, include: { items: true } });
        const totalRefunded = order.items.reduce((a, i) => a + toMinor(i.refundedAmount.toString()), 0);
        const fully = totalRefunded >= toMinor(order.grandTotal.toString());
        await tx.order.update({ where: { id: order.id }, data: { status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        await tx.payment.update({ where: { id: payment.id }, data: { status: fully ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        if (item.campaign && R + already >= lineTotal && !['COMPLETED', 'CANCELLED'].includes(item.campaign.status)) {
          await tx.campaign.update({ where: { id: item.campaign.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
          await tx.campaignEvent.create({ data: { campaignId: item.campaign.id, actorId, fromStatus: item.campaign.status, toStatus: 'CANCELLED', note: 'Fully refunded' } });
        }
        await this.audit.log({ actorId }, 'finance.refund', 'Refund', refund.id, undefined, { amount: fromMinor(R), orderItemId: item.id, reason: dto.reason }, tx);
        return refund;
      });
      await this.notifications.notify(item.order.business.userId, 'REFUND_UPDATED', { amount: fromMinor(R), status: refund.status }, `/business/orders/${item.orderId}`);
      return refund;
    }
    if (dto.contactPurchaseId) {
      const cp = await this.prisma.contactPurchase.findUnique({ where: { id: dto.contactPurchaseId }, include: { payments: { where: { status: 'SUCCEEDED' } }, business: true, entitlement: true } });
      if (!cp || !cp.payments[0]) throw new BadRequestException({ code: 'NOT_REFUNDABLE' });
      const R = toMinor(cp.totalAmount.toString());
      if (toMinor(String(dto.amount)) !== R) throw new BadRequestException({ code: 'CONTACT_REFUND_MUST_BE_FULL' });
      const payment = cp.payments[0];
      const result = await this.payments.provider(payment.provider).refund({ providerPaymentId: payment.providerPaymentId ?? '', amountMinor: R, idempotencyKey: idem, reason: dto.reason });
      if (result.status === 'FAILED') throw new BadRequestException({ code: 'PROVIDER_REFUND_FAILED' });
      const refund = await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refund.create({ data: { paymentId: payment.id, amount: cp.totalAmount, reason: dto.reason, status: 'SUCCEEDED', providerRefundId: result.providerRefundId, idempotencyKey: idem, requestedById: actorId, approvedById: actorId } });
        await tx.contactPurchase.update({ where: { id: cp.id }, data: { status: 'REFUNDED' } });
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
        if (cp.entitlement && !cp.entitlement.revokedAt) await tx.contactEntitlement.update({ where: { id: cp.entitlement.id }, data: { revokedAt: new Date() } });
        await this.ledger.post(tx, { type: 'REFUND', id: refund.id }, [
          { account: 'PLATFORM_CONTACT_FEE_REVENUE', direction: 'DEBIT', amountMinor: toMinor(cp.amount.toString()), businessId: cp.businessId, description: 'Contact fee refund' },
          { account: 'VAT_PAYABLE', direction: 'DEBIT', amountMinor: toMinor(cp.vatAmount.toString()), businessId: cp.businessId, description: 'VAT reversal (contact fee)' },
          { account: 'REFUNDS', direction: 'CREDIT', amountMinor: R, businessId: cp.businessId, description: 'Contact fee refund paid' },
        ]);
        await this.audit.log({ actorId }, 'finance.refund.contact', 'Refund', refund.id, undefined, { contactPurchaseId: cp.id }, tx);
        return refund;
      });
      await this.notifications.notify(cp.business.userId, 'REFUND_UPDATED', { amount: cp.totalAmount.toString(), status: 'SUCCEEDED' }, '/business/payments');
      return refund;
    }
    throw new BadRequestException({ code: 'REFUND_TARGET_REQUIRED' });
  }

  listRefunds(status?: string) {
    return this.prisma.refund.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { payment: { select: { purpose: true, provider: true } }, order: { select: { number: true } } } });
  }

  // ── Payouts ─────────────────────────────────────────────────────
  /** Creator earnings: released (campaign completed + hold elapsed) vs pending, paid out. */
  async earnings(influencerUserId: string) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId: influencerUserId } });
    const commissions = await this.prisma.commission.findMany({ where: { influencerId: p.id }, include: { orderItem: { select: { description: true, order: { select: { number: true, paidAt: true } }, campaign: { select: { number: true, status: true } } } } }, orderBy: { createdAt: 'desc' } });
    const hold = (await this.settings.platform()).payoutHoldDays;
    const now = Date.now();
    let pending = 0, available = 0, paid = 0;
    for (const c of commissions) {
      const net = toMinor(c.influencerNet.toString()) - toMinor(c.reversedAmount.toString());
      if (c.payoutId) paid += net;
      else if (c.releasedAt && c.releasedAt.getTime() + hold * 86_400_000 <= now) available += net;
      else pending += net;
    }
    const payouts = await this.prisma.payout.findMany({ where: { influencerId: p.id }, orderBy: { createdAt: 'desc' } });
    return { pending: fromMinor(pending), available: fromMinor(available), paidOut: fromMinor(paid), commissions, payouts, holdDays: hold };
  }

  /** Finance admin: batch eligible released commissions into a payout per creator. */
  async createPayouts(actorId: string) {
    const hold = (await this.settings.platform()).payoutHoldDays;
    const cutoff = new Date(Date.now() - hold * 86_400_000);
    const eligible = await this.prisma.commission.findMany({ where: { payoutId: null, releasedAt: { lte: cutoff } } });
    const byInf = new Map<string, typeof eligible>();
    for (const c of eligible) byInf.set(c.influencerId, [...(byInf.get(c.influencerId) ?? []), c]);
    const created = [];
    for (const [influencerId, list] of byInf) {
      const amount = list.reduce((a, c) => a + toMinor(c.influencerNet.toString()) - toMinor(c.reversedAmount.toString()), 0);
      if (amount <= 0) continue;
      const payout = await this.prisma.$transaction(async (tx) => {
        const payout = await tx.payout.create({ data: { influencerId, amount: fromMinor(amount), commissionIds: list.map((c) => c.id), status: 'PENDING', method: 'bank_transfer' } });
        await tx.commission.updateMany({ where: { id: { in: list.map((c) => c.id) }, payoutId: null }, data: { payoutId: payout.id } });
        await this.audit.log({ actorId }, 'finance.payout.create', 'Payout', payout.id, undefined, { amount: fromMinor(amount) }, tx);
        return payout;
      });
      created.push(payout);
    }
    return created;
  }

  async markPayoutPaid(actorId: string, payoutId: string, reference: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId }, include: { influencer: true } });
    if (!payout) throw new NotFoundException();
    if (payout.status === 'PAID') return payout;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.payout.update({ where: { id: payoutId }, data: { status: 'PAID', paidAt: new Date(), reference } });
      await this.ledger.post(tx, { type: 'PAYOUT', id: payoutId }, [
        { account: 'INFLUENCER_PAYABLE', direction: 'DEBIT', amountMinor: toMinor(payout.amount.toString()), influencerId: payout.influencerId, description: `Payout ${reference}` },
        { account: 'PAYOUTS', direction: 'CREDIT', amountMinor: toMinor(payout.amount.toString()), influencerId: payout.influencerId, description: `Payout ${reference}` },
      ]);
      await this.audit.log({ actorId }, 'finance.payout.paid', 'Payout', payoutId, { status: payout.status }, { status: 'PAID', reference }, tx);
      return u;
    });
    await this.notifications.notify(payout.influencer.userId, 'PAYOUT_UPDATED', { amount: payout.amount.toString(), status: 'PAID' }, '/influencer/payouts');
    return updated;
  }

  async setPayoutStatus(actorId: string, payoutId: string, status: 'ON_HOLD' | 'SCHEDULED' | 'PROCESSING' | 'FAILED') {
    const p = await this.prisma.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { influencer: true } });
    if (p.status === 'PAID') throw new BadRequestException({ code: 'PAYOUT_ALREADY_PAID' });
    const u = await this.prisma.payout.update({ where: { id: payoutId }, data: { status } });
    if (status === 'FAILED') await this.prisma.commission.updateMany({ where: { payoutId }, data: { payoutId: null } });
    await this.audit.log({ actorId }, 'finance.payout.status', 'Payout', payoutId, { status: p.status }, { status });
    await this.notifications.notify(p.influencer.userId, 'PAYOUT_UPDATED', { amount: p.amount.toString(), status }, '/influencer/payouts');
    return u;
  }

  listPayouts(status?: string) {
    return this.prisma.payout.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { influencer: { select: { displayName: true, slug: true } } } });
  }

  // ── Reporting (ledger-derived, never frontend-calculated) ───────
  async revenueReport(from: Date, to: Date, groupBy: 'day' | 'week' | 'month') {
    const trunc = groupBy;
    const rows = await this.prisma.$queryRaw<Array<{ period: Date; account: string; direction: string; total: Prisma.Decimal }>>`
      SELECT date_trunc(${trunc}, "createdAt") AS period, account, direction, SUM(amount) AS total
      FROM financial_ledger WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY 1, 2, 3 ORDER BY 1`;
    const periods = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const key = r.period.toISOString().slice(0, 10);
      const m = periods.get(key) ?? {};
      const sign = ['CASH_CLEARING', 'PROCESSING_FEE_EXPENSE'].includes(r.account) ? (r.direction === 'DEBIT' ? 1 : -1) : r.direction === 'CREDIT' ? 1 : -1;
      m[r.account] = Math.round(((m[r.account] ?? 0) + sign * Number(r.total)) * 100) / 100;
      periods.set(key, m);
    }
    const gbv = await this.prisma.$queryRaw<Array<{ period: Date; gbv: Prisma.Decimal; orders: bigint }>>`
      SELECT date_trunc(${trunc}, "paidAt") AS period, SUM("subtotal" - "discountTotal") AS gbv, COUNT(*) AS orders
      FROM orders WHERE "paidAt" >= ${from} AND "paidAt" < ${to} GROUP BY 1 ORDER BY 1`;
    const gbvMap = new Map(gbv.map((g) => [g.period.toISOString().slice(0, 10), { gbv: Number(g.gbv), orders: Number(g.orders) }]));
    const keys = Array.from(new Set([...periods.keys(), ...gbvMap.keys()])).sort();
    return keys.map((k) => {
      const m = periods.get(k) ?? {};
      const commission = m.PLATFORM_COMMISSION_REVENUE ?? 0;
      const contact = m.PLATFORM_CONTACT_FEE_REVENUE ?? 0;
      const fees = m.PROCESSING_FEE_EXPENSE ?? 0;
      return {
        period: k,
        grossBookingValue: gbvMap.get(k)?.gbv ?? 0,
        paidOrders: gbvMap.get(k)?.orders ?? 0,
        commissionRevenue: commission,
        contactFeeRevenue: contact,
        vatCollected: m.VAT_PAYABLE ?? 0,
        refunds: m.REFUNDS ?? 0,
        processingFees: fees,
        influencerPayable: m.INFLUENCER_PAYABLE ?? 0,
        payouts: m.PAYOUTS ?? 0,
        platformNetRevenue: Math.round((commission + contact - fees) * 100) / 100,
      };
    });
  }

  async breakdown(dimension: 'category' | 'influencer' | 'business', from: Date, to: Date) {
    const col = dimension === 'category' ? Prisma.sql`"categoryId"` : dimension === 'influencer' ? Prisma.sql`"influencerId"` : Prisma.sql`"businessId"`;
    const rows = await this.prisma.$queryRaw<Array<{ key: string | null; account: string; direction: string; total: Prisma.Decimal }>>`
      SELECT ${col} AS key, account, direction, SUM(amount) AS total FROM financial_ledger
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND account IN ('PLATFORM_COMMISSION_REVENUE','PLATFORM_CONTACT_FEE_REVENUE','INFLUENCER_PAYABLE')
      GROUP BY 1, 2, 3`;
    const agg = new Map<string, { commission: number; contactFees: number; creatorEarnings: number }>();
    for (const r of rows) {
      const k = r.key ?? 'unassigned';
      const a = agg.get(k) ?? { commission: 0, contactFees: 0, creatorEarnings: 0 };
      const v = Number(r.total) * (r.direction === 'CREDIT' ? 1 : -1);
      if (r.account === 'PLATFORM_COMMISSION_REVENUE') a.commission += v;
      if (r.account === 'PLATFORM_CONTACT_FEE_REVENUE') a.contactFees += v;
      if (r.account === 'INFLUENCER_PAYABLE') a.creatorEarnings += v;
      agg.set(k, a);
    }
    const ids = [...agg.keys()].filter((k) => k !== 'unassigned');
    const names = new Map<string, string>();
    if (dimension === 'category') (await this.prisma.category.findMany({ where: { id: { in: ids } } })).forEach((c) => names.set(c.id, c.nameEn));
    if (dimension === 'influencer') (await this.prisma.influencerProfile.findMany({ where: { id: { in: ids } } })).forEach((c) => names.set(c.id, c.displayName));
    if (dimension === 'business') (await this.prisma.businessProfile.findMany({ where: { id: { in: ids } } })).forEach((c) => names.set(c.id, c.businessName));
    return [...agg.entries()].map(([k, v]) => ({ id: k, name: names.get(k) ?? k, ...Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, Math.round(vv * 100) / 100])) })).sort((a: any, b: any) => b.commission - a.commission);
  }

  /** Reconciles ledger cash-in against succeeded provider payments for a period. */
  async reconcile(provider: string, from: Date, to: Date) {
    const ledger = await this.prisma.$queryRaw<Array<{ total: Prisma.Decimal | null }>>`
      SELECT SUM(l.amount) AS total FROM financial_ledger l
      WHERE l.account = 'CASH_CLEARING' AND l.direction = 'DEBIT' AND l."createdAt" >= ${from} AND l."createdAt" < ${to}`;
    const pay = await this.prisma.payment.aggregate({ where: { provider, status: { in: ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'] }, succeededAt: { gte: from, lt: to } }, _sum: { amount: true } });
    const ledgerTotal = Number(ledger[0]?.total ?? 0);
    const providerTotal = Number(pay._sum.amount ?? 0);
    const diff = Math.round((ledgerTotal - providerTotal) * 100) / 100;
    return this.prisma.reconciliationRecord.create({ data: { provider, periodStart: from, periodEnd: to, ledgerTotal, providerTotal, difference: diff, status: diff === 0 ? 'MATCHED' : 'MISMATCH', details: { note: 'Provider total derived from internal payment records; import provider settlement reports for external reconciliation.' } } });
  }

  ledgerEntries(filter: { referenceId?: string; account?: string }, take = 200) {
    return this.prisma.financialLedger.findMany({ where: { ...(filter.referenceId ? { referenceId: filter.referenceId } : {}), ...(filter.account ? { account: filter.account as any } : {}) }, orderBy: { createdAt: 'desc' }, take });
  }
}
