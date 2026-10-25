import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, BusinessController, ProductController, WebsiteController, UploadController, CustomerController, OrderController, PayPalController, HealthController } from './routes';
import { DbService } from './database';
import { SessionGuard, OriginGuard } from './session';
import { MailService } from './mail';
import { FirebaseBridge } from './firebase-bridge';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [HealthController, AuthController, BusinessController, ProductController, WebsiteController, UploadController, CustomerController, OrderController, PayPalController],
  providers: [DbService, SessionGuard, MailService, FirebaseBridge, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
