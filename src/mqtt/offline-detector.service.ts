import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { SseService } from 'src/realtime/sse.service';
import { DeviceStatus } from '@prisma/client';
import { SchedulerRegistry } from '@nestjs/schedule';
import Redis from 'ioredis';
import { DeviceStatusLoggerService } from './device-status-logger.service';

@Injectable()
export class OfflineDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfflineDetectorService.name);
  private readonly intervalSeconds: number;
  private readonly thresholdMisses: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly sseService: SseService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly deviceStatusLogger: DeviceStatusLoggerService,
  ) {
    this.intervalSeconds =
      Number(process.env.DEVICE_TELEMETRY_INTERVAL_SECONDS) ||
      Number(process.env.DEVICE_CHECK_INTERVAL_SECONDS) ||
      60;
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
      // 1. Fetch all active devices (not offline) to compute and log misses
      const activeDevices = await this.prisma.device.findMany({
        where: {
          isDeleted: false,
          status: { not: DeviceStatus.OFFLINE },
        },
        select: {
          id: true,
          deviceId: true,
          lastHeartbeatAt: true,
          status: true,
        },
      });

      // Fetch all device metadata (labels) for logging
      const devicesMeta = await this.prisma.userDevice.findMany({
        select: { deviceId: true, name: true },
      });
      const labelMap = new Map(devicesMeta.map((m) => [m.deviceId, m.name]));

      for (const device of activeDevices) {
        if (!device.lastHeartbeatAt) continue;
        const elapsedSeconds =
          (Date.now() - new Date(device.lastHeartbeatAt).getTime()) / 1000;
        const misses = Math.floor(elapsedSeconds / this.intervalSeconds);
        const deviceLabel = labelMap.get(device.deviceId) || device.deviceId;

        if (misses > 0) {
          const capMisses = Math.min(misses, this.thresholdMisses);
          this.deviceStatusLogger.logStatus(
            deviceLabel,
            device.deviceId,
            `MISSED HEARTBEAT: ${capMisses}/${this.thresholdMisses} (Last seen: ${elapsedSeconds.toFixed(1)}s ago)`,
          );
        }
      }

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
        const deadDeviceDetails = deadDevices
          .map((device) => {
            const label = labelMap.get(device.deviceId);
            return label ? `${device.deviceId} ("${label}")` : device.deviceId;
          })
          .join(', ');

        this.logger.warn(
          `⚠️ Marked ${result.count} local devices as OFFLINE due to inactivity threshold (${offlineTimeoutSeconds}s). Devices: [${deadDeviceDetails}]`,
        );

        for (const device of deadDevices) {
          this.realtimeService.emitDeviceStatus(
            device.deviceId,
            DeviceStatus.OFFLINE,
          );

          // Create event logs and send live SSE notifications for device offline
          const assignments = await this.prisma.deviceAssignment.findMany({
            where: { deviceId: device.id, unassignedAt: null },
            select: { userId: true },
          });

          // Fetch a human-readable device name from userDevice metadata
          const deviceLabel = labelMap.get(device.deviceId) || device.deviceId;

          for (const a of assignments) {
            // 1. Create event log
            const eventLog = await this.prisma.eventLog.create({
              data: {
                deviceId: device.id,
                userId: a.userId,
                eventType: 'OFFLINE',
              },
            });

            // 2. Create in-app notification record
            const notification = await this.prisma.notification.create({
              data: {
                userId: a.userId,
                deviceId: device.id,
                message: `${deviceLabel} went offline`,
              },
            });

            // 3. Push live SSE toast to the user
            this.sseService.sendEvent(a.userId, {
              type: 'NOTIFICATION',
              eventType: 'DEVICE_OFFLINE',
              data: {
                ...notification,
                deviceName: deviceLabel,
                eventLogId: eventLog.id.toString(),
              },
            });

            // 4. Invalidate user devices list cache in Redis
            await this.redis.del(`user:${a.userId}:devices`);
          }

          // 5. Log final status change
          this.deviceStatusLogger.logStatus(
            deviceLabel,
            device.deviceId,
            `STATUS CHANGE: ${DeviceStatus.OFFLINE} (THRESHOLD EXCEEDED)`,
          );
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
