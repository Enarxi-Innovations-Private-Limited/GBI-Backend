import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttConsumer } from './mqtt.consumer';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MqttService, MqttConsumer],
})
export class MqttModule {}
