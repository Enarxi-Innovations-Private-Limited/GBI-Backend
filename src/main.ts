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
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
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
