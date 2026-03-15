import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PremiumRepository } from './premium.repository';
import { ActivatePremiumDto } from './dto/activate-premium.dto';
import { RenewPremiumDto } from './dto/renew-premium.dto';
import { RevokePremiumDto } from './dto/revoke-premium.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);

  constructor(private readonly repo: PremiumRepository) {}

  async getDashboard() {
    const [availableUsers, premiumUsers] = await Promise.all([
      this.repo.getAvailableUsers(),
      this.repo.getPremiumUsers(),
    ]);

    return { availableUsers, premiumUsers };
  }

  async activatePremium(dto: ActivatePremiumDto, adminId: string) {
    const user = await this.repo.findUserById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.isPremium) {
      throw new BadRequestException('User already has an active premium subscription');
    }

    const activationDate = new Date(dto.activationDate);
    const expiryDate = new Date(dto.expiryDate);

    if (expiryDate <= activationDate) {
      throw new BadRequestException('Expiry date must be after activation date');
    }

    if (expiryDate <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    const subscription = await this.repo.activatePremium(
      dto.userId,
      adminId,
      activationDate,
      expiryDate,
      dto.notes,
    );

    this.logger.log(
      `Premium activated for user ${dto.userId} by admin ${adminId}`,
    );

    return subscription;
  }

  async renewPremium(dto: RenewPremiumDto, adminId: string) {
    const user = await this.repo.findUserById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.isPremium) {
      throw new BadRequestException('User does not have an active premium subscription');
    }

    const newExpiryDate = new Date(dto.newExpiryDate);
    const currentExpiry = user.premiumExpiry;

    if (!currentExpiry) {
      throw new BadRequestException('User has no current expiry date');
    }

    if (newExpiryDate <= currentExpiry) {
      throw new BadRequestException(
        'New expiry date must be after the current expiry date',
      );
    }

    await this.repo.renewPremium(
      dto.userId,
      adminId,
      currentExpiry,
      newExpiryDate,
      dto.notes,
    );

    this.logger.log(
      `Premium renewed for user ${dto.userId} by admin ${adminId}`,
    );

    return { success: true };
  }

  async revokePremium(dto: RevokePremiumDto, adminId: string) {
    const user = await this.repo.findUserById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.isPremium) {
      throw new BadRequestException('User does not have an active premium subscription');
    }

    await this.repo.revokePremium(dto.userId, adminId, dto.reason);

    this.logger.log(
      `Premium revoked for user ${dto.userId} by admin ${adminId}`,
    );

    return { success: true };
  }

  async getPremiumHistory(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');

    return this.repo.getPremiumHistory(userId);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSubscriptions() {
    this.logger.log('Running premium expiry check...');

    const result = await this.repo.expireOverdueSubscriptions();

    if (result.expiredCount > 0) {
      this.logger.log(`Expired ${result.expiredCount} premium subscriptions`);
    } else {
      this.logger.log('No expired subscriptions found');
    }
  }
}
