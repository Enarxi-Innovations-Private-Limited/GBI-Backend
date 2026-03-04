import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ─── Public: Get Available Plans ──────────────────────────────

  @Get('subscription/plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  // ─── User: Check Premium Status ───────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('subscription/status')
  getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getSubscriptionStatus(userId);
  }

  // ─── User: Create Razorpay Order ──────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('subscription/create-order')
  createOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.subscriptionService.createOrder(userId, dto.planId);
  }

  // ─── User: Verify Payment & Activate ──────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('subscription/verify-payment')
  verifyPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.subscriptionService.verifyPayment(
      userId,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }

  // ─── Webhook: Razorpay Fallback ───────────────────────────────

  @Post('webhook/razorpay')
  handleWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.subscriptionService.handleWebhook(body, signature);
  }

  // ─── Admin: Update Plan Pricing ───────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin/plans')
  getAllPlans() {
    return this.subscriptionService.getAllPlans();
  }

  @UseGuards(AdminGuard)
  @Patch('admin/plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptionService.updatePlan(id, dto);
  }
}
