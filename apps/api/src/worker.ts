import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { WorkerModule } from './app.module';
import { env } from './config/env';
import { QUEUES, redisConnection } from './modules/queue/queue.service';
import { SocialService } from './modules/social/social.service';
import { GradingService } from './modules/grading/grading.service';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { EmailService } from './modules/notifications/email.service';
import { PrismaService } from './common/services/prisma.service';

/**
 * Background worker: social sync, grade recomputation, scheduled maintenance
 * (due syncs, campaign auto-completion, email outbox retries, quotation expiry, state cleanup).
 */
export async function startWorker() {
  const ctx = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'warn', 'error'] });
  const log = new Logger('Worker');
  const social = ctx.get(SocialService);
  const grading = ctx.get(GradingService);
  const campaigns = ctx.get(CampaignsService);
  const email = ctx.get(EmailService);
  const prisma = ctx.get(PrismaService);
  const connection = redisConnection();

  const workers = [
    new Worker(QUEUES.SOCIAL_SYNC, async (job) => social.syncAccount(job.data.socialAccountId, job.data.trigger), { connection, concurrency: 4, limiter: { max: 30, duration: 60_000 } }),
    new Worker(QUEUES.GRADING, async (job) => grading.recompute(job.data.influencerId), { connection, concurrency: 8 }),
    new Worker(
      'maintenance',
      async (job) => {
        switch (job.name) {
          case 'enqueue-due-syncs':
            return { enqueued: await social.enqueueDueSyncs() };
          case 'auto-complete-campaigns':
            return { completed: await campaigns.autoComplete() };
          case 'flush-email':
            return { processed: await email.flushQueued() };
          case 'expire-quotations':
            return prisma.quotation.updateMany({ where: { status: 'SUBMITTED', validUntil: { lt: new Date() } }, data: { status: 'EXPIRED' } });
          case 'cleanup':
            await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } } });
            await prisma.oneTimeToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
            await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
            return { ok: true };
        }
      },
      { connection },
    ),
  ];
  for (const w of workers) {
    w.on('failed', (job, err) => log.warn(`${w.name}/${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`));
  }
  const maintenance = new Queue('maintenance', { connection });
  const schedules: Array<[string, string]> = [
    ['enqueue-due-syncs', '*/15 * * * *'],
    ['auto-complete-campaigns', '7 * * * *'],
    ['flush-email', '*/2 * * * *'],
    ['expire-quotations', '17 * * * *'],
    ['cleanup', '23 3 * * *'],
  ];
  for (const [name, pattern] of schedules) await maintenance.upsertJobScheduler(name, { pattern, tz: 'Asia/Dubai' }, { name });
  log.log(`Worker started (${env().APP_ENV}); queues: ${Object.values(QUEUES).join(', ')}, maintenance`);

  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await maintenance.close();
    await ctx.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) startWorker();
