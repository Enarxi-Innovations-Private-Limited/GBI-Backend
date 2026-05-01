import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { MailJobData } from './dto/mail-job.dto';
import { MailerService } from './mailer.service';

// Import templates
import { OtpEmail } from './templates/otp.email';
import { WelcomeEmail } from './templates/welcome.email';
import { VerificationEmail } from './templates/verification.email';
import { ForgotPasswordEmail } from './templates/forgot-password.email';
import { AdminForgotPasswordEmail } from './templates/admin-forgot-password.email';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<MailJobData, any, string>): Promise<any> {
    this.logger.log(
      `Processing mail job ${job.id} of type ${job.name} (attempt ${job.attemptsMade + 1})`,
    );
    const data = job.data;

    try {
      switch (data.type) {
        case 'otp':
          await this.handleOtpEmail(data);
          break;
        case 'welcome':
          await this.handleWelcomeEmail(data);
          break;
        case 'verification':
          await this.handleVerificationEmail(data);
          break;
        case 'forgot-password':
          await this.handleForgotPasswordEmail(data);
          break;
        case 'admin-forgot-password':
          await this.handleAdminForgotPasswordEmail(data);
          break;
        default:
          this.logger.warn(`Unknown mail job type: ${(data as any).type}`);
      }

      this.logger.log(`Mail job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process mail job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ handle the failure/retry
    }
  }

  private async handleOtpEmail(data: Extract<MailJobData, { type: 'otp' }>) {
    const html = await render(OtpEmail({ otp: data.otp, name: data.name }));
    const subject = 'Your GBI Verification Code';
    await this.mailerService.sendHtmlEmail(data.to, subject, html);
  }

  private async handleWelcomeEmail(
    data: Extract<MailJobData, { type: 'welcome' }>,
  ) {
    const html = await render(WelcomeEmail({ name: data.name }));
    const subject = 'Welcome to GreenBreathe Innovations';
    await this.mailerService.sendHtmlEmail(data.to, subject, html);
  }

  private async handleVerificationEmail(
    data: Extract<MailJobData, { type: 'verification' }>,
  ) {
    const html = await render(
      VerificationEmail({
        verificationLink: data.verificationLink,
        name: data.name,
      }),
    );
    const subject = 'Verify your GBI Email Address';
    await this.mailerService.sendHtmlEmail(data.to, subject, html);
  }

  private async handleForgotPasswordEmail(
    data: Extract<MailJobData, { type: 'forgot-password' }>,
  ) {
    const html = await render(
      ForgotPasswordEmail({
        otp: data.otp,
        resetLink: data.resetLink,
        name: data.name,
      }),
    );
    const subject = 'Reset your GBI account password';
    await this.mailerService.sendHtmlEmail(data.to, subject, html);
  }

  private async handleAdminForgotPasswordEmail(
    data: Extract<MailJobData, { type: 'admin-forgot-password' }>,
  ) {
    const html = await render(
      AdminForgotPasswordEmail({
        otp: data.otp,
        resetLink: data.resetLink,
        name: data.name,
      }),
    );
    const subject = 'Admin Portal: Reset your GBI account password';
    await this.mailerService.sendHtmlEmail(data.to, subject, html);
  }
}
