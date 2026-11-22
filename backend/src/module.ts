import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, TrialPreviewController, UploadController, CustomerController, OrderController, PublicOrderController, StripeController, StripeWebhookController, HealthController } from './routes';
import { DatabaseModule } from './database.module';
import { DbService } from './database';
import { SessionGuard, OriginGuard } from './session';
import { DatabaseThrottlerStorage } from './throttler-storage';
import { MediaStorage } from './media-storage';
import { MailService } from './mail';
import { PlatformRefundController } from './platform-refund';
import { CrmController } from './crm';
import { AnalyticsController } from './analytics';
import { CmsController, PublicCmsController } from './cms';
import { MarketingController } from './marketing';
import { MembershipsController, PublicMembershipsController } from './memberships';
import { PublicSupportController, SupportInboxController } from './support-inbox';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [DbService],
      useFactory: (db: DbService) => ({ throttlers: [{ ttl: 60_000, limit: 100 }], storage: new DatabaseThrottlerStorage(db) }),
    }),
  ],
  controllers: [HealthController, AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, TrialPreviewController, UploadController, CustomerController, OrderController, PublicOrderController, StripeController, StripeWebhookController, PlatformRefundController, CrmController, AnalyticsController, CmsController, PublicCmsController, MarketingController, MembershipsController, PublicMembershipsController, PublicSupportController, SupportInboxController],
  providers: [MediaStorage, SessionGuard, MailService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
