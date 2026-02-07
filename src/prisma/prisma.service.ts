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
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
      this.logger.log('✅ Successfully connected to database');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error.message);
      throw error;
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

  get alertThreshold() {
    return this.prisma.alertThreshold;
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
