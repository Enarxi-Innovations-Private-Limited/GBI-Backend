import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from '../interfaces';

/**
 * Mock Email Provider
 * Logs emails to console instead of sending them
 * Easy to replace with real providers (AWS SES, SendGrid, etc.)
 */
@Injectable()
export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    this.logger.log('📧 [MOCK EMAIL] Sending email...');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`Subject: ${params.subject}`);
    this.logger.log(`Body: ${params.body}`);
    if (params.html) {
      this.logger.log(`HTML: ${params.html.substring(0, 100)}...`);
    }
    this.logger.log('✅ Email sent successfully (mock)');

    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
    };
  }

  async sendOTP(params: {
    to: string;
    otp: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const greeting = params.name ? `Hello ${params.name}` : 'Hello';
    const subject = 'Your GBI Verification Code';
    const body = `${greeting},\n\nYour verification code is: ${params.otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nGBI Team`;

    this.logger.log('🔐 [MOCK EMAIL OTP]');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`OTP: ${params.otp}`);
    this.logger.log('==================');

    return this.sendEmail({ to: params.to, subject, body });
  }

  async sendVerificationEmail(params: {
    to: string;
    verificationLink: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const greeting = params.name ? `Hello ${params.name}` : 'Hello';
    const subject = 'Verify Your GBI Account';
    const body = `${greeting},\n\nPlease verify your email address by clicking the link below:\n\n${params.verificationLink}\n\nThis link will expire in 24 hours.\n\nBest regards,\nGBI Team`;

    this.logger.log('✉️ [MOCK EMAIL VERIFICATION]');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`Link: ${params.verificationLink}`);
    this.logger.log('==================');

    return this.sendEmail({ to: params.to, subject, body });
  }
}
