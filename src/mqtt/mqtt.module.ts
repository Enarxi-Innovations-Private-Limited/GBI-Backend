import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConsumer } from './mqtt.consumer';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AlertsModule } from 'src/alerts/alerts.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { OfflineDetectorService } from './offline-detector.service';
import { DeviceStatusLoggerService } from './device-status-logger.service';

@Module({
  imports: [PrismaModule, AlertsModule, RealtimeModule],
  providers: [
    MqttService,
    MqttConsumer,
    OfflineDetectorService,
    DeviceStatusLoggerService,
  ],
  exports: [MqttService, DeviceStatusLoggerService],
})
export class MqttModule {}
