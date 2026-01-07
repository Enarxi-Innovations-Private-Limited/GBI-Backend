import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { MockEmailProvider, MockSmsProvider } from './providers';
import { IEmailProvider, ISmsProvider } from './interfaces';

/**
 * Notifications Module
 * 
 * Currently uses Mock providers (logs to console)
 * 
 * To switch to AWS SES/SNS:
 * 1. Install AWS SDKs: pnpm install @aws-sdk/client-ses @aws-sdk/client-sns
 * 2. Uncomment AWS provider imports
 * 3. Replace MockEmailProvider with AwsSesEmailProvider
 * 4. Replace MockSmsProvider with AwsSnsSmsProvider
 * 5. Set environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
@Module({
  imports: [ConfigModule],
  providers: [
    NotificationService,
    {
      provide: 'IEmailProvider',
      useClass: MockEmailProvider, // Change to AwsSesEmailProvider when ready
    },
    {
      provide: 'ISmsProvider',
      useClass: MockSmsProvider, // Change to AwsSnsSmsProvider when ready
    },
    // Inject the providers into NotificationService
    {
      provide: NotificationService,
      useFactory: (emailProvider: IEmailProvider, smsProvider: ISmsProvider) => {
        return new NotificationService(emailProvider, smsProvider);
      },
      inject: ['IEmailProvider', 'ISmsProvider'],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
