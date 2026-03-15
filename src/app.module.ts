import {
  Module,
  RequestMethod,
  NestModule,
  MiddlewareConsumer,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './module/users/users.module';
import { AdminModule } from './module/admin/admin.module';
import { PremiumModule } from './module/premium/premium.module';
import { RedisModule } from './redis/redis.module';
import { DevicesModule } from './module/devices/devices.module';
import { MqttModule } from './mqtt/mqtt.module';
import { AlertsModule } from './alerts/alerts.module';
import { InAppNotificationsModule } from './in-app-notifications/in-app-notifications.module';
import { ReportsModule } from './reports/reports.module';
import { RealtimeModule } from './realtime/realtime.module';
import { GroupsModule } from './groups/groups.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes config available everywhere
    }),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    UsersModule,
    AdminModule,
    PremiumModule,
    RedisModule,
    DevicesModule,
    MqttModule,
    AlertsModule,
    InAppNotificationsModule,
    ReportsModule,
    RealtimeModule,
    GroupsModule,
    MailModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return {
          connection: {
            url: redisUrl,
            family: 0, // Crucial for IPv6 / Upstash
            tls: { rejectUnauthorized: false }, // Always enable TLS (matches redis.module.ts)
            maxRetriesPerRequest: null, // Required by BullMQ — it manages its own command retries
            enableReadyCheck: false,

            // --- Upstash request-limit protection ---
            // When Upstash rejects commands (rate limit / disconnect) ioredis
            // will keep reconnecting. Without a cap this creates an infinite
            // retry storm that floods the terminal and consumes the daily quota.
            // Exponential backoff: 500 ms → 1 s → 1.5 s → … → 5 s max.
            // After 10 failed reconnect attempts the client stops trying.
            retryStrategy: (times: number) => {
              if (times > 10) return null; // give up — avoids runaway log spam
              return Math.min(times * 500, 5000);
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 300, // Adjusted to 300 (safe balance for polling)
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
