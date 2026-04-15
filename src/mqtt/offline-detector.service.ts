import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { DeviceStatus } from '@prisma/client';
import { SchedulerRegistry } from '@nestjs/schedule';

@Injectable()
export class OfflineDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfflineDetectorService.name);
  private readonly intervalSeconds: number;
  private readonly thresholdMisses: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.intervalSeconds =
      Number(process.env.DEVICE_TELEMETRY_INTERVAL_SECONDS) || 60;
    this.thresholdMisses =
      Number(process.env.DEVICE_OFFLINE_THRESHOLD_MISSES) || 5;
  }

  onModuleInit() {
    // Run the scheduler dynamically at exactly half the telemetry interval for maximum precision
    // without over-querying. e.g. if telemetry interval is 60s, run every 30s.
    // Ensure minimum of 5 seconds to prevent runaway tight loops if config is misused.
    const schedulerFrequencySeconds = Math.max(
      Math.floor(this.intervalSeconds / 2),
      5,
    );

    const intervalId = setInterval(() => {
      this.checkOfflineDevices();
    }, schedulerFrequencySeconds * 1000);

    this.schedulerRegistry.addInterval('offline-detector', intervalId);

    this.logger.log(
      `⚙️ Dynamic Offline Scheduler started via SchedulerRegistry. Cycle frequency: ${schedulerFrequencySeconds}s`,
    );
  }

  onModuleDestroy() {
    try {
      this.schedulerRegistry.deleteInterval('offline-detector');
      this.logger.log('🛑 Offline Scheduler interval cleared securely.');
    } catch (e) {
      // Ignored if it doesn't exist
    }
  }

  async checkOfflineDevices() {
    try {
      const offlineTimeoutSeconds = this.intervalSeconds * this.thresholdMisses;
      const cutoffTime = new Date(Date.now() - offlineTimeoutSeconds * 1000);

      // Find which devices are about to be marked offline to fire realtime events and logs
      const deadDevices = await this.prisma.device.findMany({
        where: {
          isDeleted: false,
          status: { not: DeviceStatus.OFFLINE },
          lastHeartbeatAt: { lt: cutoffTime },
        },
        select: { id: true, deviceId: true },
      });

      if (deadDevices.length === 0) return;

      const result = await this.prisma.device.updateMany({
        where: {
          isDeleted: false,
          status: { not: DeviceStatus.OFFLINE },
          lastHeartbeatAt: { lt: cutoffTime },
        },
        data: {
          status: DeviceStatus.OFFLINE,
        },
      });

      if (result.count > 0) {
        this.logger.warn(
          `⚠️ Marked ${result.count} local devices as OFFLINE due to inactivity threshold (${offlineTimeoutSeconds}s).`,
        );

        for (const device of deadDevices) {
          this.realtimeService.emitDeviceStatus(
            device.deviceId,
            DeviceStatus.OFFLINE,
          );

          // Migrate the old event log functionality here
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
            // We can optionally add Notification logic here if required
          }
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to execute offline device check scheduler',
        error.stack,
      );
    }
  }
}
