import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/services/prisma.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
    }
    if (env().QUEUE_ENABLED) {
      const r = new IORedis(env().REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 2000 });
      try {
        await r.connect();
        await r.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'down';
      } finally {
        r.disconnect();
      }
    }
    if (Object.values(checks).includes('down')) throw new ServiceUnavailableException({ code: 'NOT_READY', checks });
    return { status: 'ready', checks };
  }
}
