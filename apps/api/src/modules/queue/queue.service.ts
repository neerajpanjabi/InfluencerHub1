import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { env } from '../../config/env';

export const QUEUES = { SOCIAL_SYNC: 'social-sync', GRADING: 'grading', EMAIL: 'email' } as const;

export function redisConnection() {
  const u = new URL(env().REDIS_URL);
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined, username: u.username || undefined, maxRetriesPerRequest: null as null };
}

/**
 * BullMQ producer. When QUEUE_ENABLED=false (tests / single-process dev) jobs run inline through
 * registered handlers so behaviour is identical without Redis.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues = new Map<string, Queue>();
  private inline = new Map<string, (data: any) => Promise<unknown>>();

  registerInline(queue: string, handler: (data: any) => Promise<unknown>) {
    this.inline.set(queue, handler);
  }

  async add(queue: string, name: string, data: Record<string, unknown>, opts: { jobId?: string; delayMs?: number } = {}) {
    if (!env().QUEUE_ENABLED) {
      const h = this.inline.get(queue);
      if (h) await h({ ...data, __job: name }).catch((e) => this.logger.warn(`inline job ${queue}/${name} failed: ${(e as Error).message}`));
      return;
    }
    let q = this.queues.get(queue);
    if (!q) {
      q = new Queue(queue, { connection: redisConnection() });
      this.queues.set(queue, q);
    }
    await q.add(name, data, {
      jobId: opts.jobId,
      delay: opts.delayMs,
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
