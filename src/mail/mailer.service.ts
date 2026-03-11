import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as aws from '@aws-sdk/client-ses';

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
      const ses = new aws.SES({
        apiVersion: '2010-12-01',
        region: region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      this.transporter = nodemailer.createTransport({
        SES: { ses: ses as any, aws: aws as any },
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
        this.logger.log(`✉️ [TESTING] Preview your email here:`);
        this.logger.log(previewUrl);
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      throw error; // Re-throw so BullMQ knows the job failed and can retry
    }
  }
}
