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

    const individualThreshold = await this.prisma.deviceThreshold.findUnique({
      where: { deviceId: device.id },
    });

    if (individualThreshold) {
      throw new BadRequestException(
        'Remove individual threshold before adding to group',
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
}
