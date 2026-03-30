import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventLogsRepository } from './event-logs.repository';
import { EventLogsService } from './event-logs.service';
import { EventLogsController } from './event-logs.controller';

@Module({
  imports: [PrismaModule],
  providers: [EventLogsRepository, EventLogsService],
  controllers: [EventLogsController],
})
export class EventLogsModule {}
