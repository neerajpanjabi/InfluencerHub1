import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CAMPAIGN_STATUSES } from '@influencehub/shared';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { CampaignsService } from './campaigns.service';

const briefSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  brief: z.string().trim().max(8000).optional(),
  requiredMentions: z.array(z.string().trim().max(60)).max(20).optional(),
  requiredHashtags: z.array(z.string().trim().max(60)).max(30).optional(),
  postingDeadline: z.string().datetime().optional(),
  requiresApproval: z.boolean().optional(),
  usageRights: z.string().trim().max(1000).optional(),
  contractTerms: z.string().trim().max(8000).optional(),
});

@ApiTags('campaigns')
@UserTypes('BUSINESS', 'INFLUENCER')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}
  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.svc.list(u.id, status);
  }
  @Get('reviews/mine')
  reviews(@CurrentUser() u: AuthUser) {
    return this.svc.myReviews(u.id);
  }
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u.id, id);
  }
  @Patch(':id/brief')
  brief(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(briefSchema)) dto: z.infer<typeof briefSchema>) {
    return this.svc.updateBrief(u.id, id, dto);
  }
  @Post(':id/transition')
  transition(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(z.object({ to: z.enum(CAMPAIGN_STATUSES), note: z.string().max(1000).optional() }))) b: { to: any; note?: string }) {
    return this.svc.transition(u.id, id, b.to, b.note);
  }
  @Post(':id/deliverables/:did/submit')
  submit(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('did') did: string, @Body(zbody(z.object({ draftUrl: z.string().url().max(500).optional(), draftNotes: z.string().max(3000).optional(), attachmentIds: z.array(z.string().uuid()).max(10).optional() }))) b: any) {
    return this.svc.submitDeliverable(u.id, id, did, b);
  }
  @Post(':id/deliverables/:did/review')
  reviewDeliverable(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('did') did: string, @Body(zbody(z.object({ decision: z.enum(['APPROVED', 'REVISION_REQUESTED']), comment: z.string().max(3000).optional() }))) b: any) {
    return this.svc.reviewDeliverable(u.id, id, did, b.decision, b.comment);
  }
  @Post(':id/deliverables/:did/publish')
  publish(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('did') did: string, @Body(zbody(z.object({ publishedUrl: z.string().url().max(500) }))) b: { publishedUrl: string }) {
    return this.svc.publishDeliverable(u.id, id, did, b.publishedUrl);
  }
  @Post(':id/review')
  review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional() }))) b: { rating: number; comment?: string }) {
    return this.svc.review(u.id, id, b.rating, b.comment);
  }
  @Post('reviews/:rid/respond')
  respond(@CurrentUser() u: AuthUser, @Param('rid') rid: string, @Body(zbody(z.object({ response: z.string().trim().min(1).max(2000) }))) b: { response: string }) {
    return this.svc.respondToReview(u.id, rid, b.response);
  }
  @Post(':id/dispute')
  dispute(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(z.object({ reason: z.string().trim().min(3).max(120), details: z.string().trim().min(10).max(5000) }))) b: { reason: string; details: string }) {
    return this.svc.raiseDispute(u.id, id, b.reason, b.details);
  }
}
