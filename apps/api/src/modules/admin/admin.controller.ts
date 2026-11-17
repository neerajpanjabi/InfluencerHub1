import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ADMIN_ROLES, CAMPAIGN_STATUSES, EMIRATES, passwordSchema } from '@influencehub/shared';
import { ReqMeta, RequirePermissions } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import type { AuditContext } from '../../common/services/audit.service';
import { AdminService } from './admin.service';
import { FinanceService } from '../finance/finance.service';
import { AiService } from '../ai/ai.service';
import { PrivacyService } from '../privacy/privacy.service';
import { CommerceService } from '../commerce/commerce.service';

const platformEnum = z.enum(['INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE']);
const range = (q: { from?: string; to?: string }) => ({ from: q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86_400_000), to: q.to ? new Date(q.to) : new Date(Date.now() + 86_400_000) });

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService, private readonly finance: FinanceService, private readonly ai: AiService, private readonly privacy: PrivacyService, private readonly commerce: CommerceService) {}

  @RequirePermissions('reports.read')
  @Get('dashboard')
  dashboard() {
    return this.svc.dashboard();
  }

  // Users
  @RequirePermissions('users.read')
  @Get('users')
  users(@Query() q: any) {
    return this.svc.listUsers({ ...q, page: q.page ? Number(q.page) : 1 });
  }
  @RequirePermissions('users.manage')
  @Post('users/:id/status')
  userStatus(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }))) b: { status: 'ACTIVE' | 'SUSPENDED' }) {
    return this.svc.setUserStatus(m, id, b.status);
  }
  @RequirePermissions('admins.manage')
  @Post('users/:id/roles')
  roles(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ roles: z.array(z.enum(Object.keys(ADMIN_ROLES) as [string, ...string[]])).min(1) }))) b: { roles: string[] }) {
    return this.svc.setAdminRoles(m, id, b.roles);
  }
  @RequirePermissions('admins.manage')
  @Post('admins')
  createAdmin(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ email: z.string().email(), password: passwordSchema, roles: z.array(z.enum(Object.keys(ADMIN_ROLES) as [string, ...string[]])).min(1) }))) b: any) {
    return this.svc.createAdmin(m, b.email, b.password, b.roles);
  }
  @RequirePermissions('contact_fees.manage')
  @Post('businesses/:id/contact-credits')
  credits(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ credits: z.number().int().min(1).max(100) }))) b: { credits: number }) {
    return this.svc.grantContactCredits(m, id, b.credits);
  }
  @RequirePermissions('contact_fees.manage')
  @Post('contact-access')
  contactAccess(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ businessId: z.string().uuid(), influencerId: z.string().uuid(), days: z.number().int().min(1).max(3650).nullable() }))) b: any) {
    return this.svc.grantContactAccess(m, b.businessId, b.influencerId, b.days);
  }
  @RequirePermissions('users.manage')
  @Patch('influencers/:id/flags')
  flags(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ isFeatured: z.boolean().optional(), isPublic: z.boolean().optional() }))) b: any) {
    return this.svc.setInfluencerFlags(m, id, b);
  }

  // Verification
  @RequirePermissions('users.read')
  @Get('verifications')
  verifications(@Query('type') type?: string, @Query('status') status?: string) {
    return this.svc.listVerifications(type, status);
  }
  @RequirePermissions('influencers.verify')
  @Post('verifications/:id/decide')
  decide(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ decision: z.enum(['VERIFIED', 'REJECTED']), notes: z.string().max(1000).optional() }))) b: any) {
    return this.svc.decideVerification(m, id, b.decision, b.notes);
  }

  // Categories & catalogue
  @RequirePermissions('categories.manage')
  @Put('categories')
  category(
    @ReqMeta() m: AuditContext,
    @Body(zbody(z.object({ id: z.string().uuid().optional(), slug: z.string().regex(/^[a-z0-9-]{2,60}$/), nameEn: z.string().min(2).max(100), nameAr: z.string().min(2).max(100), parentId: z.string().uuid().nullable().optional(), icon: z.string().max(40).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional(), requiresMedicalCompliance: z.boolean().optional(), commissionRate: z.number().min(0).max(50).nullable().optional(), descriptionEn: z.string().max(500).optional(), descriptionAr: z.string().max(500).optional() }))) b: any,
  ) {
    return this.svc.upsertCategory(m, b);
  }
  @RequirePermissions('services.manage')
  @Put('catalog')
  catalog(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ id: z.string().uuid().optional(), key: z.string().regex(/^[a-z0-9_]{2,60}$/), platform: platformEnum, nameEn: z.string().min(2).max(100), nameAr: z.string().min(2).max(100), descriptionEn: z.string().max(500).optional(), descriptionAr: z.string().max(500).optional(), complexityFactor: z.number().min(0.5).max(3).optional(), isActive: z.boolean().optional(), commissionRate: z.number().min(0).max(50).nullable().optional(), defaultDeliverables: z.array(z.object({ type: z.string(), platform: platformEnum, quantity: z.number().int().min(1) })).optional() }))) b: any) {
    return this.svc.upsertCatalog(m, b);
  }

  // Benchmarks
  @RequirePermissions('benchmarks.manage')
  @Get('benchmarks')
  benchmarks() {
    return this.svc.listBenchmarks();
  }
  @RequirePermissions('benchmarks.manage')
  @Put('benchmarks')
  benchmark(
    @ReqMeta() m: AuditContext,
    @Body(zbody(z.object({ id: z.string().uuid().optional(), categoryId: z.string().uuid().nullable().optional(), subcategory: z.string().max(80).nullable().optional(), emirate: z.enum(EMIRATES).nullable().optional(), platform: platformEnum, catalogId: z.string().uuid().nullable().optional(), grade: z.enum(['S', 'A', 'B', 'C', 'D', 'NOT_RATED']).nullable().optional(), followersMin: z.number().int().nullable().optional(), followersMax: z.number().int().nullable().optional(), avgViewsMin: z.number().int().nullable().optional(), avgViewsMax: z.number().int().nullable().optional(), minRate: z.number().positive(), medianRate: z.number().positive(), maxRate: z.number().positive(), isSample: z.boolean(), researchSource: z.string().min(3).max(300), researchedAt: z.string().date().nullable().optional() }))) b: any,
  ) {
    return this.svc.upsertBenchmark(m, b);
  }
  @RequirePermissions('benchmarks.manage')
  @Delete('benchmarks/:id')
  deleteBenchmark(@ReqMeta() m: AuditContext, @Param('id') id: string) {
    return this.svc.deleteBenchmark(m, id);
  }

  // Grading
  @RequirePermissions('grading.manage')
  @Get('grading')
  grading() {
    return this.svc.gradingConfig();
  }
  @RequirePermissions('grading.manage')
  @Post('grading')
  publishGrading(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ config: z.record(z.any()), notes: z.string().min(3).max(500) }))) b: any) {
    return this.svc.publishGradingVersion(m, b.config, b.notes);
  }

  // Settings (contact fees, commission, VAT, pricing, platform, AI, messaging)
  @RequirePermissions('settings.manage')
  @Get('settings/:key')
  getSetting(@Param('key') key: string) {
    return this.svc.getSetting(key);
  }
  @RequirePermissions('contact_fees.manage')
  @Patch('settings/contact')
  contactSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ contactFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), freeContactAllowance: z.number().int().min(0).max(100).optional(), accessDurationDays: z.number().int().min(1).max(3650).nullable().optional(), maxContactsPerDay: z.number().int().min(1).max(1000).optional(), refundPolicy: z.enum(['NON_REFUNDABLE', 'REFUNDABLE_IF_NO_REPLY_7_DAYS', 'MANUAL_REVIEW']).optional(), packages: z.array(z.object({ key: z.string(), contacts: z.number().int().min(1), price: z.string() })).optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'contact', b);
  }
  @RequirePermissions('commissions.manage')
  @Patch('settings/commission')
  commissionSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ defaultRate: z.number().min(0).max(50).optional(), payer: z.enum(['BUSINESS', 'INFLUENCER', 'SPLIT']).optional(), splitBusinessShare: z.number().min(0).max(100).optional(), minCommission: z.string().nullable().optional(), maxCommission: z.string().nullable().optional(), categoryRates: z.record(z.number().min(0).max(50)).optional(), serviceRates: z.record(z.number().min(0).max(50)).optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'commission', b);
  }
  @RequirePermissions('commissions.manage')
  @Patch('settings/vat')
  vatSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ standardRate: z.number().min(0).max(30).optional(), pricesIncludeVat: z.boolean().optional(), platformVatRegistered: z.boolean().optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'vat', b);
  }
  @RequirePermissions('benchmarks.manage')
  @Patch('settings/pricing')
  pricingSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.record(z.any()))) b: any) {
    return this.svc.setSetting(m, 'pricing', b);
  }
  @RequirePermissions('settings.manage')
  @Patch('settings/platform')
  platformSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ legalName: z.string().max(200).optional(), trn: z.string().regex(/^\d{15}$/).nullable().optional(), address: z.string().max(300).optional(), supportEmail: z.string().email().optional(), autoCompleteDaysAfterPublish: z.number().int().min(1).max(60).optional(), payoutHoldDays: z.number().int().min(0).max(90).optional(), maintenanceMode: z.boolean().optional(), requireBusinessApproval: z.boolean().optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'platform', b);
  }
  @RequirePermissions('ai.manage')
  @Patch('settings/ai')
  aiSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ maxResults: z.number().int().min(1).max(50).optional(), explain: z.boolean().optional(), minScore: z.number().optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'ai', b);
  }
  @RequirePermissions('moderation.manage')
  @Patch('settings/messaging')
  messagingSettings(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ maxMessagesPerMinute: z.number().int().min(1).max(200).optional(), blockContactDetailsBeforeBooking: z.boolean().optional(), bannedTerms: z.array(z.string().max(60)).max(500).optional() }).strict())) b: any) {
    return this.svc.setSetting(m, 'messaging', b);
  }

  // Bookings & campaigns
  @RequirePermissions('bookings.read')
  @Get('orders')
  orders(@Query('status') status?: string) {
    return this.svc.listOrders(status);
  }
  @RequirePermissions('bookings.read')
  @Get('campaigns')
  campaigns(@Query('status') status?: string, @Query('compliance') compliance?: string) {
    return this.svc.listCampaigns(status, compliance);
  }
  @RequirePermissions('campaigns.manage')
  @Post('campaigns/:id/compliance')
  compliance(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ status: z.enum(['APPROVED', 'REJECTED']), notes: z.string().max(1000).optional() }))) b: any) {
    return this.svc.setCompliance(m, id, b.status, b.notes);
  }
  @RequirePermissions('campaigns.manage')
  @Post('campaigns/:id/transition')
  transition(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ to: z.enum(CAMPAIGN_STATUSES), note: z.string().max(1000).optional() }))) b: any) {
    return this.svc.adminTransitionCampaign(m, id, b.to, b.note);
  }

  // Payments, refunds, payouts
  @RequirePermissions('payments.read')
  @Get('payments')
  payments(@Query('status') status?: string) {
    return this.svc.listPayments(status);
  }
  @RequirePermissions('payments.read')
  @Get('invoices/:id')
  invoice(@ReqMeta() m: AuditContext, @Param('id') id: string) {
    return this.commerce.invoice(m.actorId!, id, true);
  }
  @RequirePermissions('refunds.manage')
  @Get('refunds')
  refunds(@Query('status') status?: string) {
    return this.finance.listRefunds(status);
  }
  @RequirePermissions('refunds.manage')
  @Post('refunds')
  refund(@ReqMeta() m: AuditContext, @Body(zbody(z.object({ orderItemId: z.string().uuid().optional(), contactPurchaseId: z.string().uuid().optional(), amount: z.number().positive(), reason: z.string().min(3).max(300) }))) b: any) {
    return this.finance.refund(m.actorId!, b);
  }
  @RequirePermissions('payouts.manage')
  @Get('payouts')
  payouts(@Query('status') status?: string) {
    return this.finance.listPayouts(status);
  }
  @RequirePermissions('payouts.manage')
  @Post('payouts/batch')
  batchPayouts(@ReqMeta() m: AuditContext) {
    return this.finance.createPayouts(m.actorId!);
  }
  @RequirePermissions('payouts.manage')
  @Post('payouts/:id/paid')
  paid(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ reference: z.string().min(3).max(120) }))) b: { reference: string }) {
    return this.finance.markPayoutPaid(m.actorId!, id, b.reference);
  }
  @RequirePermissions('payouts.manage')
  @Post('payouts/:id/status')
  payoutStatus(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ status: z.enum(['ON_HOLD', 'SCHEDULED', 'PROCESSING', 'FAILED']) }))) b: any) {
    return this.finance.setPayoutStatus(m.actorId!, id, b.status);
  }

  // Reports
  @RequirePermissions('reports.read')
  @Get('reports/revenue')
  revenue(@Query() q: { from?: string; to?: string; groupBy?: 'day' | 'week' | 'month' }) {
    const r = range(q);
    return this.finance.revenueReport(r.from, r.to, q.groupBy && ['day', 'week', 'month'].includes(q.groupBy) ? q.groupBy : 'day');
  }
  @RequirePermissions('reports.read')
  @Get('reports/breakdown/:dimension')
  breakdown(@Param('dimension') d: 'category' | 'influencer' | 'business', @Query() q: { from?: string; to?: string }) {
    const r = range(q);
    return this.finance.breakdown(['category', 'influencer', 'business'].includes(d) ? d : 'category', r.from, r.to);
  }
  @RequirePermissions('payments.read')
  @Post('reports/reconcile')
  reconcile(@Body(zbody(z.object({ provider: z.string().max(40), from: z.string().datetime(), to: z.string().datetime() }))) b: any) {
    return this.finance.reconcile(b.provider, new Date(b.from), new Date(b.to));
  }
  @RequirePermissions('payments.read')
  @Get('ledger')
  ledger(@Query('referenceId') referenceId?: string, @Query('account') account?: string) {
    return this.finance.ledgerEntries({ referenceId, account });
  }

  // Disputes
  @RequirePermissions('disputes.manage')
  @Get('disputes')
  disputes(@Query('status') status?: string) {
    return this.svc.listDisputes(status);
  }
  @RequirePermissions('disputes.manage')
  @Post('disputes/:id/resolve')
  resolve(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ status: z.enum(['UNDER_REVIEW', 'RESOLVED_BUSINESS', 'RESOLVED_INFLUENCER', 'RESOLVED_SPLIT', 'CLOSED']), resolution: z.string().max(3000).optional(), refundAmount: z.number().nonnegative().optional(), campaignOutcome: z.enum(['COMPLETED', 'CANCELLED', 'IN_PROGRESS']).optional() }))) b: any) {
    return this.svc.resolveDispute(m, id, b);
  }

  // Moderation
  @RequirePermissions('moderation.manage')
  @Get('moderation/reports')
  reports(@Query('status') status?: string) {
    return this.svc.listReports(status);
  }
  @RequirePermissions('moderation.manage')
  @Get('moderation/flagged-messages')
  flagged() {
    return this.svc.flaggedMessages();
  }
  @RequirePermissions('moderation.manage')
  @Post('moderation/reports/:id')
  actionReport(@ReqMeta() m: AuditContext, @Param('id') id: string, @Body(zbody(z.object({ action: z.enum(['DISMISS', 'REMOVE_CONTENT', 'SUSPEND_USER']) }))) b: any) {
    return this.svc.actionReport(m, id, b.action);
  }

  // AI
  @RequirePermissions('ai.manage')
  @Get('ai/quality')
  aiQuality() {
    return this.ai.quality();
  }
  @RequirePermissions('ai.manage')
  @Get('ai/logs')
  aiLogs() {
    return this.svc.aiLogs();
  }

  // Audit & integrations & privacy
  @RequirePermissions('audit.read')
  @Get('audit-logs')
  audit(@Query() q: any) {
    return this.svc.auditLogs(q);
  }
  @RequirePermissions('integrations.manage')
  @Get('integrations')
  integrations() {
    return this.svc.integrations();
  }
  @RequirePermissions('integrations.manage')
  @Patch('integrations/:provider')
  integration(@ReqMeta() m: AuditContext, @Param('provider') provider: string, @Body(zbody(z.object({ isEnabled: z.boolean().optional(), mode: z.enum(['sandbox', 'live']).optional(), publicConfig: z.record(z.any()).optional() }).strict())) b: any) {
    return this.svc.updateIntegration(m, provider, b);
  }
  @RequirePermissions('users.manage')
  @Get('privacy/deletions')
  deletions() {
    return this.svc.listDeletionRequests();
  }
  @RequirePermissions('users.manage')
  @Post('privacy/deletions/:id/process')
  processDeletion(@ReqMeta() m: AuditContext, @Param('id') id: string) {
    return this.privacy.processDeletion(m, id);
  }
}
