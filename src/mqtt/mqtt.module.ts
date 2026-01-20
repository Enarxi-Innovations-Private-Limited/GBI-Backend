import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConsumer } from './mqtt.consumer';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AlertsModule } from 'src/alerts/alerts.module';
import { DeviceMonitorService } from './device-monitor.service';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [MqttService, MqttConsumer, DeviceMonitorService],
})
export class MqttModule {}
