import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeviceStatus } from '@prisma/client';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.admin.findUnique({ where: { email } });
  }

  findDevice(deviceId: string) {
    return this.prisma.device.findUnique({ where: { deviceId } });
  }

  createDevice(deviceId: string, type?: string) {
    return this.prisma.device.create({
      data: {
        deviceId,
        type: type, // Optional: if undefined, Prisma uses @default("Air Quality Monitor")
        status: DeviceStatus.OFFLINE,
      },
    });
  }

  async getDevices(search?: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const where = {
      isDeleted: false,
      ...(search
        ? {
            deviceId: {
              contains: search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          deviceId: true,
          status: true,
          addedAt: true,
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findExistingDeviceIds(deviceIds: string[]) {
    const devices = await this.prisma.device.findMany({
      where: { deviceId: { in: deviceIds } },
      select: { deviceId: true },
    });
    return devices.map((d) => d.deviceId);
  }

  async bulkCreateDevices(devices: { deviceId: string; type?: string }[]) {
    const result = await this.prisma.device.createMany({
      data: devices.map((d) => ({
        deviceId: d.deviceId,
        type: d.type || 'Air Quality Monitor',
        status: DeviceStatus.OFFLINE,
      })),
      skipDuplicates: true,
    });

    return {
      successCount: result.count,
    };
  }

  forceUnassign(deviceId: string) {
    return this.prisma.deviceAssignment.updateMany({
      where: { deviceId, unassignedAt: null },
      data: { unassignedAt: new Date() },
    });
  }

  getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        organization: true,
        phone: true,
        isRestricted: true,
        assignments: {
          where: { unassignedAt: null },
          select: { id: true },
        },
      },
    });
  }

  restrictUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isRestricted: true },
    });
  }

  async updateUserRestriction(userId: string, value: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isRestricted: value },
    });
  }

  revokeUserSessions(userId: string) {
    return this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { message: 'User not found' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deviceAssignment.deleteMany({
        where: { userId },
      });

      await tx.alertState.deleteMany({
        where: { userId },
      });

      await tx.notification.deleteMany({
        where: { userId },
      });

      await tx.eventLog.updateMany({
        where: { userId },
        data: { userId: null },
      });

      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { message: 'User deleted successfully' };
  }

  async softDeleteDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.prisma.device.update({
      where: { deviceId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: DeviceStatus.OFFLINE,
      },
    });
  }

  async getStats() {
    const [totalUsers, totalDevices, onlineDevices, warningDevices] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.device.count({ where: { isDeleted: false } }),
        this.prisma.device.count({
          where: { isDeleted: false, status: DeviceStatus.ONLINE },
        }),
        this.prisma.device.count({
          where: { isDeleted: false, status: DeviceStatus.WARNING },
        }),
      ]);

    const offlineDevices = await this.prisma.device.count({
      where: { isDeleted: false, status: DeviceStatus.OFFLINE },
    });

    return {
      totalUsers,
      totalDevices,
      onlineDevices,
      offlineDevices,
      warningDevices,
    };
  }
}
