import { Module, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
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
import { TestReportsModule } from './test-reports/test-reports.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
    TestReportsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 15 * 60 * 1000, // 15 minutes
        limit: 100,
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
export class AppModule {}
