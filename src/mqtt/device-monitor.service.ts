import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DeviceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(DeviceMonitorService.name);
  
  // Track miss count for each device
  private missCounters = new Map<string, number>();
  
  // Track last heartbeat timestamp for comparison
  private lastHeartbeats = new Map<string, number>();
  
  // Configuration from .env
  private checkIntervalSeconds: number;
  private offlineThresholdMisses: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Read from .env with defaults
    this.checkIntervalSeconds = parseInt(
      this.configService.get('DEVICE_CHECK_INTERVAL_SECONDS', '5'),
      10,
    );
    this.offlineThresholdMisses = parseInt(
      this.configService.get('DEVICE_OFFLINE_THRESHOLD_MISSES', '5'),
      10,
    );
    
    // Validate values
    if (this.checkIntervalSeconds < 1) {
      this.logger.warn('Invalid DEVICE_CHECK_INTERVAL_SECONDS, using default: 5');
      this.checkIntervalSeconds = 5;
    }
    if (this.offlineThresholdMisses < 1) {
      this.logger.warn('Invalid DEVICE_OFFLINE_THRESHOLD_MISSES, using default: 5');
      this.offlineThresholdMisses = 5;
    }
  }

  onModuleInit() {
    const intervalMs = this.checkIntervalSeconds * 1000;
    const totalOfflineSeconds = this.checkIntervalSeconds * this.offlineThresholdMisses;
    
    setInterval(() => this.checkDeviceStatus(), intervalMs);
    
    this.logger.log(
      `🔍 Device monitor started:` +
      ` checking every ${this.checkIntervalSeconds} seconds,` +
      ` offline after ${this.offlineThresholdMisses} consecutive misses` +
      ` (${totalOfflineSeconds} seconds total)`,
    );
  }

  private async checkDeviceStatus() {
    try {
      // Get all active devices
      const devices = await this.prisma.device.findMany({
        select: {
          id: true,
          deviceId: true,
          status: true,
          lastHeartbeatAt: true,
        },
      });

      for (const device of devices) {
        const currentHeartbeat = device.lastHeartbeatAt?.getTime() || 0;
        const lastKnownHeartbeat = this.lastHeartbeats.get(device.id) || 0;
        
        // Check if device sent data since last check
        if (currentHeartbeat > lastKnownHeartbeat) {
          // Device sent data! Reset counter and ensure active
          this.missCounters.set(device.id, 0);
          this.lastHeartbeats.set(device.id, currentHeartbeat);
          
          // If device was inactive, mark it active again
          if (device.status === 'inactive') {
            await this.markDeviceActive(device);
          }
        } else {
          // No new data since last check - increment miss counter
          const currentCount = this.missCounters.get(device.id) || 0;
          const newCount = currentCount + 1;
          this.missCounters.set(device.id, newCount);
          
          this.logger.debug(`Device ${device.deviceId}: ${newCount} consecutive misses`);
          
          // If reached threshold, mark inactive
          if (newCount >= this.offlineThresholdMisses && device.status === 'active') {
            await this.markDeviceInactive(device);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error checking device status:', error.message);
    }
  }

  private async markDeviceActive(device: any) {
    await this.prisma.device.update({
      where: { id: device.id },
      data: { status: 'active' },
    });

    this.logger.log(`✅ Device ${device.deviceId} is back ONLINE`);

    // Create event log
    const assignments = await this.prisma.deviceAssignment.findMany({
      where: { deviceId: device.id, unassignedAt: null },
      select: { userId: true },
    });

    for (const a of assignments) {
      await this.prisma.eventLog.create({
        data: {
          deviceId: device.id,
          userId: a.userId,
          eventType: 'ONLINE',
        },
      });

      await this.prisma.notification.create({
        data: {
          userId: a.userId,
          deviceId: device.id,
          message: `✅ Device ${device.deviceId} is back online`,
        },
      });
    }
  }

  private async markDeviceInactive(device: any) {
    await this.prisma.device.update({
      where: { id: device.id },
      data: { status: 'inactive' },
    });

    const totalSeconds = this.checkIntervalSeconds * this.offlineThresholdMisses;
    this.logger.warn(
      `⚠️ Device ${device.deviceId} went OFFLINE ` +
      `(${this.offlineThresholdMisses} consecutive misses, ${totalSeconds} seconds)`,
    );

    // Create event log and notifications
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
          message: `⚠️ Device ${device.deviceId} went offline (no data for 25 seconds)`,
        },
      });
    }
  }
}

