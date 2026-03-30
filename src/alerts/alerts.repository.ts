import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // USERS ASSIGNED TO DEVICE
  getAssignedUsers(deviceId: string) {
    return this.prisma.deviceAssignment.findMany({
      where: { deviceId, unassignedAt: null },
      select: { userId: true },
    });
  }

  // DEVICE THRESHOLD
  getDeviceThreshold(deviceId: string) {
    return this.prisma.deviceThreshold.findUnique({
      where: { deviceId },
    });
  }

  // GROUP THRESHOLD (via device)
  getGroupThresholdByDevice(deviceId: string) {
    return this.prisma.groupThreshold.findFirst({
      where: {
        group: {
          devices: {
            some: { id: deviceId },
          },
        },
      },
    });
  }

  // ALERT STATES
  getAlertStates(deviceId: string, userIds: string[], params: string[]) {
    return this.prisma.alertState.findMany({
      where: {
        deviceId,
        userId: { in: userIds },
        parameter: { in: params },
      },
    });
  }

  // COOLDOWN CHECK
  getRecentAlerts(
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
      },
    });
  }

  // EVENT LOG
  // EVENT LOG
  createEventLog(data: {
    deviceId: string;
    userId: string;
    parameter: string;
    value: number;
    eventType?: string; // Optional for backward compatibility, but Stage 2 uses it
  }) {
    return this.prisma.eventLog.create({
      data: {
        deviceId: data.deviceId,
        userId: data.userId,
        // Default to 'Alert_Triggered' if not provided (legacy behavior), 
        // or use the specific type passed called 'ALERT_TRIGGERED' / 'ALERT_RESOLVED'
        eventType: data.eventType || 'Alert_Triggered',
        parameter: data.parameter,
        value: data.value,
      },
    });
  }

  // NOTIFICATION
  createNotification(data: {
    userId: string;
    deviceId: string;
    message: string;
    thresholdValue?: number;
  }) {
    return this.prisma.notification.create({
      data,
    });
  }

  // ALERT STATE UPSERT
  upsertAlertState(data: {
    deviceId: string;
    userId: string;
    parameter: string;
    state: 'NORMAL' | 'ALERTING';
    lastTriggeredAt?: Date;
  }) {
    return this.prisma.alertState.upsert({
      where: {
        userId_deviceId_parameter: {
          userId: data.userId,
          deviceId: data.deviceId,
          parameter: data.parameter,
        },
      },
      update: {
        state: data.state,
        lastTriggeredAt: data.lastTriggeredAt,
      },
      create: {
        deviceId: data.deviceId,
        userId: data.userId,
        parameter: data.parameter,
        state: data.state,
        lastTriggeredAt: data.lastTriggeredAt,
      },
    });
  }
}
