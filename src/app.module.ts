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
        const isTls = redisUrl?.startsWith('rediss://');
        return {
          connection: {
            url: redisUrl,
            family: 0, // Crucial for IPv6 / Upstash
            ...(isTls ? { tls: { rejectUnauthorized: false } } : {}), // Crucial for self-signed or strict TLS in BullMQ
            maxRetriesPerRequest: null, // Required by BullMQ to prevent max retries crashing on Upstash disconnecting
            enableReadyCheck: false,
          },
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 1000, // Increased from 100 to allow dashboard polling
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
