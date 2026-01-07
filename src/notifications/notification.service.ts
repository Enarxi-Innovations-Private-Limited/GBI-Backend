import { Injectable, Logger } from '@nestjs/common';
import type { IEmailProvider, ISmsProvider } from './interfaces';

/**
 * Notification Service
 * Central service for sending emails and SMS
 * Uses configured providers (Mock, AWS, etc.)
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailProvider: IEmailProvider,
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
      const result = await this.emailProvider.sendOTP({
        to: params.email,
        otp: params.otp,
        name: params.name,
      });

      if (!result.success) {
        this.logger.error(`Failed to send email OTP: ${result.error}`);
        return false;
      }

      this.logger.log(`Email OTP sent successfully to ${params.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending email OTP: ${error.message}`);
      return false;
    }
  }

  /**
   * Send SMS OTP
   */
  async sendSmsOTP(params: {
    phone: string;
    otp: string;
  }): Promise<boolean> {
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
      const result = await this.emailProvider.sendVerificationEmail({
        to: params.email,
        verificationLink: params.verificationLink,
        name: params.name,
      });

      if (!result.success) {
        this.logger.error(`Failed to send verification email: ${result.error}`);
        return false;
      }

      this.logger.log(`Verification email sent successfully to ${params.email}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending verification email: ${error.message}`);
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
      const result = await this.emailProvider.sendEmail(params);

      if (!result.success) {
        this.logger.error(`Failed to send email: ${result.error}`);
        return false;
      }

      this.logger.log(`Email sent successfully to ${params.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
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
