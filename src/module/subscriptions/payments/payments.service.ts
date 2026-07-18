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
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');

    if (!keyId || !keySecret) {
      this.logger.warn(
        'Razorpay API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing. Payments service will be disabled.',
      );
      return;
    }

    try {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
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

    // Razorpay receipt field max length is 40 characters
    const shortUserId = userId.replace(/-/g, '').substring(0, 10);
    const receipt = `rcpt_${Date.now()}_${shortUserId}`.substring(0, 40);

    const options = {
      amount: amountInPaise,
      currency: plan.currency || 'INR',
      receipt,
      notes: {
        planId: plan.id,
        userId: userId,
      },
    };

    try {
      this.logger.log(
        `Creating Razorpay order: amount=${amountInPaise}, currency=${options.currency}, receipt=${receipt}`,
      );
      const order = await this.razorpay.orders.create(options);
      this.logger.log(`Razorpay order created: ${order.id}`);
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
        key: this.configService.get<string>('RAZORPAY_KEY_ID'),
      };
    } catch (error) {
      // Expose the actual Razorpay API error for debugging
      const razorpayMsg =
        error?.error?.description || error?.message || JSON.stringify(error);
      this.logger.error(
        `Razorpay order creation failed: ${razorpayMsg}`,
        error,
      );
      throw new BadRequestException(
        `Failed to create payment order: ${razorpayMsg}`,
      );
    }
  }

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    userId: string,
  ) {
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const secret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || '';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      this.logger.error(
        `Signature mismatch! Expected: ${expectedSignature}, Received: ${razorpaySignature}`,
      );
      this.logger.error(
        `Used secret: ${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`,
      );
      throw new BadRequestException('Invalid payment signature');
    }

    try {
      const order = await this.razorpay.orders.fetch(razorpayOrderId);
      const planId = order.notes.planId;

      return await this.activateUserSubscription(
        userId,
        planId,
        razorpayOrderId,
        razorpayPaymentId,
      );
    } catch (error) {
      this.logger.error('Error verifying Razorpay payment', error);
      throw new BadRequestException('Payment verification failed');
    }
  }

  async activateUserSubscription(
    userId: string,
    planId: string,
    orderId: string,
    paymentId: string,
  ) {
    const existingSub = await this.prisma.subscription.findUnique({
      where: { id: `sub_${orderId}` },
    });

    if (existingSub) {
      this.logger.log(`Subscription for order ${orderId} already active.`);
      return { success: true, alreadyActivated: true };
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new BadRequestException('Plan not found');

    const activationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + plan.durationDays);

    await this.premiumRepo.activatePremium(
      userId,
      'SYSTEM_PAYMENT',
      activationDate,
      expiryDate,
      `Purchased ${plan.name} via Razorpay`,
    );

    await this.prisma.subscription.create({
      data: {
        id: `sub_${orderId}`,
        userId,
        planId: plan.id,
        orderId,
        paymentId,
        amountPaid: plan.amount,
        expiresAt: expiryDate,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`✅ Subscription activated for user ${userId} (Plan: ${plan.id})`);
    return { success: true, expiryDate };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET is not configured in .env');
      throw new BadRequestException('Webhook configuration error');
    }

    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(rawBody);
    const expectedSignature = shasum.digest('hex');

    if (expectedSignature !== signature) {
      this.logger.error('Invalid Razorpay webhook signature');
      throw new BadRequestException('Signature mismatch');
    }

    const payload = JSON.parse(rawBody.toString());
    const event = payload.event;

    this.logger.log(`Received Razorpay webhook event: ${event}`);

    if (event === 'order.paid') {
      const order = payload.payload.order.entity;
      const payment = payload.payload.payment.entity;

      const userId = order.notes?.userId;
      const planId = order.notes?.planId;
      const orderId = order.id;
      const paymentId = payment.id;

      if (userId && planId) {
        await this.activateUserSubscription(userId, planId, orderId, paymentId);
      } else {
        this.logger.warn(`Webhook order.paid missing notes: userId=${userId}, planId=${planId}`);
      }
    }

    return { received: true };
  }
}
