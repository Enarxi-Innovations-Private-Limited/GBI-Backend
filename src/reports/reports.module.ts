import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PdfService } from './pdf.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { ReportsProcessor } from './reports.processor';
import { ReportsScheduler } from './reports.scheduler';
import { TelemetryModule } from 'src/telemetry/telemetry.module';

@Module({
  imports: [
    PrismaModule,
    TelemetryModule,
    BullModule.registerQueue({
      name: 'reports',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfService, ReportsProcessor, ReportsScheduler],
})
export class ReportsModule {}
