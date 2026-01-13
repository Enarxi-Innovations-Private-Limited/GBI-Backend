import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

@Module({
  imports: [PrismaModule],
  providers: [AlertsService, AlertsRepository],
  exports: [AlertsService],
})
export class AlertsModule {}
