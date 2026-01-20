import { Module, RequestMethod } from '@nestjs/common';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
