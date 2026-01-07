import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../interfaces';

/**
 * AWS SNS SMS Provider
 * Ready to use when AWS credentials are configured
 * 
 * To enable:
 * 1. Install AWS SDK: pnpm install @aws-sdk/client-sns
 * 2. Set environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * 3. Update notifications.module.ts to use this provider instead of MockSmsProvider
 */
@Injectable()
export class AwsSnsSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(AwsSnsSmsProvider.name);
  // private snsClient: SNSClient; // Uncomment when @aws-sdk/client-sns is installed

  constructor(private configService: ConfigService) {
    // Uncomment when ready to use AWS SNS:
    /*
    this.snsClient = new SNSClient({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    */
  }

  async sendSms(params: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Uncomment when ready to use AWS SNS:
      /*
      const command = new PublishCommand({
        PhoneNumber: params.to,
        Message: params.message,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional', // or 'Promotional'
          },
        },
      });

      const response = await this.snsClient.send(command);
      
      this.logger.log(`✅ SMS sent via AWS SNS: ${response.MessageId}`);
      
      return {
        success: true,
        messageId: response.MessageId,
      };
      */

      // Temporary implementation until AWS SNS is configured
      this.logger.warn(
        '⚠️ AWS SNS not configured. Please install @aws-sdk/client-sns and configure credentials.',
      );
      return {
        success: false,
        error: 'AWS SNS not configured',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to send SMS via AWS SNS: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendOTP(params: {
    to: string;
    otp: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `Your GBI verification code is: ${params.otp}. Valid for 10 minutes. Do not share this code with anyone.`;

    return this.sendSms({ to: params.to, message });
  }
}
