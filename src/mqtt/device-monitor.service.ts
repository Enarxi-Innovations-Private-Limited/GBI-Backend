import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';

@Injectable()
export class DeviceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DeviceMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  onModuleInit() {
    // run every 60 seconds
    setInterval(() => this.checkOfflineDevices(), 60_000);
  }

  private async checkOfflineDevices() {
    const cutoff = new Date(Date.now() - 7 * 60 * 1000); // 7 minutes

    const offlineDevices = await this.prisma.device.findMany({
      where: {
        status: 'active',
        lastHeartbeatAt: { lt: cutoff },
      },
    });

    if (!offlineDevices.length) return;

    for (const device of offlineDevices) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { status: 'inactive' },
      });
      this.realtimeService.emitDeviceStatus(device.deviceId, 'offline');

      const assignments = await this.prisma.deviceAssignment.findMany({
        where: { deviceId: device.id, unassignedAt: null },
        select: { userId: true },
      });

      for (const a of assignments) {
        await this.prisma.eventLog.create({
          data: {
            deviceId: device.id,
            userId: a.userId,
            eventType: 'OFFLINE',
          },
        });

        await this.prisma.notification.create({
          data: {
            userId: a.userId,
            deviceId: device.id,
            message: `⚠️ Device ${device.deviceId} went offline`,
          },
        });
      }
    }

    this.logger.warn(`Marked ${offlineDevices.length} devices as offline`);
  }
}
