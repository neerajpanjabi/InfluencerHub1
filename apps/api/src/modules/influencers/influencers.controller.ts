import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { influencerProfileUpdateSchema, influencerSearchSchema, type InfluencerSearchParams } from '@influencehub/shared';
import { AuthUser, CurrentUser, Public, UserTypes } from '../../common/decorators';
import { ZodPipe, zbody } from '../../common/pipes/zod.pipe';
import { GradingService } from '../grading/grading.service';
import { InfluencersService } from './influencers.service';
import { InfluencerSearchService } from './search.service';
import { PrismaService } from '../../common/services/prisma.service';

@ApiTags('influencers')
@Controller('influencers')
export class InfluencersController {
  constructor(private readonly svc: InfluencersService, private readonly search: InfluencerSearchService, private readonly grading: GradingService, private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list(@Query(new ZodPipe(influencerSearchSchema)) q: InfluencerSearchParams) {
    return this.search.search(q);
  }

  @Public()
  @Get('home')
  home() {
    return this.svc.homeSections();
  }

  @UserTypes('INFLUENCER')
  @Get('me/profile')
  me(@CurrentUser() u: AuthUser) {
    return this.svc.myProfile(u.id);
  }

  @UserTypes('INFLUENCER')
  @Get('me/dashboard')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.svc.dashboard(u.id);
  }

  @UserTypes('INFLUENCER')
  @Patch('me/profile')
  update(@CurrentUser() u: AuthUser, @Body(zbody(influencerProfileUpdateSchema)) dto: z.infer<typeof influencerProfileUpdateSchema>) {
    return this.svc.updateProfile(u.id, dto);
  }

  @UserTypes('INFLUENCER')
  @Get('me/grade')
  async grade(@CurrentUser() u: AuthUser) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId: u.id } });
    return { current: await this.grading.current(p.id), history: await this.grading.history(p.id) };
  }

  @UserTypes('INFLUENCER')
  @Post('me/grade/recompute')
  async recompute(@CurrentUser() u: AuthUser) {
    const p = await this.prisma.influencerProfile.findUniqueOrThrow({ where: { userId: u.id } });
    return this.grading.recompute(p.id);
  }

  @UserTypes('INFLUENCER')
  @Post('me/availability')
  addAvailability(
    @CurrentUser() u: AuthUser,
    @Body(zbody(z.object({ startsOn: z.string().date(), endsOn: z.string().date(), isAvailable: z.boolean().default(false), note: z.string().max(200).optional() }))) b: any,
  ) {
    return this.svc.addAvailability(u.id, b);
  }

  @UserTypes('INFLUENCER')
  @Delete('me/availability/:id')
  removeAvailability(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.removeAvailability(u.id, id);
  }

  @UserTypes('INFLUENCER')
  @Post('me/medical-credentials')
  medical(
    @CurrentUser() u: AuthUser,
    @Body(
      zbody(
        z.object({
          profession: z.string().trim().min(2).max(120),
          speciality: z.string().trim().max(120).optional(),
          licensingAuthority: z.enum(['DHA', 'DOH', 'MOHAP', 'OTHER']),
          licenceNumber: z.string().trim().min(3).max(60),
          licenceExpiry: z.string().date().optional(),
          documentId: z.string().uuid().optional(),
        }),
      ),
    )
    b: any,
  ) {
    return this.svc.submitMedicalCredential(u.id, b);
  }

  @UserTypes('INFLUENCER')
  @Post('me/verification/identity')
  identity(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ documentIds: z.array(z.string().uuid()).min(1).max(4) }))) b: { documentIds: string[] }) {
    return this.svc.requestIdentityVerification(u.id, b.documentIds);
  }

  @Public()
  @Get(':slug')
  profile(@Param('slug') slug: string, @CurrentUser() u?: AuthUser) {
    return this.svc.publicProfile(slug, u);
  }
}
