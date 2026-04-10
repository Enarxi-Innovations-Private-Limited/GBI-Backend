import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
	console.log("🔥 REDIS URL FROM CONFIG:", url);	
        if (!url) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }
        const client = new Redis(url, {
          tls: url.startsWith('rediss://')
            ? { rejectUnauthorized: false }
            : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          family: 0,
          retryStrategy: (times: number) => {
            return Math.min(times * 500, 5000);
          },
        });

        client.on('error', (err) => {
          console.error('[Redis] General Error:', err.message);
        });

        client.on('connect', () => {
          console.log('[Redis] Connected to server');
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
