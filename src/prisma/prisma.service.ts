import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        { emit: 'stdout', level: 'info' },
      ],
      datasources: {
        db: {
          // Pool sizing for DigitalOcean managed PostgreSQL (~25 total slots):
          //   10  → NestJS server (MQTT pipeline + HTTP API + schedulers)
          //    3  → scripts (check-*, seed-*, delete-*)
          //    3  → PostgreSQL superuser reserved slots
          //    9  → headroom buffer
          // connection_limit in the URL is used by standalone scripts;
          // this datasources override applies to the NestJS app only.
          url: process.env.DATABASE_URL + '&connection_limit=10&pool_timeout=15',
        },
      },
    });

    (this.prisma as any).$on('error', (e: any) => {
      this.logger.error(`🚨 [Prisma Runtime Error]: ${e.message}`, e.target);
    });

    (this.prisma as any).$on('warn', (e: any) => {
      this.logger.warn(`⚠️ [Prisma Runtime Warning]: ${e.message}`);
    });
  }

  async onModuleInit() {
    let attempt = 1;

    while (true) {
      try {
        await this.prisma.$connect();
        this.logger.log('✅ Successfully connected to database');
        return;
      } catch (error) {
        const delay = Math.min(attempt * 500, 5000);
        this.logger.warn(
          `⚠️ Failed to connect to database (${error.message}). Retrying in ${delay}ms... (Attempt ${attempt})`,
        );
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    this.logger.log('Database connection closed');
  }

  // Expose Prisma Client methods
  get user() {
    return this.prisma.user;
  }

  get admin() {
    return this.prisma.admin;
  }

  get device() {
    return this.prisma.device;
  }

  get deviceAssignment() {
    return this.prisma.deviceAssignment;
  }

  get userDevice() {
    return this.prisma.userDevice;
  }

  get deviceTelemetry() {
    return this.prisma.deviceTelemetry;
  }

  get alertState() {
    return this.prisma.alertState;
  }

  get eventLog() {
    return this.prisma.eventLog;
  }

  get notification() {
    return this.prisma.notification;
  }

  get refreshToken() {
    return this.prisma.refreshToken;
  }

  get deviceGroup() {
    return this.prisma.deviceGroup;
  }

  get deviceThreshold() {
    return this.prisma.deviceThreshold;
  }

  get groupThreshold() {
    return this.prisma.groupThreshold;
  }

  get generatedReport() {
    return this.prisma.generatedReport;
  }

  get subscription() {
    return this.prisma.subscription;
  }

  get subscriptionPlan() {
    return this.prisma.subscriptionPlan;
  }

  get premiumSubscription() {
    return this.prisma.premiumSubscription;
  }

  get premiumHistory() {
    return this.prisma.premiumHistory;
  }

  // Expose transaction and other Prisma methods
  get $transaction() {
    return this.prisma.$transaction.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get $executeRaw() {
    return this.prisma.$executeRaw.bind(this.prisma);
  }
}
