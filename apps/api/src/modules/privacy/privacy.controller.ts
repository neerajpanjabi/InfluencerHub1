import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy')
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly svc: PrivacyService) {}
  @Get('consents')
  consents(@CurrentUser() u: AuthUser) {
    return this.svc.consents(u.id);
  }
  @Post('consents')
  consent(@CurrentUser() u: AuthUser, @Req() req: Request, @Body(zbody(z.object({ type: z.enum(['MARKETING', 'SOCIAL_DATA_PROCESSING', 'PUBLIC_PROFILE']), granted: z.boolean() }))) b: { type: string; granted: boolean }) {
    return this.svc.recordConsent(u.id, b.type, b.granted, '2026-11', req.ip);
  }
  @Throttle({ default: { limit: 3, ttl: 3600_000 } })
  @Get('export')
  export(@CurrentUser() u: AuthUser) {
    return this.svc.exportData(u.id);
  }
  @Post('deletion')
  delete(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ reason: z.string().max(1000).optional() }))) b: { reason?: string }) {
    return this.svc.requestDeletion(u.id, b.reason);
  }
}
