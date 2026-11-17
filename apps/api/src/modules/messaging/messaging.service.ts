import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SettingsService } from '../../common/services/settings.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const PHONE_RE = /(\+?971|00971|\b0)[\s-]?5\d[\s-]?\d{3}[\s-]?\d{4}|\+?\d[\d\s-]{8,}\d/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const HANDLE_RE = /(whatsapp|wa\.me|telegram|t\.me|snapchat|واتساب|واتس)/i;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async conversations(userId: string) {
    return this.prisma.withUserContext(userId, async (tx) => {
      const convs = await tx.conversation.findMany({
        where: { participants: { some: { userId } } },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, senderId: true, status: true } } },
      });
      const userIds = convs.flatMap((c) => [c.businessUserId, c.influencerUserId]);
      const [biz, inf] = await Promise.all([
        tx.businessProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, businessName: true, logoUrl: true } }),
        tx.influencerProfile.findMany({ where: { userId: { in: userIds } }, select: { userId: true, displayName: true, profileImageUrl: true, slug: true } }),
      ]);
      return Promise.all(
        convs.map(async (c) => {
          const me = c.participants.find((p) => p.userId === userId);
          const unread = await tx.message.count({ where: { conversationId: c.id, senderId: { not: userId }, createdAt: { gt: me?.lastReadAt ?? new Date(0) } } });
          const otherId = c.businessUserId === userId ? c.influencerUserId : c.businessUserId;
          const b = biz.find((x) => x.userId === otherId);
          const i = inf.find((x) => x.userId === otherId);
          return {
            id: c.id,
            isLocked: c.isLocked,
            lastMessageAt: c.lastMessageAt,
            unread,
            lastMessage: c.messages[0] ? { ...c.messages[0], body: c.messages[0].status === 'REMOVED' ? '' : c.messages[0].body.slice(0, 140) } : null,
            other: b ? { name: b.businessName, image: b.logoUrl, type: 'BUSINESS' } : { name: i?.displayName, image: i?.profileImageUrl, slug: i?.slug, type: 'INFLUENCER' },
          };
        }),
      );
    });
  }

  async messages(userId: string, conversationId: string, before?: string) {
    return this.prisma.withUserContext(userId, async (tx) => {
      const conv = await tx.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } }, include: { participants: true } });
      if (!conv) throw new NotFoundException();
      const msgs = await tx.message.findMany({
        where: { conversationId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { attachments: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true } } },
      });
      const other = conv.participants.find((p) => p.userId !== userId);
      await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: new Date() } });
      return {
        conversationId,
        isLocked: conv.isLocked,
        otherLastReadAt: other?.lastReadAt ?? null,
        messages: msgs.reverse().map((m) => ({ ...m, body: m.status === 'REMOVED' ? '' : m.body, mine: m.senderId === userId })),
      };
    });
  }

  async send(userId: string, conversationId: string, body: string, attachmentIds: string[] = []) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } } });
    if (!conv) throw new NotFoundException();
    if (conv.isLocked) throw new ForbiddenException({ code: 'CONVERSATION_LOCKED' });
    const otherId = conv.businessUserId === userId ? conv.influencerUserId : conv.businessUserId;
    const blocked = await this.prisma.userBlock.findFirst({ where: { OR: [{ blockerId: otherId, blockedId: userId }, { blockerId: userId, blockedId: otherId }] } });
    if (blocked) throw new ForbiddenException({ code: 'BLOCKED' });

    // Paid-contact enforcement: the business must hold a valid entitlement for this creator.
    const [biz, inf] = await Promise.all([
      this.prisma.businessProfile.findUnique({ where: { userId: conv.businessUserId } }),
      this.prisma.influencerProfile.findUnique({ where: { userId: conv.influencerUserId } }),
    ]);
    if (!biz || !inf) throw new ForbiddenException();
    const ent = await this.prisma.contactEntitlement.findFirst({ where: { businessId: biz.id, influencerId: inf.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!ent) throw new ForbiddenException({ code: 'CONTACT_ENTITLEMENT_REQUIRED' });

    const cfg = await this.settings.get<{ maxMessagesPerMinute: number; blockContactDetailsBeforeBooking: boolean; bannedTerms: string[] }>('messaging');
    const recent = await this.prisma.message.count({ where: { senderId: userId, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent >= cfg.maxMessagesPerMinute) throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);

    let status: 'SENT' | 'FLAGGED' = 'SENT';
    let flaggedReason: string | undefined;
    if (cfg.blockContactDetailsBeforeBooking && ent.source !== 'BOOKING' && (PHONE_RE.test(body) || EMAIL_RE.test(body) || HANDLE_RE.test(body))) {
      throw new BadRequestException({ code: 'CONTACT_DETAILS_NOT_ALLOWED' });
    }
    const lower = body.toLowerCase();
    const banned = cfg.bannedTerms.find((t) => t && lower.includes(t.toLowerCase()));
    if (banned) {
      status = 'FLAGGED';
      flaggedReason = `banned_term:${banned}`;
    }
    if (attachmentIds.length) {
      const owned = await this.prisma.attachment.count({ where: { id: { in: attachmentIds }, ownerId: userId, messageId: null } });
      if (owned !== attachmentIds.length) throw new ForbiddenException({ code: 'ATTACHMENT_NOT_OWNED' });
    }
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { conversationId, senderId: userId, body, status, flaggedReason } });
      if (attachmentIds.length) await tx.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { messageId: m.id, purpose: 'MESSAGE' } });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
      await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: m.createdAt } });
      return m;
    });
    const senderName = userId === conv.businessUserId ? biz.businessName : inf.displayName;
    const link = otherId === conv.businessUserId ? `/business/messages?c=${conversationId}` : `/influencer/messages?c=${conversationId}`;
    await this.notifications.notify(otherId, 'NEW_MESSAGE', { name: senderName, preview: body.slice(0, 80) }, link);
    return msg;
  }

  async block(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } } });
    if (!conv) throw new NotFoundException();
    const otherId = conv.businessUserId === userId ? conv.influencerUserId : conv.businessUserId;
    await this.prisma.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: otherId } }, update: {}, create: { blockerId: userId, blockedId: otherId } });
    await this.audit.log({ actorId: userId }, 'messaging.block', 'User', otherId);
    return { ok: true };
  }

  async unblock(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, participants: { some: { userId } } } });
    if (!conv) throw new NotFoundException();
    const otherId = conv.businessUserId === userId ? conv.influencerUserId : conv.businessUserId;
    await this.prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: otherId } });
    return { ok: true };
  }

  async report(userId: string, dto: { targetType: 'MESSAGE' | 'USER' | 'PROFILE' | 'REVIEW'; targetId: string; reason: string; details?: string }) {
    if (dto.targetType === 'MESSAGE') {
      const ok = await this.prisma.message.findFirst({ where: { id: dto.targetId, conversation: { participants: { some: { userId } } } } });
      if (!ok) throw new NotFoundException();
    }
    const recent = await this.prisma.contentReport.count({ where: { reporterId: userId, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 10) throw new HttpException({ code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    return this.prisma.contentReport.create({ data: { reporterId: userId, ...dto } });
  }
}
