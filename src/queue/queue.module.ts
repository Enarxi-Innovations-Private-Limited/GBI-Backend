import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');
        const password = configService.get<string>('REDIS_PASSWORD');
        const redisUrl = configService.get<string>('REDIS_URL');

        const connectionConfig: any = {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          reconnectOnError: (err: any) => {
            console.error('[BullMQ Redis] reconnectOnError:', err.message);
            return true;
          },
          retryStrategy: (times: number) => {
            return Math.min(times * 1000, 5000);
          },
        };

        if (host && port) {
          const tlsEnabled = configService.get<string>('REDIS_TLS') === 'true';
          connectionConfig.host = host;
          connectionConfig.port = port;
          
          if (tlsEnabled) {
            connectionConfig.tls = {};
          }
        } else if (redisUrl) {
          connectionConfig.url = redisUrl;
          if (redisUrl.startsWith('rediss://')) {
            connectionConfig.tls = { rejectUnauthorized: false };
          }
          connectionConfig.family = 0;
        } else {
          throw new Error('REDIS_HOST/PORT or REDIS_URL must be defined');
        }

        return {
          connection: connectionConfig,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'emailQueue',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
