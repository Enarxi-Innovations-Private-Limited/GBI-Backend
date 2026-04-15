import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class DevicesRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // Helper to find a device by display ID (e.g. "GBI-001") → returns full Device record
  async getDeviceByStringId(deviceId: string) {
    return this.prisma.device.findUnique({ where: { deviceId } });
  }

  /**
   * Fully atomic claim operation.
   * All steps happen inside a single Prisma transaction:
   *   1. Look up the Device by display ID
   *   2. Validate no active assignment exists (race-condition safe)
   *   3. Create DeviceAssignment (deviceId = device.id UUID)
   *   4. Create UserDevice metadata (deviceId = device.deviceId display string)
   *
   * A DB-level partial unique index on DeviceAssignment(deviceId) WHERE unassignedAt IS NULL
   * acts as the final guard against concurrent duplicate claims.
   */
  async claimDevice(
    userId: string,
    dto: {
      deviceId: string;
      name: string;
      location: string;
      city: string;
      pincode: string;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Step 1: Look up device inside transaction
        const device = await tx.device.findUnique({
          where: { deviceId: dto.deviceId },
        });
        if (!device) {
          throw new NotFoundException(
            'Device ID not found. Please contact support if you believe this is an error.',
          );
        }

        // Step 2: Validate no active assignment (findFirst, not count — semantically clear)
        const existing = await tx.deviceAssignment.findFirst({
          where: {
            deviceId: device.id, // UUID FK
            unassignedAt: null,
          },
        });
        if (existing) {
          throw new ConflictException(
            'Device is already claimed by another user.',
          );
        }

        // Step 3: Create assignment — deviceId = device.id (UUID, FK to Device)
        const assignment = await tx.deviceAssignment.create({
          data: {
            userId,
            deviceId: device.id,
          },
        });

        // Step 4: Create UserDevice metadata — deviceId = device.deviceId (display string)
        const meta = await tx.userDevice.create({
          data: {
            userId,
            deviceId: device.deviceId,
            name: dto.name,
            location: dto.location,
            city: dto.city,
            pincode: dto.pincode,
          },
        });

        return { assignment, meta };
      });
    } catch (err) {
      // Convert DB-level unique constraint violation (race condition) to a clean 409
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Device is already claimed by another user.',
        );
      }
      // Re-throw NestJS HTTP exceptions (NotFoundException, ConflictException) as-is
      throw err;
    }
  }

  getUserDevices(userId: string) {
    return this.prisma.deviceAssignment.findMany({
      where: {
        userId,
        unassignedAt: null,
      },
      include: {
        device: true,
      },
    });
  }

  getUserDeviceMeta(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId },
    });
  }

  async unclaimDevice(userId: string, deviceInternalId: string) {
    // ─── FIX: Remove telemetry DELETE from the transaction ───
    // Issue: deleteMany on a potentially millions-of-row table inside a DB transaction
    //        holds a write lock for minutes, blocking ALL telemetry inserts.
    // Fix:   Keep only the critical operations in the transaction (assignment + meta).
    //        Telemetry cleanup runs asynchronously in the background so the API
    //        responds immediately without blocking.
    const device = await this.prisma.$transaction(async (tx) => {
      // Mark assignment as finished
      await tx.deviceAssignment.updateMany({
        where: {
          userId,
          deviceId: deviceInternalId,
          unassignedAt: null,
        },
        data: {
          unassignedAt: new Date(),
        },
      });

      // Get device to resolve display ID for UserDevice lookup
      const dev = await tx.device.findUnique({
        where: { id: deviceInternalId },
        select: { id: true, deviceId: true },
      });

      if (dev) {
        await tx.userDevice.deleteMany({
          where: {
            userId,
            deviceId: dev.deviceId,
          },
        });
      }

      return dev;
    });

    // Fire-and-forget telemetry cleanup — runs in background, doesn't block the response
    if (device) {
      setImmediate(async () => {
        try {
          await this.prisma.deviceTelemetry.deleteMany({
            where: { deviceId: deviceInternalId },
          });
        } catch (err) {
          // Non-critical: log but don't surface to caller
          console.error(
            `[DevicesRepository] Background telemetry cleanup failed for ${deviceInternalId}:`,
            err.message,
          );
        }
      });
    }
  }

  async updateDeviceMeta(
    userId: string,
    deviceDisplayId: string,
    name?: string,
    location?: string,
    city?: string,
    pincode?: string,
  ) {
    const result = await this.prisma.userDevice.updateMany({
      where: {
        deviceId: deviceDisplayId,
        userId: userId,
      },
      data: {
        name,
        location,
        city,
        pincode,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        'Device metadata not found or ownership not verified',
      );
    }

    return this.prisma.userDevice.findUnique({
      where: { deviceId: deviceDisplayId },
    });
  }

  setDeviceThreshold(deviceId: string, thresholds: Record<string, number>) {
    return this.prisma.deviceThreshold.upsert({
      where: { deviceId },
      update: { thresholds },
      create: { deviceId, thresholds },
    });
  }

  removeDeviceThreshold(deviceId: string) {
    return this.prisma.deviceThreshold.delete({
      where: { deviceId },
    });
  }

  async getDeviceTelemetry(
    deviceStringId: string,
    metric?: string,
    startDate?: string,
    endDate?: string,
    minutes?: string,
  ) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId: deviceStringId },
    });

    if (!device) throw new NotFoundException('Device not found');

    const where: Prisma.DeviceTelemetryWhereInput = {
      deviceId: device.id,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    } else if (minutes) {
      const minutesAgo = new Date();
      minutesAgo.setMinutes(minutesAgo.getMinutes() - parseInt(minutes, 10));
      where.timestamp = { gte: minutesAgo };
    } else {
      // Default to last 24 hours if no dates provided
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.timestamp = { gte: yesterday };
    }

    // ─── FIX: Hard row cap prevents OOM crashes on wide time-range requests ───
    // Enforces a maximum of 10,000 raw rows. For larger ranges, callers should
    // use the bucketed telemetry endpoint (queryBucketedTelemetry) instead.
    const MAX_RAW_ROWS = 10_000;

    if (!metric) {
      // Return ALL metrics for the given timeframe
      const rows = await this.prisma.deviceTelemetry.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        take: MAX_RAW_ROWS,
      });
      return rows.map((row) => ({
        timestamp: (row.timestamp as Date).toISOString(),
        pm25: row.pm25 !== null ? Number(row.pm25) : null,
        pm10: row.pm10 !== null ? Number(row.pm10) : null,
        tvoc: row.tvoc !== null ? Number(row.tvoc) : null,
        co2: row.co2 !== null ? Number(row.co2) : null,
        temperature: row.temperature !== null ? Number(row.temperature) : null,
        humidity: row.humidity !== null ? Number(row.humidity) : null,
        noise: row.noise !== null ? Number(row.noise) : null,
        aqi: row.aqi !== null ? Number(row.aqi) : null,
      }));
    }

    const rows = await this.prisma.deviceTelemetry.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: MAX_RAW_ROWS,
      select: {
        timestamp: true,
        [metric]: true, // Select the specific metric requested
      },
    });

    // Format for frontend ApexCharts: { timestamp, time, value }
    return rows.map((row) => {
      const ts = row.timestamp as Date;
      const timeLabel = ts.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        timestamp: ts.toISOString(),
        time: timeLabel,
        value:
          row[metric as keyof typeof row] !== null &&
          row[metric as keyof typeof row] !== undefined
            ? Number(row[metric as keyof typeof row])
            : null,
      };
    });
  }

  /**
   * Get latest telemetry reading for a device.
   *
   * ─── OPTIMIZED ───
   * Old: Always 2 sequential DB queries (device lookup + telemetry findFirst).
   * New: Try Redis FIRST (written by MQTT consumer on every message).
   *      Sub-millisecond response on cache hit. Zero DB reads for the hot path.
   *      Falls back to DB on cache miss (cold start or Redis restart).
   */
  async getLatestTelemetrySince(deviceStringId: string, lastTimestamp?: string) {
    // 1. Check Redis latest-state cache (populated by mqtt.consumer on every message)
    try {
      const cached = await this.redis.get(`device:${deviceStringId}:latest`);
      if (cached) {
        const state = JSON.parse(cached);
        // If client provided a timestamp and Redis state is not newer, signal "no update"
        if (lastTimestamp && state.timestamp <= lastTimestamp) {
          return null;
        }
        return state;
      }
    } catch {
      // Redis unavailable — silently fall through to DB
    }

    // 2. DB fallback (cold start, Redis miss, or device never sent data via MQTT)
    const device = await this.prisma.device.findUnique({
      where: { deviceId: deviceStringId },
    });

    if (!device) throw new NotFoundException('Device not found');

    const where: Prisma.DeviceTelemetryWhereInput = {
      deviceId: device.id,
    };

    if (lastTimestamp) {
      where.timestamp = { gt: new Date(lastTimestamp) };
    }

    return this.prisma.deviceTelemetry.findFirst({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }
}
