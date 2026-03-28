import { Module, Global } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SseService } from './sse.service';
import { SseController } from './sse.controller';
import { AuthModule } from '../auth/auth.module';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [PrismaModule, JwtModule, ConfigModule, AuthModule],
  providers: [
    RealtimeService,
    SseService,
    {
      provide: 'REDIS_SUBSCRIBER',
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }
        const client = new Redis(url, {
          tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
          // Automatically reconnect with back-off on connection drop.
          // After reconnect, ioredis re-issues SUBSCRIBE for all active channels.
          retryStrategy: (times) => Math.min(times * 500, 5000),
          enableReadyCheck: true,
          lazyConnect: false,
        });
        client.on('reconnecting', () =>
          console.log('[REDIS_SUBSCRIBER] reconnecting…'),
        );
        client.on('ready', () => console.log('[REDIS_SUBSCRIBER] connected'));
        client.on('error', (err) =>
          console.error('[REDIS_SUBSCRIBER] error:', err.message),
        );
        return client;
      },
      inject: [ConfigService],
    },
  ],
  controllers: [SseController],
  exports: [RealtimeService, SseService],
})
export class RealtimeModule {}
