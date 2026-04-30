import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    // Attempt hostinger explicit config first
    const host = config.get<string>('REDIS_HOST');
    const port = config.get<number>('REDIS_PORT');
    const password = config.get<string>('REDIS_PASSWORD');
    
    // Fallback to URL for compatibility with existing settings if explicitly missing explicit configs
    const redisUrl = config.get<string>('REDIS_URL');

    let client: Redis;

    if (host && port) {
      console.log(`[Redis] Connecting via Host/Port: ${host}:${port}`);
      const tlsEnabled = config.get<string>('REDIS_TLS') === 'true';

      client = new Redis({
        host,
        port,
        tls: tlsEnabled ? {} : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        reconnectOnError: (err) => {
          console.error('[Redis] reconnectOnError:', err.message);
          return true;
        },
        retryStrategy: (times: number) => {
          return Math.min(times * 1000, 5000); // 1s up to 5s max
        },
      });
    } else if (redisUrl) {
      console.log("[Redis] Connecting via REDIS_URL");
      client = new Redis(redisUrl, {
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        family: 0,
        reconnectOnError: (err) => {
          console.error('[Redis] reconnectOnError:', err.message);
          return true;
        },
        retryStrategy: (times: number) => {
          return Math.min(times * 1000, 5000);
        },
      });
    } else {
      throw new Error('Redis configuration (REDIS_HOST/PORT or REDIS_URL) is missing');
    }

    client.on('error', (err) => {
      console.error('[Redis] General Error:', err.message);
    });

    client.on('connect', () => {
      console.log('[Redis] Connected to server successfully');
    });

    return client;
  },
  inject: [ConfigService],
};
