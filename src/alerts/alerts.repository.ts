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

  // ─── FIX: Replace correlated nested-subquery with a 2-step O(log N) index lookup ───
  // Old: prisma traverses DeviceGroup → devices.some() → generates a correlated EXISTS subquery.
  // New: read groupId directly off the Device row (FK column, covered by the new index),
  //      then do a single PK lookup on GroupThreshold.
  async getGroupThresholdByDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { groupId: true },
    });
    if (!device?.groupId) return null;
    return this.prisma.groupThreshold.findUnique({
      where: { groupId: device.groupId },
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

  // ─── NEW: Batch event log creation — createMany instead of N individual INSERTs ───
  batchCreateEventLogs(
    data: {
      deviceId: string;
      userId: string;
      parameter: string;
      value: number;
      eventType: string;
    }[],
  ) {
    if (data.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.eventLog.createMany({ data });
  }

  // EVENT LOG (kept for backward compatibility / individual use)
  createEventLog(data: {
    deviceId: string;
    userId: string;
    parameter: string;
    value: number;
    eventType?: string;
  }) {
    return this.prisma.eventLog.create({
      data: {
        deviceId: data.deviceId,
        userId: data.userId,
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
