import { Module } from '@nestjs/common';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [PlansModule, PaymentsModule],
  exports: [PlansModule, PaymentsModule],
})
export class SubscriptionsModule {}
