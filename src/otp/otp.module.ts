import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { MailModule } from '../mail/mail.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

@Module({
  imports: [MailModule, RedisModule, RateLimitModule],
  controllers: [OtpController],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
