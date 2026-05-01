import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailJobData } from './dto/mail-job.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectQueue('mail') private readonly mailQueue: Queue<MailJobData>,
  ) {}

  /**
   * Enqueues an OTP email to be sent asynchronously by the worker
   */
  async enqueueOtpEmail(
    to: string,
    otp: string,
    name?: string,
  ): Promise<boolean> {
    try {
      await this.mailQueue.add(
        'send-otp',
        { type: 'otp', to, otp, name },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued OTP email job for ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to enqueue OTP email for ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Enqueues a Welcome email to be sent asynchronously
   */
  async enqueueWelcomeEmail(to: string, name?: string): Promise<boolean> {
    try {
      await this.mailQueue.add(
        'send-welcome',
        { type: 'welcome', to, name },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued Welcome email job for ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue Welcome email for ${to}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Enqueues a Verification link email to be sent asynchronously
   */
  async enqueueVerificationEmail(
    to: string,
    verificationLink: string,
    name?: string,
  ): Promise<boolean> {
    try {
      await this.mailQueue.add(
        'send-verification',
        { type: 'verification', to, verificationLink, name },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued Verification email job for ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue Verification email for ${to}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Enqueues a Forgot Password email to be sent asynchronously
   */
  async enqueueForgotPasswordEmail(
    to: string,
    otp: string,
    resetLink: string,
    name?: string,
  ): Promise<boolean> {
    try {
      await this.mailQueue.add(
        'send-forgot-password',
        { type: 'forgot-password', to, otp, resetLink, name },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued Forgot Password email job for ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue Forgot Password email for ${to}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Enqueues an Admin Forgot Password email to be sent asynchronously
   */
  async enqueueAdminForgotPasswordEmail(
    to: string,
    otp: string,
    resetLink: string,
    name?: string,
  ): Promise<boolean> {
    try {
      await this.mailQueue.add(
        'send-admin-forgot-password',
        { type: 'admin-forgot-password', to, otp, resetLink, name },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Enqueued Admin Forgot Password email job for ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue Admin Forgot Password email for ${to}`,
        error.stack,
      );
      return false;
    }
  }
}
