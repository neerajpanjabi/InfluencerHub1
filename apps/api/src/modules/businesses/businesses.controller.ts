import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { EMIRATES, uaePhoneSchema, ACTIVE_CAMPAIGN_STATUSES } from '@influencehub/shared';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';

const updateSchema = z.object({
  businessName: z.string().trim().min(2).max(120).optional(),
  contactPerson: z.string().trim().min(2).max(120).optional(),
  phone: uaePhoneSchema.optional(),
  emirate: z.enum(EMIRATES).optional(),
  city: z.string().trim().max(80).optional(),
  website: z.string().trim().url().max(200).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().max(500).optional(),
  tradeLicenceNumber: z.string().trim().max(60).optional(),
  tradeLicenceAuthority: z.string().trim().max(80).optional(),
  tradeLicenceExpiry: z.string().date().optional(),
  trnNumber: z.string().trim().regex(/^\d{15}$/).optional().or(z.literal('')),
  categoryIds: z.array(z.string().uuid()).min(1).max(5).optional(),
  campaignPreferences: z
    .object({
      goals: z.array(z.string().max(40)).max(6).optional(),
      platforms: z.array(z.enum(['INSTAGRAM', 'TIKTOK'])).optional(),
      monthlyBudget: z.coerce.number().nonnegative().optional(),
      targetEmirates: z.array(z.enum(EMIRATES)).optional(),
      languages: z.array(z.string().max(5)).max(6).optional(),
    })
    .optional(),
  completeOnboarding: z.boolean().optional(),
});

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async me(userId: string) {
    const b = await this.prisma.businessProfile.findUnique({ where: { userId }, include: { categories: { include: { category: true } }, user: { select: { email: true, emailVerifiedAt: true, phone: true, phoneVerifiedAt: true } } } });
    if (!b) throw new ForbiddenException();
    return b;
  }

  async update(userId: string, dto: z.infer<typeof updateSchema>) {
    const b = await this.me(userId);
    const { categoryIds, completeOnboarding, tradeLicenceExpiry, trnNumber, ...fields } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.businessProfile.update({
        where: { id: b.id },
        data: {
          ...fields,
          trnNumber: trnNumber === '' ? null : trnNumber,
          ...(tradeLicenceExpiry ? { tradeLicenceExpiry: new Date(tradeLicenceExpiry) } : {}),
          ...(completeOnboarding ? { onboardingCompleted: true } : {}),
        },
      });
      if (categoryIds) {
        if ((await tx.category.count({ where: { id: { in: categoryIds } } })) !== categoryIds.length) throw new BadRequestException({ code: 'INVALID_CATEGORY' });
        await tx.businessCategory.deleteMany({ where: { businessId: b.id } });
        await tx.businessCategory.createMany({ data: categoryIds.map((categoryId) => ({ businessId: b.id, categoryId })) });
      }
    });
    return this.me(userId);
  }

  async requestVerification(userId: string, documentIds: string[]) {
    const owned = await this.prisma.attachment.count({ where: { id: { in: documentIds }, ownerId: userId } });
    if (owned !== documentIds.length) throw new ForbiddenException({ code: 'ATTACHMENT_NOT_OWNED' });
    const b = await this.me(userId);
    await this.prisma.businessProfile.update({ where: { id: b.id }, data: { verificationStatus: 'PENDING' } });
    await this.audit.log({ actorId: userId }, 'business.verification.request', 'BusinessProfile', b.id);
    return this.prisma.verificationRecord.create({ data: { userId, type: 'BUSINESS_LICENCE', status: 'PENDING', documentIds, data: { tradeLicenceNumber: b.tradeLicenceNumber } } });
  }

  async dashboard(userId: string) {
    const b = await this.me(userId);
    const [active, pending, completed, spend, saved, quotes, events] = await Promise.all([
      this.prisma.campaign.count({ where: { businessId: b.id, status: { in: ACTIVE_CAMPAIGN_STATUSES as any } } }),
      this.prisma.campaign.count({ where: { businessId: b.id, status: { in: ['PAYMENT_PENDING', 'AWAITING_ACCEPTANCE', 'QUOTATION_REQUESTED', 'QUOTATION_SUBMITTED'] } } }),
      this.prisma.campaign.count({ where: { businessId: b.id, status: 'COMPLETED' } }),
      this.prisma.order.aggregate({ where: { businessId: b.id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, _sum: { grandTotal: true } }),
      this.prisma.savedInfluencer.count({ where: { businessId: b.id } }),
      this.prisma.quotation.count({ where: { businessId: b.id, status: 'SUBMITTED' } }),
      this.prisma.campaignEvent.findMany({ where: { campaign: { businessId: b.id } }, orderBy: { createdAt: 'desc' }, take: 8, include: { campaign: { select: { number: true, title: true } } } }),
    ]);
    const contactSpend = await this.prisma.contactPurchase.aggregate({ where: { businessId: b.id, status: 'SUCCEEDED' }, _sum: { totalAmount: true } });
    return {
      activeCampaigns: active,
      pendingBookings: pending,
      completedCampaigns: completed,
      totalSpending: (Number(spend._sum.grandTotal ?? 0) + Number(contactSpend._sum.totalAmount ?? 0)).toFixed(2),
      savedInfluencers: saved,
      pendingQuotations: quotes,
      recentActivity: events,
      onboardingCompleted: b.onboardingCompleted,
      verificationStatus: b.verificationStatus,
    };
  }
}

@ApiTags('businesses')
@UserTypes('BUSINESS')
@Controller('businesses/me')
export class BusinessesController {
  constructor(private readonly svc: BusinessesService) {}
  @Get()
  me(@CurrentUser() u: AuthUser) {
    return this.svc.me(u.id);
  }
  @Patch()
  update(@CurrentUser() u: AuthUser, @Body(zbody(updateSchema)) dto: z.infer<typeof updateSchema>) {
    return this.svc.update(u.id, dto);
  }
  @Get('dashboard')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.svc.dashboard(u.id);
  }
  @Post('verification')
  verify(@CurrentUser() u: AuthUser, @Body(zbody(z.object({ documentIds: z.array(z.string().uuid()).min(1).max(5) }))) b: { documentIds: string[] }) {
    return this.svc.requestVerification(u.id, b.documentIds);
  }
}

@Module({ controllers: [BusinessesController], providers: [BusinessesService], exports: [BusinessesService] })
export class BusinessesModule {}
