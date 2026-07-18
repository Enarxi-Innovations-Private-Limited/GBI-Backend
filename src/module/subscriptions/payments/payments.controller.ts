import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FastifyRequest } from 'fastify';

@Controller('subscriptions')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  createOrder(
    @Body() dto: CreateOrderDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.paymentsService.createOrder(dto.planId, req.user.id);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.paymentsService.verifyPayment(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
      req.user.id,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: FastifyRequest & { rawBody?: Buffer },
  ) {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.rawBody;

    if (!signature || !rawBody) {
      throw new BadRequestException('Missing signature or body payload');
    }

    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
