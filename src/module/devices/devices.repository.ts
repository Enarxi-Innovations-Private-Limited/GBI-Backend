import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete all telemetry for this device
      await tx.deviceTelemetry.deleteMany({
        where: { deviceId: deviceInternalId },
      });

      // 2. Mark assignment as finished
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

      // 3. Delete metadata for this user/device
      // We look up the device display string first to target UserDevice
      const device = await tx.device.findUnique({
        where: { id: deviceInternalId },
      });
      if (device) {
        await tx.userDevice.deleteMany({
          where: {
            userId,
            deviceId: device.deviceId,
          },
        });
      }
    });
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
    metric: string,
    startDate?: string,
    endDate?: string,
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
    } else {
      // Default to last 24 hours if no dates provided
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.timestamp = { gte: yesterday };
    }

    const rows = await this.prisma.deviceTelemetry.findMany({
      where,
      orderBy: { timestamp: 'asc' },
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
      // If the range is > 24 hours, maybe include date, but frontend usually handles it or just wants a string.
      // We'll provide standard ISO string for timestamp and a readable time label.

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
}
