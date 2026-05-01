import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-sesv2';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.fromEmail =
      this.configService.get<string>('AWS_SES_FROM_EMAIL') ||
      'noreply@greenbreathe.in';
  }

  async onModuleInit() {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    // Only configure real SES if credentials are provided, otherwise fallback to Ethereal testing account
    if (region && accessKeyId && secretAccessKey) {
      const ses = new aws.SESv2Client({
        region: region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      this.transporter = nodemailer.createTransport({
        SES: { sesClient: ses, SendEmailCommand: aws.SendEmailCommand },
      } as nodemailer.TransportOptions);
      this.logger.log('Amazon SES Transporter configured successfully.');
    } else {
      this.logger.warn(
        'AWS SES credentials not fully configured. Setting up Ethereal Email for testing...',
      );
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      this.logger.log(
        'Ethereal Email testing account created successfully. Emails will be caught here.',
      );
    }
  }

  /**
   * Sends an email via the configured transporter
   */
  async sendHtmlEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      this.logger.log(
        `Email sent successfully to ${to}. MessageId: ${info.messageId}`,
      );

      // Log the preview URL for Ethereal test emails
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`✉️ [TESTING] "${subject}" - Preview URL:`);
        this.logger.log(`👉 ${previewUrl}`);
      }
      return true;
    } catch (error: any) {
      const isUnverified =
        error.message?.includes('Email address is not verified') ||
        error.name === 'MessageRejected';

      if (isUnverified) {
        this.logger.warn(
          `✉️ [SES SANDBOX] Could not send email to ${to}. ` +
            `Reason: Recipient address is not verified in SES AP-SOUTH-1 Sandbox. ` +
            `Please verify this email address in the AWS SES Console to receive emails during development.`,
        );
        return false; // Return false but don't throw, to prevent BullMQ from retrying indefinitely
      }

      this.logger.error(`Failed to send email to ${to}`, error.stack);
      throw error; // Re-throw for other errors so BullMQ knows the job failed and can retry
    }
  }
}
