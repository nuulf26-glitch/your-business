import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, TrialPreviewController, UploadController, CustomerController, OrderController, PublicOrderController, StripeController, StripeWebhookController, HealthController } from './routes';
import { DbService } from './database';
import { SessionGuard, OriginGuard } from './session';
import { MediaStorage } from './media-storage';
import { MailService } from './mail';
import { PlatformRefundController } from './platform-refund';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [HealthController, AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, TrialPreviewController, UploadController, CustomerController, OrderController, PublicOrderController, StripeController, StripeWebhookController, PlatformRefundController],
  providers: [MediaStorage, DbService, SessionGuard, MailService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
