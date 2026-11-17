import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { serviceUpsertSchema } from '@influencehub/shared';
import { AuthUser, CurrentUser, Public, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { ServicesService } from './services.service';

const packageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  titleAr: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().positive().max(10_000_000),
  deliveryDays: z.coerce.number().int().min(1).max(365),
  items: z.array(z.object({ serviceId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(20) })).min(2).max(10),
});

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly svc: ServicesService) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.svc.catalog();
  }

  @UserTypes('INFLUENCER')
  @Get('mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.myServices(u.id);
  }

  @UserTypes('INFLUENCER')
  @Get('suggestion')
  suggestion(@CurrentUser() u: AuthUser, @Query('catalogKey') key: string, @Query('usageRightsMonths') ur?: string, @Query('exclusivityMonths') ex?: string) {
    return this.svc.suggestionFor(u.id, key, { usageRightsMonths: ur ? Number(ur) : 0, exclusivityMonths: ex ? Number(ex) : 0 });
  }

  @UserTypes('INFLUENCER')
  @Post('mine')
  create(@CurrentUser() u: AuthUser, @Body(zbody(serviceUpsertSchema)) dto: z.infer<typeof serviceUpsertSchema>) {
    return this.svc.upsert(u.id, dto);
  }

  @UserTypes('INFLUENCER')
  @Patch('mine/:id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(serviceUpsertSchema)) dto: z.infer<typeof serviceUpsertSchema>) {
    return this.svc.upsert(u.id, dto, id);
  }

  @UserTypes('INFLUENCER')
  @Delete('mine/:id')
  archive(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.archive(u.id, id);
  }

  @UserTypes('INFLUENCER')
  @Get('packages')
  packages(@CurrentUser() u: AuthUser) {
    return this.svc.myPackages(u.id);
  }

  @UserTypes('INFLUENCER')
  @Post('packages')
  createPackage(@CurrentUser() u: AuthUser, @Body(zbody(packageSchema)) dto: z.infer<typeof packageSchema>) {
    return this.svc.createPackage(u.id, dto);
  }

  @UserTypes('INFLUENCER')
  @Delete('packages/:id')
  archivePackage(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.archivePackage(u.id, id);
  }
}
