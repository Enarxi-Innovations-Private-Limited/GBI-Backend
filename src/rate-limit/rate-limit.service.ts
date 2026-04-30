import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.provider';
import Redis from 'ioredis';

@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async enforceLimit(email: string): Promise<boolean> {
    console.log(`[RateLimit] Checking for ${email}`);
    const key = `rate:${email}`;

    // Increment request count by 1
    const count = await this.redisClient.incr(key);

    console.log(`[RateLimit] enforced for ${email}: ${count} times`);

    // If it's the first time, set an expiry of 1 hour (3600 seconds)
    if (count === 1) {
      await this.redisClient.expire(key, 3600);
    }

    // Checking count > 5
    if (count > 5) {
      throw new HttpException(
        'Too many requests. Please try again after an hour',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
