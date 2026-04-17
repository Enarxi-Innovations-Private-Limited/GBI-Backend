import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { PremiumRepository } from '../../premium/premium.repository';
import * as crypto from 'crypto';
import { PremiumStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private razorpay: any;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private premiumRepo: PremiumRepository,
  ) {
    // We will initialize Razorpay dynamically to avoid issues if the package is still installing
    try {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: this.configService.get('RAZORPAY_KEY_ID'),
        key_secret: this.configService.get('RAZORPAY_KEY_SECRET'),
      });
    } catch (e) {
      this.logger.error('Failed to initialize Razorpay', e);
    }
  }

  async createOrder(planId: string, userId: string) {
    if (!this.razorpay) {
      this.logger.error('Razorpay SDK not initialized. Check your API keys.');
      throw new BadRequestException('Payment gateway is currently unavailable');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Invalid or inactive plan selected');
    }

    const amountInPaise = Math.round(plan.amount * 100);

    const options = {
      amount: amountInPaise,
      currency: plan.currency || 'INR',
      receipt: `receipt_${Date.now()}_${userId}`,
      notes: {
        planId: plan.id,
        userId: userId,
      },
    };

    try {
      const order = await this.razorpay.orders.create(options);
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
      };
    } catch (error) {
      this.logger.error('Error creating Razorpay order', error);
      throw new BadRequestException('Failed to create payment order');
    }
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    userId: string,
  ) {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac(
        'sha256',
        this.configService.get<string>('RAZORPAY_KEY_SECRET') || '',
      )
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Payment is authentic, process subscription
    // 1. Get the order details to find the plan
    try {
      const order = await this.razorpay.orders.fetch(razorpayOrderId);
      const planId = order.notes.planId;

      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) throw new BadRequestException('Plan not found for this order');

      const activationDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + plan.durationDays);

      // Using the existing PremiumRepository logic to activate premium
      // We'll pass 'SYSTEM' as the adminId or a specific ID if preferred.
      // Since this is an automated payment, we might want a system user.
      await this.premiumRepo.activatePremium(
        userId,
        'SYSTEM_PAYMENT', // Admin ID for audit logs
        activationDate,
        expiryDate,
        `Purchased ${plan.name} via Razorpay`,
      );

      // Also create a record in the Subscription table for detailed billing
      await this.prisma.subscription.create({
        data: {
          id: `sub_${razorpayOrderId}`,
          userId,
          planId: plan.id,
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          amountPaid: plan.amount,
          expiresAt: expiryDate,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      return { success: true, expiryDate };
    } catch (error) {
      this.logger.error('Error verifying Razorpay payment', error);
      throw new BadRequestException('Payment verification failed');
    }
  }
}
