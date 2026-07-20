// Load environment variables first for Prisma v7
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

async function bootstrap() {
  /*
  const adapter = new FastifyAdapter();
  await adapter.getInstance().register(import('@fastify/express'));
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );
  */
  // Reverting to standard to avoid "use already added" conflict
  const adapter = new FastifyAdapter({ trustProxy: true });
  adapter.getInstance().addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { rawBody: true },
  );

  // app.setGlobalPrefix('api');

  await app.register(import('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || 'my-secret', // for signed cookies
  });

  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  await app.register(import('@fastify/compress'), {
    global: true,
  });

  // Explicitly allow the frontend URLs (comma-separated in .env)
  const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((url) => url.trim());

  app.enableCors({
    origin: frontendUrls,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-XSRF-TOKEN',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.useGlobalInterceptors(new BigIntInterceptor());

  // --- Swagger UI setup for dev/staging environments ---
  if (process.env.NODE_ENV !== 'production') {
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GBI Air Quality Monitor API')
      .setDescription('Interactive OpenAPI specification for GBI E2E integration endpoints.')
      .setVersion('1.4.1')
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
      })
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'refresh_token',
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    Logger.log('Swagger UI initialized at /docs');
  }

  const port = process.env.PORT ?? 4000;
  await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
  Logger.log(`Server running on http://localhost:${port}`);
  Logger.log('Application Adapter: ' + app.getHttpAdapter().getType());
}
bootstrap();
