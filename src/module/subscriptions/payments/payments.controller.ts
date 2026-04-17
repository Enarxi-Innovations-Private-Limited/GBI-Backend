import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FastifyRequest } from 'fastify';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  createOrder(
    @Body() dto: CreateOrderDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.paymentsService.createOrder(dto.planId, req.user.sub);
  }

  @Post('verify')
  verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.paymentsService.verifyPayment(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
      req.user.sub,
    );
  }
}
