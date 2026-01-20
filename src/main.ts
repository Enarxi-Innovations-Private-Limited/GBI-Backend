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
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(import('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET || 'my-secret', // for signed cookies
  });
  
  app.enableCors({
    origin: true, // Allow all origins for dev, or specify frontend URL
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new BigIntInterceptor());
  const port = process.env.PORT ?? 3000;
  await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
  Logger.log(`Server running on http://localhost:${port}`);
  Logger.log("Application Adapter: "+app.getHttpAdapter().getType());
}
bootstrap();
