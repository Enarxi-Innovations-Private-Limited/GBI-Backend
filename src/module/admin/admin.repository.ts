import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeviceStatus } from '@prisma/client';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.admin.findUnique({
      where: { email: email.trim() },
    });
  }

  findCaseInsensitive(email: string) {
    return this.prisma.admin.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
    });
  }

  findById(id: string) {
    return this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });
  }

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        organization: true,
        isRestricted: true,
      },
    });
  }

  findDevice(deviceId: string) {
    return this.prisma.device.findUnique({ where: { deviceId } });
  }

  createDevice(deviceId: string, type?: string) {
    return this.prisma.device.create({
      data: {
        deviceId,
        type: type,
        status: DeviceStatus.OFFLINE,
      },
    });
  }

  async getDevices(
    search?: string,
    page: number = 1,
    limit: number = 10,
    assignmentStatus?: 'assigned' | 'unassigned',
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
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

    if (assignmentStatus === 'assigned') {
      where.assignments = { some: { unassignedAt: null } };
    } else if (assignmentStatus === 'unassigned') {
      where.assignments = { none: { unassignedAt: null } };
    }

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
          assignments: {
            where: { unassignedAt: null },
            select: {
              user: {
                select: { name: true },
              },
            },
          },
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    // Fetch meta (city, pincode) from UserDevice using deviceIds
    const deviceIds = data.map((d) => d.deviceId);
    const userDevices =
      deviceIds.length > 0
        ? await this.prisma.userDevice.findMany({
            where: { deviceId: { in: deviceIds } },
            select: { deviceId: true, city: true, pincode: true },
          })
        : [];

    // ─── FIX: Replace O(N²) .find() loop with O(1) HashMap lookup ───
    // Old: data.map(device => userDevices.find(ud => ud.deviceId === device.deviceId))
    //      = N×M comparisons per render
    // New: Build map once O(N), then O(1) access per device
    const metaMap = new Map(userDevices.map((ud) => [ud.deviceId, ud]));

    const dataWithMeta = data.map((device) => {
      const meta = metaMap.get(device.deviceId);
      return {
        ...device,
        meta: meta ? { city: meta.city, pincode: meta.pincode } : null,
      };
    });

    return {
      data: dataWithMeta,
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
      await tx.deviceAssignment.deleteMany({ where: { userId } });
      await tx.alertState.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.eventLog.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    return { message: 'User deleted successfully' };
  }

  async softDeleteDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { deviceId } });

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

  /**
   * ─── OPTIMIZED ───
   * Old: 5 sequential COUNT queries (4 in Promise.all + 1 after)
   * New: 2 parallel queries — one COUNT for users, one GROUP BY for device status breakdown.
   *      Single table scan on Device instead of 4 separate scans.
   *      Uses new @@index([isDeleted, status]) for the GROUP BY.
   */
  async getStats() {
    const [userCount, deviceStatusGroups] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT status, COUNT(*) AS count
        FROM "Device"
        WHERE "isDeleted" = false
        GROUP BY status
      `,
    ]);

    const counts = Object.fromEntries(
      deviceStatusGroups.map((g) => [g.status, Number(g.count)]),
    );
    const totalDevices = Object.values(counts).reduce(
      (sum, n) => sum + (n as number),
      0,
    );

    return {
      totalUsers: userCount,
      totalDevices,
      onlineDevices: counts[DeviceStatus.ONLINE] ?? 0,
      offlineDevices: counts[DeviceStatus.OFFLINE] ?? 0,
      warningDevices: counts[DeviceStatus.WARNING] ?? 0,
    };
  }
}
