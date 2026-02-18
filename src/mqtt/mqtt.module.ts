import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConsumer } from './mqtt.consumer';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AlertsModule } from 'src/alerts/alerts.module';
import { DeviceMonitorService } from './device-monitor.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [PrismaModule, AlertsModule, RealtimeModule],
  providers: [MqttService, MqttConsumer, DeviceMonitorService],
  exports: [MqttService],
})
export class MqttModule {}
