import { Injectable } from '@nestjs/common';
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

  createDevice(deviceId: string) {
    return this.prisma.device.create({
      data: {
        deviceId,
        status: 'active',
      },
    });
  }

  getDevices() {
    return this.prisma.device.findMany({
      include: {
        assignments: {
          where: { unassignedAt: null },
          include: { user: true },
        },
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

  restricUser(userId: string) {
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
}
