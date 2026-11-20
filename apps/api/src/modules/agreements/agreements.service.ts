import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Agreement, AgreementParty, Prisma } from '@influencehub/database';
import { canonicalJson, type AgreementContent, type SignedAgreementDocument } from '@influencehub/shared';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService, AuditContext } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nextNumber } from '../finance/ledger.service';
import { AGREEMENT_TEMPLATES, SIGNATURE_CONSENT } from './templates';

export const agreementHash = (d: SignedAgreementDocument) => createHash('sha256').update(canonicalJson(d)).digest('hex');

const DETAIL = {
  business: { select: { id: true, businessName: true, contactPerson: true, userId: true, emirate: true, tradeLicenceNumber: true } },
  influencer: { select: { id: true, displayName: true, fullName: true, slug: true, userId: true } },
  campaign: { select: { id: true, number: true, title: true } },
  currentVersion: true,
  versions: { orderBy: { version: 'desc' as const }, select: { id: true, version: true, title: true, contentHash: true, authorParty: true, changeNote: true, createdAt: true } },
  signatures: { orderBy: { signedAt: 'asc' as const } },
} satisfies Prisma.AgreementInclude;
type Detail = Prisma.AgreementGetPayload<{ include: typeof DETAIL }>;

@Injectable()
export class AgreementsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly notifications: NotificationsService) {}

  templates(locale: 'en' | 'ar') {
    return { clauses: AGREEMENT_TEMPLATES[locale], consentText: SIGNATURE_CONSENT[locale] };
  }

  private async actor(userId: string) {
    const [business, influencer] = await Promise.all([this.prisma.businessProfile.findUnique({ where: { userId } }), this.prisma.influencerProfile.findUnique({ where: { userId } })]);
    if (business) return { party: 'BUSINESS' as const, business, influencer: null };
    if (influencer) return { party: 'INFLUENCER' as const, business: null, influencer };
    throw new ForbiddenException({ code: 'FORBIDDEN' });
  }

  /** People you can contract with: an active contact entitlement or a shared campaign. */
  async counterparties(userId: string) {
    const a = await this.actor(userId);
    const now = new Date();
    if (a.party === 'BUSINESS') {
      const rows = await this.prisma.influencerProfile.findMany({
        where: { OR: [{ contactEntitlements: { some: { businessId: a.business!.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } }, { campaigns: { some: { businessId: a.business!.id } } }] },
        select: { id: true, displayName: true, campaigns: { where: { businessId: a.business!.id }, select: { id: true, number: true, title: true }, orderBy: { createdAt: 'desc' } } },
      });
      return rows.map((r) => ({ id: r.id, name: r.displayName, campaigns: r.campaigns }));
    }
    const rows = await this.prisma.businessProfile.findMany({
      where: { OR: [{ contactEntitlements: { some: { influencerId: a.influencer!.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } }, { campaigns: { some: { influencerId: a.influencer!.id } } }] },
      select: { id: true, businessName: true, campaigns: { where: { influencerId: a.influencer!.id }, select: { id: true, number: true, title: true }, orderBy: { createdAt: 'desc' } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.businessName, campaigns: r.campaigns }));
  }

  async create(userId: string, dto: AgreementContent & { counterpartyId: string; campaignId?: string | null }, ctx: AuditContext) {
    const a = await this.actor(userId);
    const businessId = a.party === 'BUSINESS' ? a.business!.id : dto.counterpartyId;
    const influencerId = a.party === 'INFLUENCER' ? a.influencer!.id : dto.counterpartyId;
    const allowed = (await this.counterparties(userId)).find((c) => c.id === dto.counterpartyId);
    if (!allowed) throw new ForbiddenException({ code: 'AGREEMENT_RELATIONSHIP_REQUIRED' });
    if (dto.campaignId && !allowed.campaigns.some((c) => c.id === dto.campaignId)) throw new BadRequestException({ code: 'INVALID_CAMPAIGN' });
    const agreement = await this.prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, 'agreement_number_seq', 'AGR');
      const ag = await tx.agreement.create({ data: { number, businessId, influencerId, campaignId: dto.campaignId ?? null, createdById: userId } });
      const v = await this.addVersion(tx, ag, 1, dto, userId, a.party);
      return tx.agreement.update({ where: { id: ag.id }, data: { currentVersionId: v.id } });
    });
    await this.audit.log(ctx, 'agreement.create', 'Agreement', agreement.id, undefined, { number: agreement.number });
    return this.get(userId, agreement.id);
  }

  private addVersion(tx: Prisma.TransactionClient, ag: Agreement, version: number, c: AgreementContent, userId: string, party: AgreementParty) {
    const doc: SignedAgreementDocument = { number: ag.number, version, businessId: ag.businessId, influencerId: ag.influencerId, title: c.title, clauses: c.clauses, financialTerms: c.financialTerms };
    return tx.agreementVersion.create({
      data: { agreementId: ag.id, version, title: c.title, clauses: c.clauses as Prisma.InputJsonValue, financialTerms: c.financialTerms as Prisma.InputJsonValue, contentHash: agreementHash(doc), authorId: userId, authorParty: party, changeNote: c.changeNote },
    });
  }

  private async load(userId: string, id: string, isAdmin = false) {
    const ag = await this.prisma.agreement.findUnique({ where: { id }, include: DETAIL });
    if (!ag) throw new NotFoundException();
    let party: AgreementParty | 'ADMIN';
    if (isAdmin) party = 'ADMIN';
    else if (ag.business.userId === userId) party = 'BUSINESS';
    else if (ag.influencer.userId === userId) party = 'INFLUENCER';
    else throw new NotFoundException(); // never reveal other parties' agreements
    // Drafts are private to their author until sent.
    if (party !== 'ADMIN' && ag.status === 'DRAFT' && ag.createdById !== userId) throw new NotFoundException();
    return { ag, party };
  }

  private view(ag: Detail, party: AgreementParty | 'ADMIN', userId: string) {
    const current = ag.currentVersion!;
    const onCurrent = ag.signatures.filter((s) => s.versionId === current.id);
    const mine = party === 'ADMIN' ? undefined : onCurrent.find((s) => s.party === party);
    const open = ag.status === 'DRAFT' || ag.status === 'PENDING_SIGNATURE';
    const isCreator = ag.createdById === userId;
    return {
      ...ag,
      viewerParty: party,
      currentSignatures: onCurrent.map(({ signatureImage, ...s }) => ({ ...s, hasDrawnSignature: !!signatureImage, signatureImage })),
      can:
        party === 'ADMIN'
          ? { edit: false, send: false, sign: false, decline: false, cancel: false }
          : {
              edit: open && (ag.status === 'PENDING_SIGNATURE' || isCreator),
              send: ag.status === 'DRAFT' && isCreator,
              sign: ag.status === 'PENDING_SIGNATURE' && !mine,
              decline: ag.status === 'PENDING_SIGNATURE' && !isCreator,
              cancel: open && isCreator,
            },
    };
  }

  async get(userId: string, id: string, isAdmin = false) {
    const { ag, party } = await this.load(userId, id, isAdmin);
    return this.view(ag, party, userId);
  }

  async list(userId: string) {
    const a = await this.actor(userId);
    const where: Prisma.AgreementWhereInput =
      a.party === 'BUSINESS' ? { businessId: a.business!.id } : { influencerId: a.influencer!.id };
    const rows = await this.prisma.agreement.findMany({
      where: { AND: [where, { OR: [{ status: { not: 'DRAFT' } }, { createdById: userId }] }] },
      orderBy: { updatedAt: 'desc' },
      include: { business: { select: { businessName: true } }, influencer: { select: { displayName: true } }, currentVersion: { select: { title: true, version: true, financialTerms: true } }, signatures: { select: { versionId: true, party: true } } },
    });
    return rows.map((r) => ({ ...r, signedParties: r.signatures.filter((s) => s.versionId === r.currentVersionId).map((s) => s.party) }));
  }

  /** Any change creates a new immutable version; signatures on earlier versions no longer count. */
  async revise(userId: string, id: string, content: AgreementContent, ctx: AuditContext) {
    const { ag, party } = await this.load(userId, id);
    const v = this.view(ag, party, userId);
    if (!v.can.edit) throw new BadRequestException({ code: 'AGREEMENT_NOT_EDITABLE' });
    const updated = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ status: string; currentVersionId: string }>>`SELECT status, "currentVersionId" FROM agreements WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.currentVersionId !== ag.currentVersionId || !['DRAFT', 'PENDING_SIGNATURE'].includes(locked.status)) throw new ConflictException({ code: 'AGREEMENT_CHANGED' });
      const next = await this.addVersion(tx, ag, ag.currentVersion!.version + 1, content, userId, party as AgreementParty);
      return tx.agreement.update({ where: { id }, data: { currentVersionId: next.id } });
    });
    await this.audit.log(ctx, 'agreement.revise', 'Agreement', id, { version: ag.currentVersion!.version }, { version: ag.currentVersion!.version + 1, changeNote: content.changeNote });
    if (updated.status === 'PENDING_SIGNATURE') await this.notifyOther(ag, party as AgreementParty, 'AGREEMENT_REVISED');
    return this.get(userId, id);
  }

  async send(userId: string, id: string, ctx: AuditContext) {
    const { ag, party } = await this.load(userId, id);
    if (!this.view(ag, party, userId).can.send) throw new BadRequestException({ code: 'AGREEMENT_NOT_SENDABLE' });
    await this.prisma.agreement.update({ where: { id }, data: { status: 'PENDING_SIGNATURE' } });
    await this.audit.log(ctx, 'agreement.send', 'Agreement', id);
    await this.notifyOther(ag, party as AgreementParty, 'AGREEMENT_SENT');
    return this.get(userId, id);
  }

  async sign(userId: string, id: string, dto: { versionId: string; contentHash: string; signerName: string; signerTitle?: string; signatureImage?: string }, ctx: AuditContext, locale: 'en' | 'ar') {
    const { ag, party } = await this.load(userId, id);
    if (party === 'ADMIN') throw new ForbiddenException();
    const result = await this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ status: string; currentVersionId: string }>>`SELECT status, "currentVersionId" FROM agreements WHERE id = ${id}::uuid FOR UPDATE`;
      if (locked.status !== 'PENDING_SIGNATURE') throw new BadRequestException({ code: 'AGREEMENT_NOT_SIGNABLE' });
      // The signer must sign exactly the version and content they were shown.
      if (dto.versionId !== locked.currentVersionId) throw new ConflictException({ code: 'AGREEMENT_CHANGED' });
      const version = await tx.agreementVersion.findUniqueOrThrow({ where: { id: dto.versionId } });
      if (version.contentHash !== dto.contentHash) throw new ConflictException({ code: 'AGREEMENT_CHANGED' });
      const already = await tx.agreementSignature.findUnique({ where: { versionId_party: { versionId: version.id, party } } });
      if (already) throw new ConflictException({ code: 'ALREADY_SIGNED' });
      await tx.agreementSignature.create({
        data: {
          agreementId: id,
          versionId: version.id,
          userId,
          party,
          signerName: dto.signerName,
          signerTitle: dto.signerTitle,
          method: dto.signatureImage ? 'DRAWN' : 'TYPED',
          signatureImage: dto.signatureImage,
          contentHash: version.contentHash,
          consentText: SIGNATURE_CONSENT[locale],
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent?.slice(0, 300),
        },
      });
      const count = await tx.agreementSignature.count({ where: { versionId: version.id } });
      const executed = count === 2;
      if (executed) await tx.agreement.update({ where: { id }, data: { status: 'SIGNED', executedAt: new Date(), closedAt: new Date() } });
      await this.audit.log(ctx, executed ? 'agreement.executed' : 'agreement.sign', 'Agreement', id, undefined, { version: version.version, party, contentHash: version.contentHash }, tx);
      return { executed };
    });
    if (result.executed) {
      for (const uid of [ag.business.userId, ag.influencer.userId]) await this.notifications.notify(uid, 'AGREEMENT_EXECUTED', { number: ag.number }, this.link(ag, uid));
    } else await this.notifyOther(ag, party, 'AGREEMENT_SIGNED');
    return this.get(userId, id);
  }

  async decline(userId: string, id: string, reason: string, ctx: AuditContext) {
    const { ag, party } = await this.load(userId, id);
    if (!this.view(ag, party, userId).can.decline) throw new BadRequestException({ code: 'AGREEMENT_NOT_DECLINABLE' });
    await this.prisma.agreement.update({ where: { id }, data: { status: 'DECLINED', declinedReason: reason, closedAt: new Date() } });
    await this.audit.log(ctx, 'agreement.decline', 'Agreement', id, undefined, { reason });
    await this.notifyOther(ag, party as AgreementParty, 'AGREEMENT_DECLINED');
    return this.get(userId, id);
  }

  async cancel(userId: string, id: string, ctx: AuditContext) {
    const { ag, party } = await this.load(userId, id);
    if (!this.view(ag, party, userId).can.cancel) throw new BadRequestException({ code: 'AGREEMENT_NOT_CANCELLABLE' });
    await this.prisma.agreement.update({ where: { id }, data: { status: 'CANCELLED', closedAt: new Date() } });
    await this.audit.log(ctx, 'agreement.cancel', 'Agreement', id);
    if (ag.status === 'PENDING_SIGNATURE') await this.notifyOther(ag, party as AgreementParty, 'AGREEMENT_CANCELLED');
    return this.get(userId, id);
  }

  /** Full content of a specific historical version (parties and admins only). */
  async version(userId: string, id: string, versionId: string, isAdmin = false) {
    await this.load(userId, id, isAdmin);
    const v = await this.prisma.agreementVersion.findFirst({ where: { id: versionId, agreementId: id }, include: { signatures: true } });
    if (!v) throw new NotFoundException();
    return v;
  }

  adminList(status?: string) {
    return this.prisma.agreement.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { business: { select: { businessName: true } }, influencer: { select: { displayName: true } }, currentVersion: { select: { title: true, version: true, contentHash: true } } },
    });
  }

  private link(ag: Detail, uid: string) {
    return `${uid === ag.business.userId ? '/business' : '/influencer'}/agreements/${ag.id}`;
  }

  private async notifyOther(ag: Detail, from: AgreementParty, type: string) {
    const to = from === 'BUSINESS' ? ag.influencer.userId : ag.business.userId;
    const name = from === 'BUSINESS' ? ag.business.businessName : ag.influencer.displayName;
    await this.notifications.notify(to, type, { number: ag.number, name }, this.link(ag, to));
  }
}
