import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../interfaces';

/**
 * AWS SES Email Provider
 * Ready to use when AWS credentials are configured
 * 
 * To enable:
 * 1. Install AWS SDK: pnpm install @aws-sdk/client-ses
 * 2. Set environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_FROM_EMAIL
 * 3. Update notifications.module.ts to use this provider instead of MockEmailProvider
 */
@Injectable()
export class AwsSesEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(AwsSesEmailProvider.name);
  // private sesClient: SESClient; // Uncomment when @aws-sdk/client-ses is installed

  constructor(private configService: ConfigService) {
    // Uncomment when ready to use AWS SES:
    /*
    this.sesClient = new SESClient({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    */
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Uncomment when ready to use AWS SES:
      /*
      const command = new SendEmailCommand({
        Source: this.configService.get('AWS_SES_FROM_EMAIL'),
        Destination: {
          ToAddresses: [params.to],
        },
        Message: {
          Subject: {
            Data: params.subject,
          },
          Body: params.html
            ? {
                Html: {
                  Data: params.html,
                },
              }
            : {
                Text: {
                  Data: params.body,
                },
              },
        },
      });

      const response = await this.sesClient.send(command);
      
      this.logger.log(`✅ Email sent via AWS SES: ${response.MessageId}`);
      
      return {
        success: true,
        messageId: response.MessageId,
      };
      */

      // Temporary implementation until AWS SES is configured
      this.logger.warn(
        '⚠️ AWS SES not configured. Please install @aws-sdk/client-ses and configure credentials.',
      );
      return {
        success: false,
        error: 'AWS SES not configured',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send email via AWS SES: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendOTP(params: {
    to: string;
    otp: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const greeting = params.name ? `Hello ${params.name}` : 'Hello';
    const subject = 'Your GBI Verification Code';
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Email Verification</h2>
          <p>${greeting},</p>
          <p>Your verification code is:</p>
          <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${params.otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <br/>
          <p>Best regards,<br/>GBI Team</p>
        </body>
      </html>
    `;

    return this.sendEmail({ to: params.to, subject, body: '', html });
  }

  async sendVerificationEmail(params: {
    to: string;
    verificationLink: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const greeting = params.name ? `Hello ${params.name}` : 'Hello';
    const subject = 'Verify Your GBI Account';
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Email Verification</h2>
          <p>${greeting},</p>
          <p>Please verify your email address by clicking the button below:</p>
          <p style="margin: 30px 0;">
            <a href="${params.verificationLink}" 
               style="background-color: #4CAF50; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666;">${params.verificationLink}</p>
          <p>This link will expire in 24 hours.</p>
          <br/>
          <p>Best regards,<br/>GBI Team</p>
        </body>
      </html>
    `;

    return this.sendEmail({ to: params.to, subject, body: '', html });
  }
}
