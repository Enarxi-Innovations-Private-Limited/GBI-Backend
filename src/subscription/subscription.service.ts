import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import * as crypto from 'crypto';

// Use require for Razorpay as it doesn't have proper ESM types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class SubscriptionService {
  private razorpay: any;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get('RAZORPAY_KEY_SECRET'),
    });
  }

  // ─── Public: Get Available Plans ──────────────────────────────

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { durationDays: 'asc' },
    });
  }

  // ─── Public: Check Premium Status ─────────────────────────────

  async isPremium(userId: string): Promise<boolean> {
    // Check Redis cache first
    const cached = await this.redis.get(`premium:${userId}`);
    if (cached !== null) return cached === '1';

    const sub = await this.getActiveSubscription(userId);
    const result = !!sub;

    // Cache for 5 minutes
    await this.redis.set(`premium:${userId}`, result ? '1' : '0', 'EX', 300);
    return result;
  }

  async getActiveSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { expiresAt: 'desc' },
    });
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.getActiveSubscription(userId);
    return {
      isPremium: !!sub,
      subscription: sub
        ? {
            id: sub.id,
            plan: sub.plan.name,
            status: sub.status,
            activatedAt: sub.activatedAt,
            expiresAt: sub.expiresAt,
            daysRemaining: Math.max(
              0,
              Math.ceil(
                (sub.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              ),
            ),
          }
        : null,
    };
  }

  // ─── Payment: Create Razorpay Order ───────────────────────────

  async createOrder(userId: string, planId: string) {
    // Fetch the plan to get dynamic pricing
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException('Plan not found or inactive');
    }

    // Check if user already has an active subscription
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new BadRequestException(
        'You already have an active premium subscription',
      );
    }

    // Create Razorpay order (amount in paise)
    const order = await this.razorpay.orders.create({
      amount: Math.round(plan.amount * 100),
      currency: plan.currency,
      receipt: `sub_${userId}_${Date.now()}`,
      notes: {
        userId,
        planId,
        planName: plan.name,
      },
    });

    return {
      orderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      keyId: this.configService.get('RAZORPAY_KEY_ID'),
      planName: plan.name,
      durationDays: plan.durationDays,
    };
  }

  // ─── Payment: Verify & Activate ───────────────────────────────

  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    // 1. Verify HMAC signature
    const secret = this.configService.get('RAZORPAY_KEY_SECRET');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new ForbiddenException('Invalid payment signature');
    }

    // 2. Fetch the order to get planId from notes
    const order = await this.razorpay.orders.fetch(razorpayOrderId);
    const planId = order.notes?.planId;

    if (!planId) {
      throw new BadRequestException('Invalid order: missing plan reference');
    }

    // 3. Fetch the plan
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // 4. Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

    // 5. Create subscription record
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        expiresAt,
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        method: 'RAZORPAY',
        amountPaid: order.amount / 100,
      },
      include: { plan: true },
    });

    // 6. Invalidate Redis cache
    await this.redis.del(`premium:${userId}`);

    return {
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan.name,
        status: subscription.status,
        activatedAt: subscription.activatedAt,
        expiresAt: subscription.expiresAt,
      },
    };
  }

  // ─── Webhook: Razorpay Fallback ───────────────────────────────

  async handleWebhook(body: any, signature: string) {
    // Verify webhook signature
    const secret = this.configService.get('RAZORPAY_KEY_SECRET');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const event = body.event;
    const payment = body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const orderId = payment.order_id;

      // Check if already processed
      const existing = await this.prisma.subscription.findUnique({
        where: { orderId },
      });

      if (existing) return { status: 'already_processed' };

      // Fetch the order to get plan details
      const order = await this.razorpay.orders.fetch(orderId);
      const planId = order.notes?.planId;
      const userId = order.notes?.userId;

      if (!planId || !userId) return { status: 'missing_metadata' };

      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) return { status: 'plan_not_found' };

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + plan.durationDays);

      await this.prisma.subscription.create({
        data: {
          userId,
          planId,
          status: 'ACTIVE',
          expiresAt,
          paymentId: payment.id,
          orderId,
          method: 'RAZORPAY',
          amountPaid: payment.amount / 100,
        },
      });

      await this.redis.del(`premium:${userId}`);
      return { status: 'activated' };
    }

    return { status: 'ignored' };
  }

  // ─── Admin: Update Plan Pricing ───────────────────────────────

  async updatePlan(planId: string, data: { amount?: number; isActive?: boolean }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  // ─── Admin: Get All Plans (including inactive) ────────────────

  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { durationDays: 'asc' },
    });
  }
}
