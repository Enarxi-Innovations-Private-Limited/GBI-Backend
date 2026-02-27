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
    await this.prisma.deviceAssignment.updateMany({
      where: {
        userId,
        deviceId: deviceInternalId,
        unassignedAt: null,
      },
      data: {
        unassignedAt: new Date(),
      },
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
    return this.prisma.userDevice.upsert({
      where: { deviceId: deviceDisplayId },
      create: {
        userId,
        deviceId: deviceDisplayId,
        name: name || deviceDisplayId,
        location: location || '',
        city: city || '',
        pincode: pincode || '',
      },
      update: {
        name,
        location,
        city,
        pincode,
      },
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
}
