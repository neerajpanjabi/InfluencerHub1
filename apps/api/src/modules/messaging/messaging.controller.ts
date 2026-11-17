import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { messageSchema } from '@influencehub/shared';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@UserTypes('BUSINESS', 'INFLUENCER')
@Controller('conversations')
export class MessagingController {
  constructor(private readonly svc: MessagingService) {}
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.conversations(u.id);
  }
  @Get(':id/messages')
  messages(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('before') before?: string) {
    return this.svc.messages(u.id, id, before);
  }
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/messages')
  send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(messageSchema)) b: z.infer<typeof messageSchema>) {
    return this.svc.send(u.id, id, b.body, b.attachmentIds);
  }
  @Post(':id/block')
  block(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.block(u.id, id);
  }
  @Post(':id/unblock')
  unblock(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.unblock(u.id, id);
  }
  @Post('reports')
  report(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ targetType: z.enum(['MESSAGE', 'USER', 'PROFILE', 'REVIEW']), targetId: z.string().uuid(), reason: z.string().trim().min(3).max(120), details: z.string().max(2000).optional() }))) b: any) {
    return this.svc.report(u.id, b);
  }
}
