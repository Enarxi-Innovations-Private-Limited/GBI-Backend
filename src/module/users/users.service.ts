import { AuthService } from 'src/auth/auth.service';
import { UsersRepository } from './users.repository';
import { BadRequestException, Inject, Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import Redis from 'ioredis';
import { randomInt } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly authService: AuthService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      phone: user.phone,
      city: user.city,
      isProfileComplete: user.isProfileComplete,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.usersRepo.updateProfile(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    return this.authService.changePassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  // --- Email Verification Flow ---

  async requestEmailVerification(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) throw new BadRequestException('Email already verified');

    // Rate Limit Check
    await this.checkRateLimit(userId, 'email');

    const otp = this.generateOtp();
    const key = `otp_email:${userId}`;

    // Store OTP in Redis with 5 minutes expiration (300 seconds)
    await this.redis.set(key, otp, 'EX', 300);

    // TODO: Replace with real email service (SendGrid/AWS SES)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MOCK EMAIL] OTP for user ${userId}: ${otp}`);
    }

    return { message: 'OTP sent to email (check server logs)' };
  }

  async verifyEmail(userId: string, code: string) {
    const key = `otp_email:${userId}`;
    const storedOtp = await this.redis.get(key);

    if (!storedOtp || storedOtp !== code) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.usersRepo.markEmailAsVerified(userId);
    await this.redis.del(key); // Cleanup

    return { success: true, message: 'Email verified successfully' };
  }

  // --- Phone Verification Flow ---

  async requestPhoneVerification(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.phoneVerified) throw new BadRequestException('Phone already verified');

    // Rate Limit Check
    await this.checkRateLimit(userId, 'phone');

    const otp = this.generateOtp();
    const key = `otp_phone:${userId}`;

    await this.redis.set(key, otp, 'EX', 300);

    // TODO: Replace with real SMS service (Twilio/SNS)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MOCK SMS] OTP for user ${userId}: ${otp}`);
    }

    return { message: 'OTP sent to phone (check server logs)' };
  }

  async verifyPhone(userId: string, code: string) {
    const key = `otp_phone:${userId}`;
    const storedOtp = await this.redis.get(key);

    if (!storedOtp || storedOtp !== code) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.usersRepo.markPhoneAsVerified(userId);
    await this.redis.del(key);

    return { success: true, message: 'Phone verified successfully' };
  }

  private async checkRateLimit(userId: string, type: 'email' | 'phone') {
    const cooldownKey = `rate_limit:otp_cooldown:${type}:${userId}`;
    const countKey = `rate_limit:otp_count:${type}:${userId}`;

    // 1. Check Cooldown (1 minute)
    const inCooldown = await this.redis.get(cooldownKey);
    if (inCooldown) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw new HttpException(
        `Please wait ${ttl} seconds before requesting another OTP.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 2. Check Hourly Limit (5 requests per hour)
    const requestCount = await this.redis.get(countKey);
    if (requestCount && parseInt(requestCount) >= 5) {
      throw new HttpException(
        'You have reached the maximum of 5 OTP requests per hour. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. Set/Update Limits
    // Set 1-minute cooldown
    await this.redis.set(cooldownKey, '1', 'EX', 60);

    // Increment hourly counter
    await this.redis.incr(countKey);
    // If this is the first request (or key expired), set expiration to 1 hour
    if (!requestCount) {
      await this.redis.expire(countKey, 3600);
    }
  }

  private generateOtp(): string {
    // Cryptographically secure random number
    return randomInt(100000, 1000000).toString();
  }
}
