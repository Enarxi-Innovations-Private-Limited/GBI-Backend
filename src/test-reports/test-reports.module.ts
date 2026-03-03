import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ReportsModule } from 'src/reports/reports.module';
import { TestReportsController } from './test-reports.controller';
import { TestReportsService } from './test-reports.service';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [TestReportsController],
  providers: [TestReportsService],
})
export class TestReportsModule {}
