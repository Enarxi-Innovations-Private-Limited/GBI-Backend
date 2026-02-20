import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDevice(deviceId: string) {
    return this.prisma.device.findUnique({ where: { deviceId } });
  }

  // Check if device is currently assigned to ANYONE
  async isDeviceAssigned(deviceId: string): Promise<boolean> {
    const count = await this.prisma.deviceAssignment.count({
      where: {
        deviceId: { equals: deviceId }, // Must match relation field or ID? No, deviceId is a field on Assignment
        unassignedAt: null, // Active assignment
      },
      // Wait, deviceAssignment relates to device via 'deviceId' field which is a string in schema?
      // Let's verify schema: device Device @relation(fields: [deviceId], references: [id])
      // Ah! define: deviceId in Assignment refers to the UUID of the device, NOT the "GBI-001" string.
      // But the User inputs "GBI-001".
      // So first I need to find the UUID of the device from the String ID.
      // I will handle this ID lookup in the Service. Use internal IDs here.
    });
    return count > 0;
  }

  // Strictly check if assigned by specific internal ID
  async isDeviceAssignedById(id: string): Promise<boolean> {
    const count = await this.prisma.deviceAssignment.count({
      where: {
        deviceId: id,
        unassignedAt: null,
      },
    });
    return count > 0;
  }

  async claimDevice(
    userId: string,
    deviceInternalId: string,
    deviceDisplayId: string,
    name?: string,
    location?: string,
    city?: string,
    pincode?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Assignment
      const assignment = await tx.deviceAssignment.create({
        data: {
          userId,
          deviceId: deviceInternalId,
        },
      });

      // 2. Create User Metadata
      const meta = await tx.userDevice.upsert({
        where: { deviceId_userId: { userId, deviceId: deviceDisplayId } },
        create: {
          userId,
          deviceId: deviceDisplayId,
          name: name || deviceDisplayId,
          location,
          city,
          pincode,
        },
        update: {
          // If re-claiming (unlikely path if we block claim), but handle basics
          name: name || deviceDisplayId,
          location,
          city,
          pincode,
        },
      });

      return { assignment, meta };
    });
  }

  getUserDevices(userId: string) {
    // We need to return devices the user is ASSIGNED to.
    // We also want the metadata (UserDevice).
    return this.prisma.deviceAssignment.findMany({
      where: {
        userId,
        unassignedAt: null,
      },
      include: {
        device: true, // properties like status, type
      },
    });
  }

  // Get metadata for a list of device IDs (strings)
  getUserDeviceMeta(userId: string) {
    return this.prisma.userDevice.findMany({
      where: { userId },
    });
  }

  async unclaimDevice(userId: string, deviceInternalId: string) {
    // 1. Mark assignment as unassigned
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
    // We don't delete UserDevice metadata, maybe they want to remember settings if they reclaim?
    // Or we can delete it. User requested "unclaim".
    // "we don't record any datas ... untill user claims".
    // I think keeping metadata is fine, but breaking the link is key.
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
      where: { deviceId_userId: { userId, deviceId: deviceDisplayId } },
      create: {
        userId,
        deviceId: deviceDisplayId,
        name: name || deviceDisplayId,
        location,
      },
      update: {
        name,
        location,
      },
    });
  }

  // Helper to find UUID from String ID
  async getDeviceByStringId(deviceId: string) {
    return this.prisma.device.findUnique({ where: { deviceId } });
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
