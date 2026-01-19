import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AlertsRepository {
  constructor(private prisma: PrismaService) {}

  getAssignedUsersWithThresholds(deviceId: string) {
    return this.prisma.deviceAssignment.findMany({
      where: { deviceId, unassignedAt: null },
      select: {
        userId: true,
        user: {
          select: {
            alerts: true, // Fetch thresholds immediately
          },
        },
      },
    });
  }

  // Optimized batch check to see if we should alert
  async getRecentAlerts(
    deviceId: string,
    userIds: string[],
    parameters: string[],
    minutes: number,
  ) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.prisma.eventLog.findMany({
      where: {
        deviceId,
        userId: { in: userIds },
        parameter: { in: parameters },
        eventType: 'Alert_Triggered',
        createdAt: { gte: since },
      },
      select: {
         userId: true,
         parameter: true,
      }
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
