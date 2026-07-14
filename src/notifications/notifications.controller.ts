import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Controller('webhooks/aws-ses')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleSnsWebhook(@Body() body: any) {
    let payload = body;
    if (typeof body === 'string') {
      try {
        payload = JSON.parse(body);
      } catch (e) {
        this.logger.error('Failed to parse text body as JSON');
        return { success: false };
      }
    }

    this.logger.log(`Received SNS notification of type: ${payload.Type}`);

    // 1. Handle Subscription Confirmation from SNS
    if (payload.Type === 'SubscriptionConfirmation') {
      const subscribeUrl = payload.SubscribeURL;
      if (subscribeUrl) {
        this.logger.log(`Confirming subscription via URL: ${subscribeUrl}`);
        try {
          await axios.get(subscribeUrl);
          this.logger.log('✅ Subscription successfully confirmed');
          return { status: 'confirmed' };
        } catch (error: any) {
          this.logger.error(`❌ Failed to confirm subscription: ${error.message}`);
          return { status: 'failed_confirmation' };
        }
      }
    }

    // 2. Handle Notifications (Bounce & Complaint) from SES via SNS
    if (payload.Type === 'Notification') {
      let message: any;
      try {
        message = typeof payload.Message === 'string' ? JSON.parse(payload.Message) : payload.Message;
      } catch (e) {
        this.logger.error('Failed to parse SNS message payload');
        return { success: false };
      }

      const notificationType = message.notificationType || message.eventType;
      this.logger.log(`Processing notification event: ${notificationType}`);

      if (notificationType === 'Bounce') {
        const bounce = message.bounce;
        // Handle Permanent bounces (hard bounce)
        if (bounce && (bounce.bounceType === 'Permanent' || bounce.bounceType === 'Undeliverable')) {
          const recipients = bounce.bouncedRecipients || [];
          for (const recipient of recipients) {
            const email = recipient.emailAddress;
            if (email) {
              this.logger.warn(`Email hard-bounced: ${email}. Restricting email verification status...`);
              try {
                // Set emailVerified to false so the user can no longer be sent emails
                await this.prisma.user.updateMany({
                  where: { email: email.toLowerCase().trim() },
                  data: { emailVerified: false },
                });
                this.logger.log(`Successfully unregistered verification for bounced email: ${email}`);
              } catch (err: any) {
                this.logger.error(`Failed to update bounced user: ${err.message}`);
              }
            }
          }
        }
      } else if (notificationType === 'Complaint') {
        const complaint = message.complaint;
        const recipients = (complaint && complaint.complainedRecipients) || [];
        for (const recipient of recipients) {
          const email = recipient.emailAddress;
          if (email) {
            this.logger.warn(`Email complaint received for: ${email}. Restricting email verification status...`);
            try {
              // Set emailVerified to false to stop emails to this user
              await this.prisma.user.updateMany({
                where: { email: email.toLowerCase().trim() },
                data: { emailVerified: false },
              });
              this.logger.log(`Successfully unregistered verification for complained email: ${email}`);
            } catch (err: any) {
              this.logger.error(`Failed to update complained user: ${err.message}`);
            }
          }
        }
      }
    }

    return { success: true };
  }
}
