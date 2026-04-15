import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PremiumActionType, PremiumStatus, SubStatus } from '@prisma/client';

@Injectable()
export class PremiumRepository {
  constructor(private readonly prisma: PrismaService) {}

  getAvailableUsers() {
    return this.prisma.user.findMany({
      where: { isPremium: false },
      select: {
        id: true,
        name: true,
        email: true,
        organization: true,
        phone: true,
        premiumStatus: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ─── OPTIMIZED ───
   * Old: Prisma's nested select with where/take inside findMany generates an N+1 subquery
   *      (one subquery per user row to fetch their active subscription).
   * New: Two parallel queries + in-app Map join — O(1) lookup per user instead of O(N) subquery.
   */
  async getPremiumUsers() {
    const users = await this.prisma.user.findMany({
      where: { isPremium: true },
      select: {
        id: true,
        name: true,
        email: true,
        organization: true,
        phone: true,
        premiumExpiry: true,
        premiumStatus: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);

    // Single query for all active subscriptions — uses @@index([userId]) + status filter
    const activeSubscriptions = await this.prisma.premiumSubscription.findMany({
      where: {
        userId: { in: userIds },
        status: SubStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        id: true,
        activationDate: true,
        expiryDate: true,
        status: true,
      },
    });

    // Build O(1) lookup map: userId → latest active subscription
    const subscriptionMap = new Map<string, (typeof activeSubscriptions)[0]>();
    for (const sub of activeSubscriptions) {
      // findMany with orderBy desc means first occurrence per userId is the latest
      if (!subscriptionMap.has(sub.userId)) {
        subscriptionMap.set(sub.userId, sub);
      }
    }

    return users.map((u) => ({
      ...u,
      premiumSubscriptions: subscriptionMap.has(u.id)
        ? [subscriptionMap.get(u.id)!]
        : [],
    }));
  }

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isPremium: true,
        premiumExpiry: true,
        premiumStatus: true,
      },
    });
  }

  getActiveSubscription(userId: string) {
    return this.prisma.premiumSubscription.findFirst({
      where: { userId, status: SubStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activatePremium(
    userId: string,
    adminId: string,
    activationDate: Date,
    expiryDate: Date,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.premiumSubscription.create({
        data: {
          userId,
          activatedByAdminId: adminId,
          activationDate,
          expiryDate,
          status: SubStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          premiumExpiry: expiryDate,
          premiumStatus: PremiumStatus.PREMIUM,
        },
      });

      await tx.premiumHistory.create({
        data: {
          userId,
          actionType: PremiumActionType.ACTIVATE,
          previousExpiry: null,
          newExpiry: expiryDate,
          adminId,
          notes,
        },
      });

      return subscription;
    });
  }

  async renewPremium(
    userId: string,
    adminId: string,
    previousExpiry: Date,
    newExpiryDate: Date,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.premiumSubscription.updateMany({
        where: { userId, status: SubStatus.ACTIVE },
        data: { expiryDate: newExpiryDate },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          premiumExpiry: newExpiryDate,
          premiumStatus: PremiumStatus.PREMIUM,
        },
      });

      await tx.premiumHistory.create({
        data: {
          userId,
          actionType: PremiumActionType.RENEW,
          previousExpiry,
          newExpiry: newExpiryDate,
          adminId,
          notes,
        },
      });
    });
  }

  async revokePremium(userId: string, adminId: string, reason: string) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const previousExpiry = await tx.user.findUnique({
        where: { id: userId },
        select: { premiumExpiry: true },
      });

      await tx.premiumSubscription.updateMany({
        where: { userId, status: SubStatus.ACTIVE },
        data: {
          status: SubStatus.REVOKED,
          revokedByAdminId: adminId,
          revokedReason: reason,
          revokedAt: now,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isPremium: false,
          premiumExpiry: now,
          premiumStatus: PremiumStatus.REVOKED,
        },
      });

      await tx.premiumHistory.create({
        data: {
          userId,
          actionType: PremiumActionType.REVOKE,
          previousExpiry: previousExpiry?.premiumExpiry,
          newExpiry: now,
          adminId,
          notes: reason,
        },
      });
    });
  }

  getPremiumHistory(userId: string) {
    return this.prisma.premiumHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * ─── OPTIMIZED ───
   * Old: findMany users → collect IDs → updateMany subscriptions → updateMany users (3 queries + race).
   *      Race condition: another process could update users between the SELECT and UPDATE.
   * New: Single transaction starting with the subscription UPDATE (source of truth),
   *      then sync the user flags. No pre-SELECT needed — WHERE clause IS the filter.
   *      Uses new @@index([status, expiryDate]) on PremiumSubscription for the initial scan.
   */
  async expireOverdueSubscriptions() {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Step 1: Expire subscriptions directly — DB does the filtering, no pre-SELECT
      const updatedSubs = await tx.premiumSubscription.updateMany({
        where: {
          status: SubStatus.ACTIVE,
          expiryDate: { lt: now },
        },
        data: { status: SubStatus.EXPIRED },
      });

      if (updatedSubs.count === 0) return { expiredCount: 0 };

      // Step 2: Sync user flags — matches exactly the users whose subscriptions just expired
      await tx.user.updateMany({
        where: {
          isPremium: true,
          premiumExpiry: { lt: now },
        },
        data: {
          isPremium: false,
          premiumStatus: PremiumStatus.EXPIRED,
        },
      });

      return { expiredCount: updatedSubs.count };
    });
  }
}
