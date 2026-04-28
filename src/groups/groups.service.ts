import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, name: string) {
    return this.prisma.deviceGroup.create({
      data: { userId, name },
    });
  }

  async getUserGroups(userId: string) {
    return this.prisma.deviceGroup.findMany({
      where: { userId },
      include: {
        devices: true,
        threshold: true,
      },
    });
  }

  async addDeviceToGroup(
    userId: string,
    groupId: string,
    physicalDeviceId: string,
  ) {
    const group = await this.prisma.deviceGroup.findFirst({
      where: { id: groupId, userId },
    });

    if (!group) {
      throw new ForbiddenException('Group not found or access denied');
    }

    const device = await this.prisma.device.findUnique({
      where: { deviceId: physicalDeviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // 1. Verify User Owns the Device (Security Fix)
    const assignment = await this.prisma.deviceAssignment.findFirst({
      where: {
        userId,
        deviceId: { equals: device.id }, // Internal UUID
        unassignedAt: null,
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You do not own this device or it is not assigned to you',
      );
    }

    if (device.groupId) {
      throw new BadRequestException(
        'Device is already assigned to another group',
      );
    }
    
    // 2. Check Mutex: Ensure no individual threshold exists
    const individualThreshold = await this.prisma.deviceThreshold.findUnique({
      where: { deviceId: device.id },
    });

    if (individualThreshold) {
      throw new BadRequestException(
        'Device is already been set as individual threshold',
      );
    }

    return this.prisma.device.update({
      where: { id: device.id },
      data: { groupId },
    });
  }

  async removeDeviceFromGroup(
    userId: string,
    groupId: string,
    physicalDeviceId: string,
  ) {
    const device = await this.prisma.device.findFirst({
      where: {
        deviceId: physicalDeviceId,
        group: { id: groupId, userId },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found in this group');
    }

    return this.prisma.device.update({
      where: { id: device.id },
      data: { groupId: null },
    });
  }

  async setGroupThreshold(
    userId: string,
    groupId: string,
    thresholds: Record<string, number>,
  ) {
    const group = await this.prisma.deviceGroup.findFirst({
      where: { id: groupId, userId },
      include: { devices: true },
    });

    if (!group) {
      throw new ForbiddenException('Group not found or access denied');
    }

    const conflictingDevice = await this.prisma.deviceThreshold.findFirst({
      where: {
        device: { groupId },
      },
    });

    if (conflictingDevice) {
      throw new BadRequestException(
        'Remove individual device thresholds before setting group threshold',
      );
    }

    return this.prisma.groupThreshold.upsert({
      where: { groupId },
      update: { thresholds },
      create: { groupId, thresholds },
    });
  }

  async removeGroupThreshold(userId: string, groupId: string) {
    const group = await this.prisma.deviceGroup.findFirst({
      where: { id: groupId, userId },
    });

    if (!group) {
      throw new ForbiddenException();
    }

    await this.prisma.groupThreshold.delete({
      where: { groupId },
    });

    return { message: 'Group threshold removed' };
  }

  async deleteGroup(userId: string, groupId: string) {
    const group = await this.prisma.deviceGroup.findFirst({
      where: { id: groupId, userId },
      include: { devices: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found or access denied');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupThreshold.deleteMany({
        where: { groupId },
      });

      await tx.device.updateMany({
        where: { groupId },
        data: { groupId: null },
      });

      await tx.deviceGroup.delete({
        where: { id: groupId },
      });
    });

    return { message: 'Group deleted successfully' };
  }
}
