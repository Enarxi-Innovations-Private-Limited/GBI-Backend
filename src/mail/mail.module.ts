import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerService } from './mailer.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    ConfigModule,
    // Register the 'mail' queue
    BullModule.registerQueue({
      name: 'mail',
    }),
  ],
  providers: [MailService, MailerService, MailProcessor],
  exports: [MailService], // Export MailService so other modules (like Notifications) can enqueue jobs
})
export class MailModule {}
