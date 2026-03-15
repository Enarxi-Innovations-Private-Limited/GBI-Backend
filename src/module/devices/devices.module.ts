import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';
import { RedisModule } from '../../redis/redis.module';
import { TelemetryModule } from '../../telemetry/telemetry.module';

@Module({
  imports: [RedisModule, TelemetryModule],
  controllers: [DevicesController],
  providers: [DevicesService, DevicesRepository],
})
export class DevicesModule {}
