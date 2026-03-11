import { Injectable, Logger } from '@nestjs/common';
import type { ISmsProvider } from './interfaces';
import { MailService } from '../mail/mail.service';

/**
 * Notification Service
 * Central service for sending emails (via queues) and SMS
 * Uses MailService (BullMQ) for async emails and configured providers for SMS
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly smsProvider: ISmsProvider,
  ) {}

  /**
   * Send email OTP
   */
  async sendEmailOTP(params: {
    email: string;
    otp: string;
    name?: string;
  }): Promise<boolean> {
    try {
      // Async: push to BullMQ queue
      return await this.mailService.enqueueOtpEmail(
        params.email,
        params.otp,
        params.name,
      );
    } catch (error) {
      this.logger.error(`Error enqueueing email OTP: ${error.message}`);
      return false;
    }
  }

  /**
   * Send SMS OTP
   */
  async sendSmsOTP(params: { phone: string; otp: string }): Promise<boolean> {
    try {
      const result = await this.smsProvider.sendOTP({
        to: params.phone,
        otp: params.otp,
      });

      if (!result.success) {
        this.logger.error(`Failed to send SMS OTP: ${result.error}`);
        return false;
      }

      this.logger.log(`SMS OTP sent successfully to ${params.phone}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending SMS OTP: ${error.message}`);
      return false;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(params: {
    email: string;
    verificationLink: string;
    name?: string;
  }): Promise<boolean> {
    try {
      // Async: push to BullMQ queue
      return await this.mailService.enqueueVerificationEmail(
        params.email,
        params.verificationLink,
        params.name,
      );
    } catch (error) {
      this.logger.error(
        `Error enqueueing verification email: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Send custom email
   */
  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<boolean> {
    try {
      // For general custom emails not currently supported by template,
      // we log a warning. In a real system you'd either create a generic
      // HTML template job in MailService or fallback. For now, just logging:
      this.logger.warn(
        `Custom generic HTML emails not supported via queue yet for ${params.to}`,
      );
      return false;
    } catch (error) {
      this.logger.error(`Error handling custom email: ${error.message}`);
      return false;
    }
  }

  /**
   * Send custom SMS
   */
  async sendSms(params: { to: string; message: string }): Promise<boolean> {
    try {
      const result = await this.smsProvider.sendSms(params);

      if (!result.success) {
        this.logger.error(`Failed to send SMS: ${result.error}`);
        return false;
      }

      this.logger.log(`SMS sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending SMS: ${error.message}`);
      return false;
    }
  }
}
