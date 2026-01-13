import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConsumer } from './mqtt.consumer';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AlertsModule } from 'src/alerts/alerts.module';

@Module({
  imports: [PrismaModule, AlertsModule],
  providers: [MqttService, MqttConsumer],
})
export class MqttModule {}
