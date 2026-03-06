import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { render } from '@react-email/render';
import { MailJobData } from './dto/mail-job.dto';
import { MailerService } from './mailer.service';

// Import templates
import { OtpEmail } from './templates/otp.email';

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
      if (data.type === 'otp') {
        await this.handleOtpEmail(data);
      } else {
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
}
