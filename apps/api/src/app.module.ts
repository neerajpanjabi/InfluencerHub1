import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/throttler.guard';
import { env } from './config/env';
import { AuthGuard } from './common/guards/auth.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './common/services/prisma.service';
import { CryptoService } from './common/services/crypto.service';
import { AuditService } from './common/services/audit.service';
import { SettingsService } from './common/services/settings.service';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsService } from './modules/notifications/notifications.service';
import { EmailService } from './modules/notifications/email.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { QueueService } from './modules/queue/queue.service';
import { GradingService } from './modules/grading/grading.service';
import { SocialService } from './modules/social/social.service';
import { SocialController } from './modules/social/social.controller';
import { CategoriesModule } from './modules/categories/categories.controller';
import { InfluencersService } from './modules/influencers/influencers.service';
import { InfluencerSearchService } from './modules/influencers/search.service';
import { InfluencersController } from './modules/influencers/influencers.controller';
import { BusinessesModule } from './modules/businesses/businesses.controller';
import { ServicesService } from './modules/services/services.service';
import { ServicesController } from './modules/services/services.controller';
import { SavedModule } from './modules/saved/saved.controller';
import { LedgerService } from './modules/finance/ledger.service';
import { FinanceService } from './modules/finance/finance.service';
import { PaymentsService } from './modules/payments/payments.service';
import { PaymentsController } from './modules/payments/payments.controller';
import { FulfilmentService } from './modules/commerce/fulfilment.service';
import { CommerceService } from './modules/commerce/commerce.service';
import { CommerceController } from './modules/commerce/commerce.controller';
import { ContactService } from './modules/contact/contact.service';
import { QuotationsService } from './modules/quotations/quotations.service';
import { QuotationsController } from './modules/quotations/quotations.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { MessagingService } from './modules/messaging/messaging.service';
import { MessagingController } from './modules/messaging/messaging.controller';
import { UploadsService } from './modules/uploads/uploads.service';
import { UploadsController } from './modules/uploads/uploads.controller';
import { AiService } from './modules/ai/ai.service';
import { AiController } from './modules/ai/ai.controller';
import { PrivacyService } from './modules/privacy/privacy.service';
import { PrivacyController } from './modules/privacy/privacy.controller';
import { AdminService } from './modules/admin/admin.service';
import { AdminController } from './modules/admin/admin.controller';
import { HealthController } from './modules/health/health.controller';
import { FinanceController } from './modules/finance/finance.controller';

/** Infrastructure + domain services shared by the API and the worker. */
@Global()
@Module({
  providers: [
    PrismaService, CryptoService, AuditService, SettingsService, QueueService, EmailService, NotificationsService,
    GradingService, SocialService, InfluencersService, InfluencerSearchService, ServicesService, LedgerService, FinanceService,
    PaymentsService, FulfilmentService, CommerceService, ContactService, QuotationsService, CampaignsService, MessagingService,
    UploadsService, AiService, PrivacyService, AdminService,
  ],
  exports: [
    PrismaService, CryptoService, AuditService, SettingsService, QueueService, EmailService, NotificationsService,
    GradingService, SocialService, InfluencersService, InfluencerSearchService, ServicesService, LedgerService, FinanceService,
    PaymentsService, FulfilmentService, CommerceService, ContactService, QuotationsService, CampaignsService, MessagingService,
    UploadsService, AiService, PrivacyService, AdminService,
  ],
})
export class CoreModule {}

@Module({
  imports: [
    CoreModule,
    AuthModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    CategoriesModule,
    BusinessesModule,
    SavedModule,
  ],
  controllers: [
    NotificationsController, SocialController, InfluencersController, ServicesController, PaymentsController, CommerceController,
    QuotationsController, CampaignsController, MessagingController, UploadsController, AiController, PrivacyController, AdminController, HealthController, FinanceController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

/** Worker context: domain services only (no HTTP controllers). */
@Module({ imports: [CoreModule, AuthModule] })
export class WorkerModule {}
