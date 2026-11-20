import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { agreementContentSchema, agreementCreateSchema, agreementSignSchema } from '@influencehub/shared';
import { AuthUser, CurrentUser, ReqMeta, RequirePermissions, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import type { AuditContext } from '../../common/services/audit.service';
import { AgreementsService } from './agreements.service';

@ApiTags('agreements')
@UserTypes('BUSINESS', 'INFLUENCER')
@Controller('agreements')
export class AgreementsController {
  constructor(private readonly svc: AgreementsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }
  @Get('templates')
  templates(@CurrentUser() u: AuthUser, @Query('locale') locale?: string) {
    return this.svc.templates(locale === 'ar' || (!locale && u.locale === 'ar') ? 'ar' : 'en');
  }
  @Get('counterparties')
  counterparties(@CurrentUser() u: AuthUser) {
    return this.svc.counterparties(u.id);
  }
  @Post()
  create(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Body(zbody(agreementCreateSchema)) dto: z.infer<typeof agreementCreateSchema>) {
    return this.svc.create(u.id, dto, m);
  }
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u.id, id);
  }
  @Get(':id/versions/:versionId')
  version(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('versionId') vid: string) {
    return this.svc.version(u.id, id, vid);
  }
  @Post(':id/versions')
  revise(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(agreementContentSchema)) dto: z.infer<typeof agreementContentSchema>) {
    return this.svc.revise(u.id, id, dto, m);
  }
  @Post(':id/send')
  send(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Param('id') id: string) {
    return this.svc.send(u.id, id, m);
  }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/sign')
  sign(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(agreementSignSchema)) dto: z.infer<typeof agreementSignSchema>) {
    return this.svc.sign(u.id, id, dto, m, u.locale);
  }
  @Post(':id/decline')
  decline(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ reason: z.string().trim().min(3).max(1000) }))) b: { reason: string }) {
    return this.svc.decline(u.id, id, b.reason, m);
  }
  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @ReqMeta() m: AuditContext, @Param('id') id: string) {
    return this.svc.cancel(u.id, id, m);
  }
}

/** Read-only access for dispute handling. */
@ApiTags('admin')
@Controller('admin/agreements')
export class AdminAgreementsController {
  constructor(private readonly svc: AgreementsService) {}
  @RequirePermissions('disputes.manage')
  @Get()
  list(@Query('status') status?: string) {
    return this.svc.adminList(status);
  }
  @RequirePermissions('disputes.manage')
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u.id, id, true);
  }
  @RequirePermissions('disputes.manage')
  @Get(':id/versions/:versionId')
  version(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('versionId') vid: string) {
    return this.svc.version(u.id, id, vid, true);
  }
}
