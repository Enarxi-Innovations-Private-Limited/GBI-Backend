import { Module } from '@nestjs/common';
import { TelemetryQueryService } from './telemetry-query.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TelemetryQueryService],
  exports: [TelemetryQueryService],
})
export class TelemetryModule {}
