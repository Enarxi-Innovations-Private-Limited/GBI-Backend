import { Injectable, Logger } from '@nestjs/common';
import { ISmsProvider } from '../interfaces';

/**
 * Mock SMS Provider
 * Logs SMS to console instead of sending them
 * Easy to replace with real providers (AWS SNS, Twilio, etc.)
 */
@Injectable()
export class MockSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendSms(params: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    this.logger.log('📱 [MOCK SMS] Sending SMS...');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`Message: ${params.message}`);
    this.logger.log('✅ SMS sent successfully (mock)');

    return {
      success: true,
      messageId: `mock-sms-${Date.now()}`,
    };
  }

  async sendOTP(params: {
    to: string;
    otp: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `Your GBI verification code is: ${params.otp}. Valid for 10 minutes.`;

    this.logger.log('🔐 [MOCK SMS OTP]');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`OTP: ${params.otp}`);
    this.logger.log('==================');

    return this.sendSms({ to: params.to, message });
  }
}
