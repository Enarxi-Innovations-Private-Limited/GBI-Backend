import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PremiumGuard } from './subscription.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PremiumGuard],
  exports: [SubscriptionService, PremiumGuard],
})
export class SubscriptionModule {}
