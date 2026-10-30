import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, UploadController, CustomerController, OrderController, PublicOrderController, PayPalController, StripeController, PlatformRefundController, HealthController } from './routes';
import { DbService } from './database';
import { SessionGuard, OriginGuard } from './session';
import { MailService } from './mail';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [HealthController, AuthController, BusinessController, ProductController, PublicProductController, PublicBusinessController, WebsiteController, UploadController, CustomerController, OrderController, PublicOrderController, PayPalController, StripeController, PlatformRefundController],
  providers: [DbService, SessionGuard, MailService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
