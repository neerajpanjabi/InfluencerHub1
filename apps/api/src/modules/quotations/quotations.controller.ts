import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { quotationRequestSchema, quotationSubmitSchema } from '@influencehub/shared';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { QuotationsService } from './quotations.service';

@ApiTags('quotations')
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly svc: QuotationsService) {}
  @UserTypes('BUSINESS', 'INFLUENCER')
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }
  @UserTypes('BUSINESS', 'INFLUENCER')
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u.id, id);
  }
  @UserTypes('BUSINESS')
  @Post()
  request(@CurrentUser() u: AuthUser, @Body(zbody(quotationRequestSchema)) dto: z.infer<typeof quotationRequestSchema>) {
    return this.svc.request(u.id, dto);
  }
  @UserTypes('INFLUENCER')
  @Post(':id/submit')
  submit(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(quotationSubmitSchema)) dto: z.infer<typeof quotationSubmitSchema>) {
    return this.svc.submit(u.id, id, dto);
  }
  @UserTypes('BUSINESS')
  @Post(':id/accept')
  accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.accept(u.id, id);
  }
  @UserTypes('BUSINESS', 'INFLUENCER')
  @Post(':id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.reject(u.id, id);
  }
}
