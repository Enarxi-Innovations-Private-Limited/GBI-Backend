import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AlertsRepository {
  constructor(private prisma: PrismaService) {}

  getAssignedUsers(deviceId: string) {
    return this.prisma.deviceAssignment.findMany({
      where: { deviceId, unassignedAt: null },
      select: { userId: true },
    });
  }

  getThresholds(userId: string) {
    return this.prisma.alertThreshold.findMany({
      where: { userId },
    });
  }

  async hasRecentAlert(
    deviceId: string,
    userId: string,
    parameter: string,
    minutes: number,
  ) {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const existing = await this.prisma.eventLog.findFirst({
      where: {
        deviceId,
        userId,
        parameter,
        eventType: 'Alert_Triggered',
        createdAt: { gte: since },
      },
    });

    return !!existing;
  }

  createEventLog(data: {
    deviceId: string;
    userId: string;
    parameter: string;
    value: number;
  }) {
    return this.prisma.eventLog.create({
      data: {
        deviceId: data.deviceId,
        userId: data.userId,
        eventType: 'Alert_Triggered',
        parameter: data.parameter,
        value: data.value,
      },
    });
  }

  createNotification(data: {
    userId: string;
    deviceId: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data,
    });
  }
}
