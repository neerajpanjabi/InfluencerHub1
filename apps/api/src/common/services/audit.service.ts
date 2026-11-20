import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@influencehub/database';
import { PrismaService } from './prisma.service';

export interface AuditContext {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

const REDACT = /password|token|secret|hash|totp/i;

function redact(v: unknown): unknown {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(redact);
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, REDACT.test(k) ? '[REDACTED]' : redact(val)]));
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async log(ctx: AuditContext, action: string, entityType: string, entityId?: string | null, before?: unknown, after?: unknown, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          actorId: ctx.actorId ?? null,
          action,
          entityType,
          entityId: entityId ?? null,
          before: before === undefined ? undefined : (JSON.parse(JSON.stringify(redact(before))) as Prisma.InputJsonValue),
          after: after === undefined ? undefined : (JSON.parse(JSON.stringify(redact(after))) as Prisma.InputJsonValue),
          ipAddress: ctx.ip ?? null,
          userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        },
      });
    } catch (e) {
      // Audit failures must be visible; inside a transaction they propagate to abort the change.
      this.logger.error(`Audit log failed for ${action}: ${(e as Error).message}`);
      if (tx) throw e;
    }
  }
}
