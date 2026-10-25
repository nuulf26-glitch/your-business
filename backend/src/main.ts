import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './module';

async function bootstrap() {
  validateRuntimeEnvironment();
  const app = await NestFactory.create(AppModule, { cors: false });
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',');
  app.enableCors({ origin: origins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] });
  app.use(helmet());
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}

function validateRuntimeEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const origins = (process.env.FRONTEND_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { return new URL(origin).protocol !== 'https:'; } catch { return true; }
  })) missing.push('FRONTEND_ORIGIN (HTTPS origin required)');
  if (missing.length) throw new Error(`Missing or invalid production configuration: ${missing.join(', ')}`);
}

void bootstrap();
