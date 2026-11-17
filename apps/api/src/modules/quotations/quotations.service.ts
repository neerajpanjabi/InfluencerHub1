import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { fromMinor, toMinor } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextNumber } from '../finance/ledger.service';
import { CommerceService } from '../commerce/commerce.service';

/**
 * Quotation workflow. Requesting a quotation is a form of contact, so it requires a valid
 * contact entitlement (paid / free / admin grant / prior booking) — same rule as messaging.
 */
@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService, private readonly commerce: CommerceService) {}

  private async actor(userId: string) {
    const [b, i] = await Promise.all([this.prisma.businessProfile.findUnique({ where: { userId } }), this.prisma.influencerProfile.findUnique({ where: { userId } })]);
    return { business: b, influencer: i };
  }

  async request(userId: string, dto: { influencerId: string; brief: string; requestedBudget?: number }) {
    const { business } = await this.actor(userId);
    if (!business) throw new ForbiddenException();
    const inf = await this.prisma.influencerProfile.findFirst({ where: { id: dto.influencerId, isPublic: true, deletedAt: null } });
    if (!inf) throw new NotFoundException();
    const ent = await this.prisma.contactEntitlement.findFirst({ where: { businessId: business.id, influencerId: inf.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!ent) throw new ForbiddenException({ code: 'CONTACT_ENTITLEMENT_REQUIRED' });
    const open = await this.prisma.quotation.count({ where: { businessId: business.id, influencerId: inf.id, status: 'REQUESTED' } });
    if (open >= 3) throw new BadRequestException({ code: 'TOO_MANY_OPEN_QUOTATIONS' });
    const q = await this.prisma.$transaction(async (tx) =>
      tx.quotation.create({ data: { number: await nextNumber(tx, 'quotation_number_seq', 'QT'), businessId: business.id, influencerId: inf.id, brief: dto.brief, requestedBudget: dto.requestedBudget } }),
    );
    await this.notifications.notify(inf.userId, 'QUOTATION_REQUESTED', { business: business.businessName }, `/influencer/quotations/${q.id}`);
    return q;
  }

  async list(userId: string) {
    const { business, influencer } = await this.actor(userId);
    const where = business ? { businessId: business.id } : influencer ? { influencerId: influencer.id } : null;
    if (!where) throw new ForbiddenException();
    return this.prisma.quotation.findMany({ where, orderBy: { createdAt: 'desc' }, include: { items: true, business: { select: { businessName: true } }, influencer: { select: { displayName: true, slug: true } } } });
  }

  async get(userId: string, id: string) {
    const { business, influencer } = await this.actor(userId);
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { items: true, business: { select: { businessName: true, userId: true } }, influencer: { select: { displayName: true, slug: true, userId: true } } } });
    if (!q || (q.businessId !== business?.id && q.influencerId !== influencer?.id)) throw new NotFoundException();
    return q;
  }

  async submit(userId: string, id: string, dto: { items: Array<{ description: string; platform: any; quantity: number; unitPrice: number; deliveryDays: number }>; validDays: number; note?: string }) {
    const { influencer } = await this.actor(userId);
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { business: true } });
    if (!q || !influencer || q.influencerId !== influencer.id) throw new NotFoundException();
    if (q.status !== 'REQUESTED') throw new BadRequestException({ code: 'QUOTATION_NOT_OPEN' });
    const subtotal = dto.items.reduce((a, i) => a + toMinor(String(i.unitPrice)) * i.quantity, 0);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: q.id } });
      await tx.quotationItem.createMany({ data: dto.items.map((i) => ({ quotationId: q.id, description: i.description, platform: i.platform, quantity: i.quantity, unitPrice: i.unitPrice, deliveryDays: i.deliveryDays })) });
      return tx.quotation.update({ where: { id: q.id }, data: { status: 'SUBMITTED', subtotal: fromMinor(subtotal), validUntil: new Date(Date.now() + dto.validDays * 86_400_000), influencerNote: dto.note, submittedAt: new Date() } });
    });
    await this.notifications.notify(q.business.userId, 'QUOTATION_SUBMITTED', { name: influencer.displayName, number: q.number, amount: fromMinor(subtotal) }, `/business/quotations/${q.id}`);
    return updated;
  }

  /** Business accepts: quotation becomes purchasable and is added to the cart. The agreed quotation sets the price. */
  async accept(userId: string, id: string) {
    const { business } = await this.actor(userId);
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { influencer: true } });
    if (!q || !business || q.businessId !== business.id) throw new NotFoundException();
    if (q.status !== 'SUBMITTED') throw new BadRequestException({ code: 'QUOTATION_NOT_SUBMITTED' });
    if (q.validUntil && q.validUntil < new Date()) {
      await this.prisma.quotation.update({ where: { id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException({ code: 'QUOTATION_EXPIRED' });
    }
    await this.prisma.quotation.update({ where: { id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
    await this.notifications.notify(q.influencer.userId, 'QUOTATION_ACCEPTED', { number: q.number }, `/influencer/quotations/${q.id}`);
    return this.commerce.addItem(userId, { type: 'QUOTATION', id: q.id });
  }

  async reject(userId: string, id: string) {
    const { business, influencer } = await this.actor(userId);
    const q = await this.prisma.quotation.findUnique({ where: { id } });
    if (!q) throw new NotFoundException();
    if (business && q.businessId === business.id && ['SUBMITTED', 'REQUESTED'].includes(q.status)) return this.prisma.quotation.update({ where: { id }, data: { status: q.status === 'REQUESTED' ? 'WITHDRAWN' : 'REJECTED', respondedAt: new Date() } });
    if (influencer && q.influencerId === influencer.id && q.status === 'REQUESTED') return this.prisma.quotation.update({ where: { id }, data: { status: 'REJECTED', respondedAt: new Date() } });
    throw new BadRequestException({ code: 'QUOTATION_NOT_OPEN' });
  }
}
