import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env, isProd } from './config/env';
import { AppModule } from './app.module';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, logger: env().APP_ENV === 'test' ? ['error'] : ['log', 'warn', 'error'] });
  app.setGlobalPrefix('api/v1');
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: isProd() ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '100kb' });
  app.enableCors({ origin: [env().WEB_ORIGIN], credentials: true, allowedHeaders: ['content-type', 'x-csrf-token', 'authorization'], methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] });
  app.enableShutdownHooks();
  if (!isProd()) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('InfluenceHub API').setDescription('UAE influencer marketplace API (cookie auth + CSRF header; Bearer also accepted)').setVersion('1.0').addCookieAuth('ih_at').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
  return app;
}
