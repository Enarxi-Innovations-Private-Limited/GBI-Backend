import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OtpService } from './otp.service';
import { SendOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { MailService } from '../mail/mail.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Controller('otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() body: SendOtpDto) {
    console.log(`[OTP Controller] Received send request for: ${body.email}`);
    // 1. Apply rate limit
    await this.rateLimitService.enforceLimit(body.email);

    // 2. Generate OTP & 3. Store in Redis (hashed)
    const rawOtp = await this.otpService.generateAndStoreOtp(body.email);

    // 4. Push email job to queue
    await this.mailService.enqueueOtpEmail(body.email, rawOtp);

    // 5. Return success immediately
    return {
      success: true,
      message: 'OTP has been sent successfully.',
    };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto) {
    // 1 & 2. Validate OTP and Delete on success
    await this.otpService.verifyOtp(body.email, body.otp);

    // 3. Return success response
    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  }
}
