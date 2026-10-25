import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',');
  app.enableCors({ origin: origins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.setGlobalPrefix('api/v1');
  await app.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
void bootstrap();
