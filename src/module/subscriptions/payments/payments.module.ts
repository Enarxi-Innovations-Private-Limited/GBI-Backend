import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PremiumModule } from '../../premium/premium.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PremiumModule, PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
