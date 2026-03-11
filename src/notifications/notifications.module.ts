import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { MockSmsProvider } from './providers';
import { ISmsProvider } from './interfaces';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';

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
  imports: [ConfigModule, MailModule],
  providers: [
    NotificationService,
    {
      provide: 'ISmsProvider',
      useClass: MockSmsProvider, // Change to AwsSnsSmsProvider when ready
    },
    // Inject the providers into NotificationService
    {
      provide: NotificationService,
      useFactory: (mailService: MailService, smsProvider: ISmsProvider) => {
        return new NotificationService(mailService, smsProvider);
      },
      inject: [MailService, 'ISmsProvider'],
    },
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
