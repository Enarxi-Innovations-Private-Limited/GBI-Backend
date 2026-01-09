import { AuthService } from 'src/auth/auth.service';
import { UsersRepository } from './users.repository';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import Redis from 'ioredis';

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

    const otp = this.generateOtp();
    const key = `otp_email:${userId}`;

    // Store OTP in Redis with 5 minutes expiration (300 seconds)
    await this.redis.set(key, otp, 'EX', 300);

    // TODO: Replace with real email service (SendGrid/AWS SES)
    console.log(`[MOCK EMAIL] OTP for user ${userId}: ${otp}`);

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

    const otp = this.generateOtp();
    const key = `otp_phone:${userId}`;

    await this.redis.set(key, otp, 'EX', 300);

    // TODO: Replace with real SMS service (Twilio/SNS)
    console.log(`[MOCK SMS] OTP for user ${userId}: ${otp}`);

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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
