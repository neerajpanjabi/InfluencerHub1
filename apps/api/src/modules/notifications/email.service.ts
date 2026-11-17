import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';
import { escapeHtml, render } from './templates';

/**
 * Email via transactional outbox: rows are written in the caller's flow and delivered by
 * `flush()` (called inline best-effort and by the worker). Without SMTP_URL, emails are logged
 * to the console (development) and marked SENT so flows remain testable.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport = env().SMTP_URL ? nodemailer.createTransport(env().SMTP_URL) : null;
  constructor(private readonly prisma: PrismaService) {}

  async queue(to: string, locale: 'en' | 'ar', template: string, params: Record<string, unknown>) {
    const row = await this.prisma.emailOutbox.create({ data: { toAddress: to, locale, template, params: params as any } });
    void this.deliver(row.id).catch(() => undefined);
    return row.id;
  }

  async deliver(id: string) {
    const row = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!row || row.status === 'SENT') return;
    const { title, body } = render(row.template, row.locale, row.params as Record<string, unknown>);
    const dir = row.locale === 'ar' ? 'rtl' : 'ltr';
    const html = `<!doctype html><html dir="${dir}" lang="${row.locale}"><body style="font-family:Arial,sans-serif;background:#f6f5f2;padding:24px;color:#0b1b33">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:8px;padding:32px;border-top:4px solid #c8a96a">
<h2 style="margin:0 0 16px;color:#0b1b33">${escapeHtml(title)}</h2><p style="line-height:1.6">${escapeHtml(body)}</p>
<p style="color:#8a8f98;font-size:12px;margin-top:32px">InfluenceHub — Where Brands Meet Influence</p></div></body></html>`;
    try {
      if (this.transport) {
        await this.transport.sendMail({ from: env().EMAIL_FROM, to: row.toAddress, subject: title, text: body, html });
      } else if (env().APP_ENV !== 'test') {
        this.logger.log(`[email:dev] to=${row.toAddress} subject="${title}" body="${body}"`);
      }
      await this.prisma.emailOutbox.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } } });
    } catch (e) {
      await this.prisma.emailOutbox.update({ where: { id }, data: { status: row.attempts >= 4 ? 'FAILED' : 'QUEUED', attempts: { increment: 1 }, lastError: (e as Error).message.slice(0, 500) } });
    }
  }

  async flushQueued(limit = 50) {
    const rows = await this.prisma.emailOutbox.findMany({ where: { status: 'QUEUED' }, take: limit, orderBy: { createdAt: 'asc' } });
    for (const r of rows) await this.deliver(r.id);
    return rows.length;
  }
}
