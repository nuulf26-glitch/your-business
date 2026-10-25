import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController, BusinessController, ProductController, WebsiteController, UploadController } from './routes';
import { DbService } from './database';
import { SessionGuard } from './session';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  controllers: [AuthController, BusinessController, ProductController, WebsiteController, UploadController],
  providers: [DbService, SessionGuard, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
