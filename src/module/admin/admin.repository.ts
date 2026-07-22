import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeviceStatus } from '@prisma/client';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.admin.findUnique({
      where: { email: email.trim() }, // We don't use 'mode' on findUnique (it's not supported by Prisma)
    });
  }

  // Adding a fallback case-insensitive search if findUnique (exact match) fails
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

  updateAdminPassword(id: string, passwordHash: string) {
    return this.prisma.admin.update({
      where: { id },
      data: { passwordHash },
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

  findUsersByEmails(emails: string[]) {
    return this.prisma.user.findMany({
      where: {
        email: {
          in: emails.map((e) => e.toLowerCase().trim()),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        organization: true,
        phone: true,
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
        type: type, // Optional: if undefined, Prisma uses @default("Air Quality Monitor")
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

    let deviceIdsByNickname: string[] = [];
    if (search) {
      const matchingUserDevices = await this.prisma.userDevice.findMany({
        where: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        select: { deviceId: true },
      });
      deviceIdsByNickname = matchingUserDevices.map((ud) => ud.deviceId);
    }

    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        {
          deviceId: {
            contains: search,
            mode: 'insensitive' as const,
          },
        },
        {
          deviceId: {
            in: deviceIdsByNickname,
          },
        },
        {
          assignments: {
            some: {
              unassignedAt: null,
              user: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            },
          },
        },
      ];
    }

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
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    // Fetch meta (name, city, pincode) from UserDevice using deviceIds
    const deviceIds = data.map((d) => d.deviceId);
    const userDevices = await this.prisma.userDevice.findMany({
      where: { deviceId: { in: deviceIds } },
    });

    const dataWithMeta = data.map((device) => {
      const meta = userDevices.find((ud) => ud.deviceId === device.deviceId);
      return {
        ...device,
        meta: meta ? { name: meta.name, city: meta.city, pincode: meta.pincode } : null,
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

  async getUsers() {
    const [users, admins] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          organization: true,
          phone: true,
          isRestricted: true,
          isProfileComplete: true,
          assignments: {
            where: { unassignedAt: null },
            select: { id: true },
          },
        },
      }),
      this.prisma.admin.findMany({
        select: { email: true },
      }),
    ]);

    const adminEmails = new Set(admins.map((a) => a.email.toLowerCase().trim()));

    return users.filter((user) => !adminEmails.has(user.email.toLowerCase().trim()));
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
      throw new NotFoundException('User not found');
    }

    if (user.isProfileComplete) {
      throw new BadRequestException('Cannot delete a user with a completed profile.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Dissociate any devices from custom device groups created by this user
      const userGroups = await tx.deviceGroup.findMany({
        where: { userId },
        select: { id: true },
      });
      const userGroupIds = userGroups.map((g) => g.id);

      if (userGroupIds.length > 0) {
        await tx.device.updateMany({
          where: { groupId: { in: userGroupIds } },
          data: { groupId: null },
        });

        // 2. Delete the user's custom device groups
        await tx.deviceGroup.deleteMany({
          where: { id: { in: userGroupIds } },
        });
      }

      // 3. Delete user device nickname/metadata settings (UserDevice)
      await tx.userDevice.deleteMany({
        where: { userId },
      });

      // 4. Delete active assignments
      await tx.deviceAssignment.deleteMany({
        where: { userId },
      });

      // 5. Delete alert configs
      await tx.alertState.deleteMany({
        where: { userId },
      });

      // 6. Delete notifications
      await tx.notification.deleteMany({
        where: { userId },
      });

      // 7. Keep event logs for audits but disassociate them from the user
      await tx.eventLog.updateMany({
        where: { userId },
        data: { userId: null },
      });

      // 8. Delete active session tokens
      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      // 9. Finally, delete the user
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
    const [allUsers, admins, totalDevices, onlineDevices, warningDevices] =
      await Promise.all([
        this.prisma.user.findMany({ select: { email: true } }),
        this.prisma.admin.findMany({ select: { email: true } }),
        this.prisma.device.count({ where: { isDeleted: false } }),
        this.prisma.device.count({
          where: { isDeleted: false, status: DeviceStatus.ONLINE },
        }),
        this.prisma.device.count({
          where: { isDeleted: false, status: DeviceStatus.WARNING },
        }),
      ]);

    const adminEmails = new Set(admins.map((a) => a.email.toLowerCase().trim()));
    const customerUsers = allUsers.filter(
      (u) => !adminEmails.has(u.email.toLowerCase().trim()),
    );
    const totalUsers = customerUsers.length;

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
