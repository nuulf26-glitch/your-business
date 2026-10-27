import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express = require('express');
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './module';

export async function createApp() {
  if (!process.env.DATABASE_URL && process.env.NETLIFY_DB_URL) process.env.DATABASE_URL = process.env.NETLIFY_DB_URL;
  validateRuntimeEnvironment();
  const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false });
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
  app.enableCors({ origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => callback(null, !origin || isAllowedOrigin(origin, origins)), credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/api/v1/uploads', express.raw({ type: ['image/jpeg','image/png','image/webp','image/gif'], limit: '5mb' }));
  expressApp.use(express.json({ limit: '6mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '6mb' }));
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.setGlobalPrefix('api/v1');
  return app;
}

function isAllowedOrigin(origin: string, configured: string[]) {
  if (configured.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    const siteHost = process.env.SITE_NAME ? `${process.env.SITE_NAME}.netlify.app` : '';
    return !!siteHost && (host === siteHost || host.endsWith(`--${siteHost}`));
  } catch { return false; }
}

async function bootstrap() {
  const app = await createApp();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}

function validateRuntimeEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'PUBLIC_APP_URL'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const origins = (process.env.FRONTEND_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try { return new URL(origin).protocol !== 'https:'; } catch { return true; }
  })) missing.push('FRONTEND_ORIGIN (HTTPS origin required)');
  try {
    if (new URL(process.env.PUBLIC_APP_URL || '').protocol !== 'https:') missing.push('PUBLIC_APP_URL (HTTPS URL required)');
  } catch {
    missing.push('PUBLIC_APP_URL (valid HTTPS URL required)');
  }
  if (missing.length) throw new Error(`Missing or invalid production configuration: ${missing.join(', ')}`);
}

if (require.main === module) void bootstrap();
