import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import { DeviceStatus, Prisma } from '@prisma/client';
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

      // ─── FIX 1: Atomic UPDATE...RETURNING — one query instead of findMany + updateMany ───
      // This eliminates the double-read race condition and halves the number of DB round-trips.
      const deadDevices = await this.prisma.$queryRaw<{ id: string; deviceId: string }[]>`
        UPDATE "Device"
        SET status = 'OFFLINE'
        WHERE "isDeleted" = false
          AND status != 'OFFLINE'
          AND "lastHeartbeatAt" < ${cutoffTime}
        RETURNING id, "deviceId"
      `;

      if (deadDevices.length === 0) return;

      this.logger.warn(
        `⚠️ Marked ${deadDevices.length} device(s) as OFFLINE due to inactivity threshold (${offlineTimeoutSeconds}s).`,
      );

      // ─── FIX 2: Single bulk fetch for all assignments (was: N separate findMany calls) ───
      const deviceIds = deadDevices.map((d) => d.id);
      const assignments = await this.prisma.deviceAssignment.findMany({
        where: { deviceId: { in: deviceIds }, unassignedAt: null },
        select: { userId: true, deviceId: true },
      });

      // ─── FIX 3: Single createMany for all event logs (was: N×M individual INSERTs) ───
      if (assignments.length > 0) {
        await this.prisma.eventLog.createMany({
          data: assignments.map((a) => ({
            deviceId: a.deviceId,
            userId: a.userId,
            eventType: 'OFFLINE',
          })),
        });
      }

      // Emit realtime events for each offline device
      for (const device of deadDevices) {
        this.realtimeService.emitDeviceStatus(device.deviceId, DeviceStatus.OFFLINE);
      }
    } catch (error) {
      this.logger.error(
        '❌ Failed to execute offline device check scheduler',
        error.stack,
      );
    }
  }
}
