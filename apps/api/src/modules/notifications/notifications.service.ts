import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';
import { EmailService } from './email.service';
import { render } from './templates';

/** Types that are always emailed (security/transactional) regardless of preferences. */
const MANDATORY_EMAIL = new Set(['EMAIL_VERIFY', 'PASSWORD_RESET', 'PAYMENT_SUCCEEDED', 'REFUND_UPDATED', 'PAYOUT_UPDATED']);
const IN_APP_ONLY = new Set(['NEW_MESSAGE']);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService) {}

  async notify(userId: string, type: string, params: Record<string, unknown> = {}, link?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, locale: true, status: true, notificationPrefs: true } });
    if (!user || user.status === 'DELETED') return;
    await this.prisma.notification.create({ data: { userId, type, titleKey: `notifications.${type}.title`, bodyKey: `notifications.${type}.body`, params: params as any, link } });
    const pref = user.notificationPrefs.find((p) => p.type === type && p.channel === 'EMAIL');
    const wantsEmail = MANDATORY_EMAIL.has(type) || (!IN_APP_ONLY.has(type) && (pref ? pref.enabled : true));
    if (wantsEmail) await this.email.queue(user.email, user.locale, type, { ...params, link: link ? `${env().WEB_ORIGIN}${link}` : params.link });
  }

  /** Optional SMS through an approved provider. Default `console` provider only logs in non-production. */
  async sms(phone: string, locale: 'en' | 'ar', type: string, params: Record<string, unknown>) {
    const { body } = render(type, locale, params);
    if (env().SMS_PROVIDER === 'console' && env().APP_ENV !== 'production') {
      if (env().APP_ENV !== 'test') this.logger.log(`[sms:dev] to=${phone} ${body}`);
      return true;
    }
    this.logger.warn('No SMS provider configured — SMS not sent');
    return false;
  }

  list(userId: string, cursor?: string) {
    return this.prisma.withUserContext(userId, (tx) =>
      tx.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
    );
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids: string[] | 'all') {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(ids === 'all' ? {} : { id: { in: ids } }) }, data: { readAt: new Date() } });
  }

  async setPreference(userId: string, type: string, channel: 'IN_APP' | 'EMAIL' | 'SMS', enabled: boolean) {
    await this.prisma.notificationPreference.upsert({ where: { userId_type_channel: { userId, type, channel } }, update: { enabled }, create: { userId, type, channel, enabled } });
  }
}
