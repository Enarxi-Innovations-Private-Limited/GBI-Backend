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

  getPremiumUsers() {
    return this.prisma.user.findMany({
      where: { isPremium: true },
      select: {
        id: true,
        name: true,
        email: true,
        organization: true,
        phone: true,
        premiumExpiry: true,
        premiumStatus: true,
        premiumSubscriptions: {
          where: { status: SubStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            activationDate: true,
            expiryDate: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
      // Create subscription record
      const subscription = await tx.premiumSubscription.create({
        data: {
          userId,
          activatedByAdminId: adminId,
          activationDate,
          expiryDate,
          status: SubStatus.ACTIVE,
        },
      });

      // Update user premium status
      await tx.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          premiumExpiry: expiryDate,
          premiumStatus: PremiumStatus.PREMIUM,
        },
      });

      // Log the action
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
      // Update the active subscription
      await tx.premiumSubscription.updateMany({
        where: { userId, status: SubStatus.ACTIVE },
        data: { expiryDate: newExpiryDate },
      });

      // Update user premium expiry
      await tx.user.update({
        where: { id: userId },
        data: {
          premiumExpiry: newExpiryDate,
          premiumStatus: PremiumStatus.PREMIUM,
        },
      });

      // Log the action
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

      // Revoke the active subscription
      await tx.premiumSubscription.updateMany({
        where: { userId, status: SubStatus.ACTIVE },
        data: {
          status: SubStatus.REVOKED,
          revokedByAdminId: adminId,
          revokedReason: reason,
          revokedAt: now,
        },
      });

      // Update user
      await tx.user.update({
        where: { id: userId },
        data: {
          isPremium: false,
          premiumExpiry: now,
          premiumStatus: PremiumStatus.REVOKED,
        },
      });

      // Log the action
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

  async expireOverdueSubscriptions() {
    const now = new Date();

    // Find users with expired premium
    const expiredUsers = await this.prisma.user.findMany({
      where: {
        isPremium: true,
        premiumExpiry: { lt: now },
      },
      select: { id: true },
    });

    if (expiredUsers.length === 0) return { expiredCount: 0 };

    const userIds = expiredUsers.map((u) => u.id);

    await this.prisma.$transaction(async (tx) => {
      // Mark subscriptions as expired
      await tx.premiumSubscription.updateMany({
        where: {
          userId: { in: userIds },
          status: SubStatus.ACTIVE,
          expiryDate: { lt: now },
        },
        data: { status: SubStatus.EXPIRED },
      });

      // Update users
      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: {
          isPremium: false,
          premiumStatus: PremiumStatus.EXPIRED,
        },
      });
    });

    return { expiredCount: expiredUsers.length };
  }
}
