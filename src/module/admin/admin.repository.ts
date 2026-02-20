import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
        status: 'active',
      },
    });
  }

  async getDevices(search?: string) {
    return this.prisma.device.findMany({
      where: {
        isDeleted: false,
        ...(search
          ? {
              deviceId: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: { addedAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        status: true,
        addedAt: true,
      },
    });
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

      await tx.alertThreshold.deleteMany({
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
        status: 'inactive',
      },
    });
  }

  async getStats() {
    const [totalUsers, totalDevices, onlineDevices, warningDevices] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.device.count({ where: { isDeleted: false } }),
        this.prisma.device.count({
          where: { isDeleted: false, status: 'active' },
        }),
        this.prisma.device.count({
          where: { isDeleted: false, status: 'warning' },
        }),
      ]);

    const offlineDevices = await this.prisma.device.count({
      where: { isDeleted: false, status: 'offline' },
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
