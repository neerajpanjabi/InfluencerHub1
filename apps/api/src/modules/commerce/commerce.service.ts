import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { effectivePrice, fromMinor, toMinor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { env } from '../../config/env';
import { nextNumber } from '../finance/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { priceLines, PricedLineInput, serializeCart } from './pricing-calculator';

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      service: { include: { catalog: true, influencer: { include: { categories: true, user: { select: { status: true } } } } } },
      package: { include: { items: { include: { service: true } }, influencer: { include: { categories: true, user: { select: { status: true } } } } } },
      quotation: { include: { items: true, influencer: { include: { categories: true, user: { select: { status: true } } } } } },
    },
  },
} satisfies Prisma.CartInclude;
type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async business(userId: string) {
    const b = await this.prisma.businessProfile.findUnique({ where: { userId }, include: { user: { select: { email: true, status: true } } } });
    if (!b) throw new ForbiddenException();
    return b;
  }

  private async activeCart(businessId: string) {
    const existing = await this.prisma.cart.findFirst({ where: { businessId, status: 'ACTIVE' }, include: CART_INCLUDE });
    if (existing) return existing;
    try {
      return await this.prisma.cart.create({ data: { businessId }, include: CART_INCLUDE });
    } catch {
      return this.prisma.cart.findFirstOrThrow({ where: { businessId, status: 'ACTIVE' }, include: CART_INCLUDE });
    }
  }

  /** Converts cart rows into priced line inputs, validating current availability. */
  private toLineInputs(cart: CartWithItems, businessId: string): { inputs: PricedLineInput[]; problems: Array<{ itemId: string; code: string }> } {
    const inputs: PricedLineInput[] = [];
    const problems: Array<{ itemId: string; code: string }> = [];
    const now = new Date();
    for (const it of cart.items) {
      if (it.type === 'SERVICE' && it.service) {
        const s = it.service;
        const inf = s.influencer;
        if (s.status !== 'ACTIVE' || s.deletedAt || !inf.isPublic || !inf.acceptingBookings || inf.user.status !== 'ACTIVE') {
          problems.push({ itemId: it.id, code: 'SERVICE_UNAVAILABLE' });
          continue;
        }
        const addOns = ((s.addOns as Array<{ key: string; name: string; price: number }>) ?? []).filter((a) => it.addOnKeys.includes(a.key));
        inputs.push({
          key: it.id,
          influencerId: inf.id,
          influencerName: inf.displayName,
          description: s.title,
          platform: s.platform,
          quantity: it.quantity,
          unitPriceMinor: toMinor(String(effectivePrice(Number(s.price), s.promoPrice ? Number(s.promoPrice) : null, s.promoEndsAt, now))),
          addOnsMinor: addOns.reduce((a, x) => a + toMinor(String(x.price)), 0) * it.quantity,
          serviceKey: s.catalog.key,
          categoryId: inf.categories.find((c) => c.isPrimary)?.categoryId ?? inf.categories[0]?.categoryId ?? null,
          taxTreatment: s.taxTreatment,
          deliveryDays: s.deliveryDays,
          serviceId: s.id,
          snapshot: { title: s.title, deliverables: s.deliverables, revisions: s.revisions, usageRights: s.usageRights, exclusivityDays: s.exclusivityDays, addOns, price: s.price.toString(), promoPrice: s.promoPrice?.toString() ?? null, brief: it.brief },
        });
      } else if (it.type === 'PACKAGE' && it.package) {
        const p = it.package;
        const inf = p.influencer;
        if (p.status !== 'ACTIVE' || !inf.isPublic || !inf.acceptingBookings || inf.user.status !== 'ACTIVE') {
          problems.push({ itemId: it.id, code: 'PACKAGE_UNAVAILABLE' });
          continue;
        }
        inputs.push({
          key: it.id,
          influencerId: inf.id,
          influencerName: inf.displayName,
          description: p.title,
          platform: 'CROSS_PLATFORM',
          quantity: it.quantity,
          unitPriceMinor: toMinor(p.price.toString()),
          addOnsMinor: 0,
          categoryId: inf.categories.find((c) => c.isPrimary)?.categoryId ?? null,
          taxTreatment: 'STANDARD',
          deliveryDays: p.deliveryDays,
          packageId: p.id,
          snapshot: { title: p.title, items: p.items.map((x) => ({ title: x.service.title, quantity: x.quantity })), brief: it.brief },
        });
      } else if (it.type === 'QUOTATION' && it.quotation) {
        const q = it.quotation;
        if (q.businessId !== businessId || q.status !== 'ACCEPTED' || (q.validUntil && q.validUntil < now) || q.influencer.user.status !== 'ACTIVE') {
          problems.push({ itemId: it.id, code: 'QUOTATION_UNAVAILABLE' });
          continue;
        }
        const total = q.items.reduce((a, x) => a + toMinor(x.unitPrice.toString()) * x.quantity, 0);
        inputs.push({
          key: it.id,
          influencerId: q.influencerId,
          influencerName: q.influencer.displayName,
          description: `Custom quotation ${q.number}`,
          platform: q.items[0]?.platform ?? 'CROSS_PLATFORM',
          quantity: 1,
          unitPriceMinor: total,
          addOnsMinor: 0,
          categoryId: q.influencer.categories.find((c) => c.isPrimary)?.categoryId ?? null,
          taxTreatment: 'STANDARD',
          deliveryDays: Math.max(...q.items.map((x) => x.deliveryDays)),
          quotationId: q.id,
          snapshot: { quotation: q.number, items: q.items.map((x) => ({ description: x.description, platform: x.platform, quantity: x.quantity, unitPrice: x.unitPrice.toString() })), brief: q.brief },
        });
      }
    }
    return { inputs, problems };
  }

  private async resolveDiscount(code?: string | null) {
    if (!code) return undefined;
    const d = await this.prisma.discountCode.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (!d || !d.isActive || (d.validFrom && d.validFrom > now) || (d.validUntil && d.validUntil < now) || (d.maxRedemptions != null && d.redemptions >= d.maxRedemptions)) {
      throw new BadRequestException({ code: 'DISCOUNT_INVALID' });
    }
    return { row: d, percentOff: d.percentOff ? Number(d.percentOff) : null, amountOffMinor: d.amountOff ? toMinor(d.amountOff.toString()) : null };
  }

  async getCart(userId: string, discountCode?: string) {
    const b = await this.business(userId);
    const cart = await this.activeCart(b.id);
    const { inputs, problems } = this.toLineInputs(cart, b.id);
    const discount = await this.resolveDiscount(discountCode).catch(() => undefined);
    const priced = priceLines(inputs, await this.settings.commission(), await this.settings.vat(), discount);
    return {
      id: cart.id,
      items: cart.items.map((i) => ({ id: i.id, type: i.type, quantity: i.quantity, addOnKeys: i.addOnKeys, brief: i.brief, serviceId: i.serviceId, packageId: i.packageId, quotationId: i.quotationId, influencerSlug: i.service?.influencer.slug ?? i.package?.influencer.slug ?? i.quotation?.influencer.slug })),
      summary: serializeCart(priced),
      problems,
      discountApplied: !!discount,
    };
  }

  async addItem(userId: string, dto: { type: 'SERVICE' | 'PACKAGE' | 'QUOTATION'; id: string; quantity?: number; addOnKeys?: string[]; brief?: string }) {
    const b = await this.business(userId);
    const cart = await this.activeCart(b.id);
    if (cart.items.length >= 30) throw new BadRequestException({ code: 'CART_FULL' });
    const data: Prisma.CartItemUncheckedCreateInput = { cartId: cart.id, type: dto.type, quantity: dto.quantity ?? 1, addOnKeys: dto.addOnKeys ?? [], brief: dto.brief };
    if (dto.type === 'SERVICE') {
      const s = await this.prisma.influencerService.findFirst({ where: { id: dto.id, status: 'ACTIVE', deletedAt: null, influencer: { isPublic: true, acceptingBookings: true } } });
      if (!s) throw new NotFoundException({ code: 'SERVICE_UNAVAILABLE' });
      const valid = ((s.addOns as Array<{ key: string }>) ?? []).map((a) => a.key);
      if ((dto.addOnKeys ?? []).some((k) => !valid.includes(k))) throw new BadRequestException({ code: 'INVALID_ADDON' });
      const dup = cart.items.find((i) => i.serviceId === s.id);
      if (dup) {
        await this.prisma.cartItem.update({ where: { id: dup.id }, data: { quantity: Math.min(50, dup.quantity + (dto.quantity ?? 1)) } });
        return this.getCart(userId);
      }
      data.serviceId = s.id;
    } else if (dto.type === 'PACKAGE') {
      const p = await this.prisma.servicePackage.findFirst({ where: { id: dto.id, status: 'ACTIVE', influencer: { isPublic: true, acceptingBookings: true } } });
      if (!p) throw new NotFoundException({ code: 'PACKAGE_UNAVAILABLE' });
      data.packageId = p.id;
    } else {
      const q = await this.prisma.quotation.findFirst({ where: { id: dto.id, businessId: b.id, status: 'ACCEPTED' } });
      if (!q) throw new NotFoundException({ code: 'QUOTATION_UNAVAILABLE' });
      if (cart.items.some((i) => i.quotationId === q.id)) return this.getCart(userId);
      data.quotationId = q.id;
      data.quantity = 1;
    }
    await this.prisma.cartItem.create({ data });
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: { quantity?: number; brief?: string }) {
    const b = await this.business(userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cart: { businessId: b.id, status: 'ACTIVE' } } });
    if (!item) throw new NotFoundException();
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity: item.type === 'QUOTATION' ? 1 : dto.quantity ?? item.quantity, brief: dto.brief ?? item.brief } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const b = await this.business(userId);
    const r = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cart: { businessId: b.id, status: 'ACTIVE' } } });
    if (!r.count) throw new NotFoundException();
    return this.getCart(userId);
  }

  /**
   * Transactional, idempotent checkout. Creates Order + OrderItems (with immutable snapshots),
   * PAYMENT_PENDING campaigns and a Payment, then opens a hosted checkout session.
   */
  async checkout(userId: string, dto: { idempotencyKey: string; discountCode?: string; campaignTitle?: string }) {
    const b = await this.business(userId);
    const prior = await this.prisma.order.findUnique({ where: { idempotencyKey: `${b.id}:${dto.idempotencyKey}` }, include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (prior) {
      if (prior.businessId !== b.id) throw new ConflictException();
      const pay = prior.payments[0];
      if (prior.status === 'PAID') return { orderId: prior.id, status: prior.status };
      const r = await this.payments.startCheckout(pay, `InfluenceHub order ${prior.number}`, `/${'en'}/business/orders/${prior.id}`, `/en/business/cart`, b.user.email);
      return { orderId: prior.id, ...r };
    }
    const cart = await this.activeCart(b.id);
    if (!cart.items.length) throw new BadRequestException({ code: 'CART_EMPTY' });
    const { inputs, problems } = this.toLineInputs(cart, b.id);
    if (problems.length) throw new BadRequestException({ code: 'CART_HAS_UNAVAILABLE_ITEMS', problems });
    const discount = await this.resolveDiscount(dto.discountCode);
    const vatCfg = await this.settings.vat();
    const priced = priceLines(inputs, await this.settings.commission(), vatCfg, discount);
    if (priced.grandTotalMinor <= 0) throw new BadRequestException({ code: 'INVALID_TOTAL' });

    const { order, payment } = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`SELECT status FROM carts WHERE id = ${cart.id}::uuid FOR UPDATE`;
      if (locked[0]?.status !== 'ACTIVE') throw new ConflictException({ code: 'CART_ALREADY_CHECKED_OUT' });
      const order = await tx.order.create({
        data: {
          number: await nextNumber(tx, 'order_number_seq', 'ORD'),
          businessId: b.id,
          subtotal: fromMinor(priced.subtotalMinor),
          discountTotal: fromMinor(priced.discountMinor),
          businessCommissionTotal: fromMinor(priced.businessCommissionMinor),
          vatTotal: fromMinor(priced.vatMinor),
          grandTotal: fromMinor(priced.grandTotalMinor),
          vatRate: priced.vatRate,
          discountCode: discount?.row.code,
          idempotencyKey: `${b.id}:${dto.idempotencyKey}`,
        },
      });
      for (const l of priced.lines) {
        const item = await tx.orderItem.create({
          data: {
            orderId: order.id,
            influencerId: l.influencerId,
            serviceId: l.serviceId,
            quotationId: l.quotationId,
            packageId: l.packageId,
            description: l.description,
            platform: l.platform as any,
            quantity: l.quantity,
            unitPrice: fromMinor(l.unitPriceMinor),
            addOnsTotal: fromMinor(l.addOnsMinor),
            discount: fromMinor(l.discountMinor),
            grossAmount: fromMinor(l.grossMinor),
            commissionRate: l.commissionRate,
            commissionPayer: l.commissionPayer,
            businessCommission: fromMinor(l.businessCommissionMinor),
            influencerCommission: fromMinor(l.influencerCommissionMinor),
            vatAmount: fromMinor(l.vatMinor),
            influencerNet: fromMinor(l.influencerNetMinor),
            taxTreatment: l.taxTreatment,
            deliveryDays: l.deliveryDays,
            snapshot: l.snapshot as Prisma.InputJsonValue,
          },
        });
        const isMedical = await tx.influencerCategory.count({ where: { influencerId: l.influencerId, category: { requiresMedicalCompliance: true } } });
        const campaign = await tx.campaign.create({
          data: {
            number: await nextNumber(tx, 'campaign_number_seq', 'CMP'),
            businessId: b.id,
            influencerId: l.influencerId,
            orderItemId: item.id,
            title: dto.campaignTitle ? `${dto.campaignTitle} — ${l.description}` : l.description,
            brief: (l.snapshot.brief as string) ?? null,
            status: 'PAYMENT_PENDING',
            platforms: l.platform === 'CROSS_PLATFORM' ? ['INSTAGRAM', 'TIKTOK'] : [l.platform as any],
            agreedAmount: fromMinor(l.grossMinor),
            usageRights: (l.snapshot.usageRights as string) ?? null,
            postingDeadline: new Date(Date.now() + (l.deliveryDays + 7) * 86_400_000),
            complianceStatus: isMedical ? 'PENDING_REVIEW' : 'NOT_REQUIRED',
            deliverables: { create: deliverablesFrom(l) },
            events: { create: { actorId: userId, toStatus: 'PAYMENT_PENDING', note: `Order ${order.number}` } },
          },
        });
        void campaign;
      }
      if (discount) await tx.discountCode.update({ where: { id: discount.row.id }, data: { redemptions: { increment: 1 } } });
      await tx.cart.update({ where: { id: cart.id }, data: { status: 'CHECKED_OUT' } });
      const payment = await tx.payment.create({
        data: { purpose: 'ORDER', orderId: order.id, provider: env().PAYMENT_PROVIDER, amount: order.grandTotal, currency: 'AED', idempotencyKey: `order-${order.id}` },
      });
      return { order, payment };
    });
    await this.audit.log({ actorId: userId }, 'order.checkout', 'Order', order.id, undefined, { total: order.grandTotal.toString(), lines: priced.lines.length });
    const r = await this.payments.startCheckout(payment, `InfluenceHub order ${order.number}`, `/en/business/orders/${order.id}`, `/en/business/orders/${order.id}`, b.user.email);
    return { orderId: order.id, number: order.number, ...r };
  }

  /** Retry payment for an unpaid order (new Payment row; earlier failed attempts are kept). */
  async retryPayment(userId: string, orderId: string) {
    const b = await this.business(userId);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, businessId: b.id }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
    if (!order) throw new NotFoundException();
    if (order.status !== 'PENDING_PAYMENT') throw new BadRequestException({ code: 'ORDER_NOT_PAYABLE' });
    const open = order.payments.find((p) => p.status === 'PENDING' || p.status === 'CREATED');
    const payment = open ?? (await this.prisma.payment.create({ data: { purpose: 'ORDER', orderId: order.id, provider: env().PAYMENT_PROVIDER, amount: order.grandTotal, idempotencyKey: `order-${order.id}-retry-${order.payments.length}` } }));
    return this.payments.startCheckout(payment, `InfluenceHub order ${order.number}`, `/en/business/orders/${order.id}`, `/en/business/orders/${order.id}`, b.user.email);
  }

  async orders(userId: string) {
    const b = await this.business(userId);
    return this.prisma.order.findMany({ where: { businessId: b.id }, orderBy: { createdAt: 'desc' }, include: { items: { select: { id: true, description: true, grossAmount: true, influencer: { select: { displayName: true, slug: true } }, campaign: { select: { id: true, number: true, status: true } } } } } });
  }

  async order(userId: string, orderId: string) {
    const b = await this.business(userId);
    const o = await this.prisma.order.findFirst({
      where: { id: orderId, businessId: b.id },
      include: {
        items: { include: { influencer: { select: { displayName: true, slug: true } }, campaign: { select: { id: true, number: true, status: true } } } },
        payments: { select: { id: true, status: true, amount: true, provider: true, createdAt: true, succeededAt: true, checkoutUrl: true } },
        invoices: true,
        refunds: true,
      },
    });
    if (!o) throw new NotFoundException();
    return o;
  }

  async payments_(userId: string) {
    const b = await this.business(userId);
    const [payments, invoices] = await Promise.all([
      this.prisma.payment.findMany({ where: { OR: [{ order: { businessId: b.id } }, { contactPurchase: { businessId: b.id } }] }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, purpose: true, amount: true, currency: true, status: true, provider: true, createdAt: true, succeededAt: true, order: { select: { id: true, number: true } }, contactPurchase: { select: { influencer: { select: { displayName: true } } } } } }),
      this.prisma.invoice.findMany({ where: { OR: [{ order: { businessId: b.id } }, { contactPurchaseId: { in: (await this.prisma.contactPurchase.findMany({ where: { businessId: b.id }, select: { id: true } })).map((c) => c.id) } }] }, orderBy: { issuedAt: 'desc' } }),
    ]);
    return { payments, invoices };
  }

  async invoice(userId: string, invoiceId: string, isAdmin = false) {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { order: { select: { businessId: true, number: true } } } });
    if (!inv) throw new NotFoundException();
    if (!isAdmin) {
      const b = await this.business(userId);
      const owns = inv.order ? inv.order.businessId === b.id : inv.contactPurchaseId ? !!(await this.prisma.contactPurchase.findFirst({ where: { id: inv.contactPurchaseId, businessId: b.id } })) : false;
      if (!owns) throw new NotFoundException();
    }
    return inv;
  }
}

function deliverablesFrom(l: { snapshot: Record<string, unknown>; quantity: number; platform: string; deliveryDays: number }) {
  const due = new Date(Date.now() + l.deliveryDays * 86_400_000);
  const list = (l.snapshot.deliverables as Array<{ type: string; platform: string; quantity: number }>) ?? [];
  const revisions = Number(l.snapshot.revisions ?? 1);
  if (list.length) return list.map((d) => ({ type: d.type, platform: d.platform as any, quantity: d.quantity * l.quantity, dueAt: due, maxRevisions: revisions }));
  const items = (l.snapshot.items as Array<{ description?: string; title?: string; platform?: string; quantity: number }>) ?? [];
  if (items.length) return items.map((i) => ({ type: (i.description ?? i.title ?? 'DELIVERABLE').slice(0, 60), platform: (i.platform ?? 'CROSS_PLATFORM') as any, quantity: i.quantity, dueAt: due, maxRevisions: 1 }));
  return [{ type: 'DELIVERABLE', platform: l.platform as any, quantity: l.quantity, dueAt: due, maxRevisions: 1 }];
}
