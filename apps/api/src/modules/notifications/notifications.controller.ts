import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Query('cursor') cursor?: string) {
    return { items: await this.svc.list(u.id, cursor), unread: await this.svc.unreadCount(u.id) };
  }

  @Get('unread-count')
  async unread(@CurrentUser() u: AuthUser) {
    return { unread: await this.svc.unreadCount(u.id) };
  }

  @Post('read')
  async read(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ ids: z.union([z.array(z.string().uuid()).max(100), z.literal('all')]) }))) body: { ids: string[] | 'all' }) {
    await this.svc.markRead(u.id, body.ids);
    return { ok: true };
  }

  @Post('preferences')
  async pref(
    @CurrentUser() u: AuthUser,
    @Body(zbody(z.object({ type: z.string().max(50), channel: z.enum(['IN_APP', 'EMAIL', 'SMS']), enabled: z.boolean() }))) b: { type: string; channel: 'IN_APP' | 'EMAIL' | 'SMS'; enabled: boolean },
  ) {
    await this.svc.setPreference(u.id, b.type, b.channel, b.enabled);
    return { ok: true };
  }
}
