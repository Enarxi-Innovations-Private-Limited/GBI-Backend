import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { REDIS_CLIENT } from '../redis/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Generates a 6 digit OTP and hashes it using SHA256.
   * Stores the hash in Redis with a 300 second TTL.
   * Returns the raw OTP to be emailed.
   */
  async generateAndStoreOtp(email: string): Promise<string> {
    // Generate a secure 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP using SHA256
    const hash = crypto.createHash('sha256').update(otp).digest('hex');

    const key = `otp:${email}`;
    await this.redisClient.set(key, hash, 'EX', 300); // 5 minutes TTL

    this.logger.log(`Generated OTP for ${email}`);
    
    return otp;
  }

  /**
   * Verifies the provided OTP against the hash stored in Redis.
   * Throws error if missing or mismatch.
   * Deletes upon success.
   */
  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const key = `otp:${email}`;
    const storedHash = await this.redisClient.get(key);

    if (!storedHash) {
      throw new BadRequestException('OTP expired or not found');
    }

    const inputHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (inputHash !== storedHash) {
      throw new BadRequestException('Invalid OTP');
    }

    // Delete on success to prevent reuse
    await this.redisClient.del(key);
    this.logger.log(`Successfully verified OTP for ${email}`);

    return true;
  }
}
