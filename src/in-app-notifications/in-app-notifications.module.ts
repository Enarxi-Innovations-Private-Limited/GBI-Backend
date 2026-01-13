import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InAppNotificationsController } from './in-app-notifications.controller';
import { InAppNotificationsService } from './in-app-notifications.service';
import { InAppNotificationsRepository } from './in-app-notifications.repository';

@Module({
  imports: [PrismaModule],
  controllers: [InAppNotificationsController],
  providers: [InAppNotificationsService, InAppNotificationsRepository],
  exports: [InAppNotificationsService],
})
export class InAppNotificationsModule {}
