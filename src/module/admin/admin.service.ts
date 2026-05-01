import { JwtService } from '@nestjs/jwt';
import { AdminRepository } from './admin.repository';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';
import * as bcrypt from 'bcrypt';
import { CreateDeviceDto, DeviceType } from './dto/create-device.dto';
import * as ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { MailService } from 'src/mail/mail.service';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { randomInt } from 'crypto';
import { AdminForgotPasswordDto } from './dto/admin-forgot-password.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.repo.findCaseInsensitive(dto.email);
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(admin.id);
    return {
      ...tokens,
      user: {
        id: admin.id,
        email: admin.email,
        role: 'ADMIN',
      },
    };
  }

  async generateTokens(adminId: string) {
    const payload = {
      sub: adminId,
      type: 'admin',
    };

    const secret = this.config.get('ADMIN_JWT_SECRET');
    
    const accessToken = this.jwt.sign(payload, {
      secret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwt.sign(
      { ...payload, isRefreshToken: true },
      {
        secret,
        expiresIn: '30d',
      },
    );

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const secret = this.config.get('ADMIN_JWT_SECRET');
      const payload = this.jwt.verify(refreshToken, { secret });

      if (payload.type !== 'admin' || !payload.isRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(payload.sub);
      const admin = await this.repo.findById(payload.sub);
      if (!admin) throw new UnauthorizedException('Admin not found');

      return {
        ...tokens,
        user: {
          id: admin.id,
          email: admin.email,
          role: 'ADMIN',
        },
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout() {
    // For JWT-based refresh tokens, logout is handled by clearing cookies on the frontend.
    // If we wanted to supports server-side revocation, we'd need a blacklist in Redis.
    return { message: 'Logged out successfully' };
  }

  async getMe(id: string) {
    const admin = await this.repo.findById(id);
    if (!admin) throw new UnauthorizedException('Admin not found');
    return admin;
  }

  async impersonateUser(adminId: string, userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new BadRequestException('User not found');
    if (user.isRestricted) {
      throw new BadRequestException(
        'Cannot impersonate a restricted user account',
      );
    }

    // Sign a JWT with the USER secret so it passes JwtAuthGuard.
    // readonly: true tells ReadonlyGuard to block write operations.
    const payload = {
      sub: user.id,
      email: user.email,
      readonly: true,
      impersonatedBy: adminId,
    };

    const token = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '30m',
    });

    return {
      token,
      expiresIn: 1800, // seconds
      targetUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization,
      },
    };
  }

  async createDevice(dto: CreateDeviceDto) {
    const exists = await this.repo.findDevice(dto.deviceId);
    if (exists) throw new ConflictException('Device already exists');

    return this.repo.createDevice(dto.deviceId, dto.deviceType);
  }

  async bulkCreateDevices(fileBuffer: Buffer, filename: string) {
    const workbook = new ExcelJS.Workbook();

    try {
      if (filename.toLowerCase().endsWith('.csv')) {
        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null);
        await workbook.csv.read(stream);
      } else {
        await workbook.xlsx.load(Buffer.from(fileBuffer) as any);
      }
    } catch (error) {
      throw new BadRequestException(
        'Failed to parse file. Ensure it is a valid Excel or CSV file.',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Worksheet not found in the file.');
    }

    const devicesToCreate: { deviceId: string; type?: string; row: number }[] =
      [];
    const errors: { row: number; deviceId?: string; reason: string }[] = [];
    const allowedTypes = Object.values(DeviceType) as string[];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const deviceIdCol = row.getCell(1).value?.toString()?.trim();
      if (!deviceIdCol) {
        errors.push({ row: rowNumber, reason: 'Empty Device ID' });
        return;
      }

      const deviceTypeCol =
        row.getCell(2).value?.toString()?.trim() ||
        DeviceType.AIR_QUALITY_MONITOR;

      // Strict Enum Validation
      if (!allowedTypes.includes(deviceTypeCol)) {
        errors.push({
          row: rowNumber,
          deviceId: deviceIdCol,
          reason: `Invalid Type: ${deviceTypeCol}. Expected: 'Air Quality Monitor'`,
        });
        return;
      }

      devicesToCreate.push({
        deviceId: deviceIdCol,
        type: deviceTypeCol,
        row: rowNumber,
      });
    });

    if (devicesToCreate.length === 0 && errors.length === 0) {
      throw new BadRequestException(
        'No valid device records found in the file.',
      );
    }

    // Check for duplicates in the database
    const deviceIds = devicesToCreate.map((d) => d.deviceId);
    const existingDevices = await this.repo.findExistingDeviceIds(deviceIds);
    const existingSet = new Set(existingDevices);

    const uniqueDevicesToCreate = devicesToCreate.filter((d) => {
      if (existingSet.has(d.deviceId)) {
        errors.push({
          row: d.row,
          deviceId: d.deviceId,
          reason: 'Device ID already registered',
        });
        return false;
      }
      return true;
    });

    let successCount = 0;
    if (uniqueDevicesToCreate.length > 0) {
      const result = await this.repo.bulkCreateDevices(uniqueDevicesToCreate);
      successCount = result.successCount;
    }

    return {
      successCount,
      failureCount: errors.length,
      totalProcessed: uniqueDevicesToCreate.length + errors.length,
      errors: errors.sort((a, b) => a.row - b.row),
    };
  }

  async getDevices(
    search?: string,
    page: number = 1,
    limit: number = 10,
    assignmentStatus?: 'assigned' | 'unassigned',
  ) {
    return this.repo.getDevices(search, page, limit, assignmentStatus);
  }

  async forceUnassign(deviceId: string) {
    await this.repo.forceUnassign(deviceId);
    return { success: true };
  }

  async getUsers() {
    const users = await this.repo.getUsers();

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      phone: user.phone,
      isRestricted: user.isRestricted,
      deviceCount: user.assignments.length,
    }));
  }

  async restrictUser(userId: string) {
    await this.repo.restrictUser(userId);
    await this.repo.revokeUserSessions(userId);
    return { success: true };
  }

  async unrestrictUser(userId: string) {
    return this.repo.updateUserRestriction(userId, false);
  }

  async deleteUser(userId: string) {
    return this.repo.deleteUser(userId);
  }

  async deleteDevice(deviceId: string) {
    return this.repo.softDeleteDevice(deviceId);
  }

  async getStats() {
    return this.repo.getStats();
  }

  async forgotPassword(dto: AdminForgotPasswordDto) {
    const { email } = dto;
    const admin = await this.repo.findCaseInsensitive(email);

    // Security: Always return success message even if admin doesn't exist
    if (!admin) {
      return { message: 'If an account exists, a reset code has been sent.' };
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();
    
    // Store in Redis (10 minutes expiry)
    await this.redis.set(`admin_password_otp:${admin.email}`, otp, 'EX', 600);

    // Enqueue Admin Forgot Password email
    const frontendUrl = this.config.get('FRONTEND_URL') || 'https://gbiair.in';
    const resetLink = `${frontendUrl}/admin/reset-password?email=${encodeURIComponent(admin.email)}&otp=${otp}`;

    await this.mailService.enqueueAdminForgotPasswordEmail(
      admin.email,
      otp,
      resetLink,
      'Admin',
    );

    return { message: 'If an account exists, a reset code has been sent.' };
  }

  async resetPassword(dto: AdminResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    // 1. Verify OTP from Redis
    const storedOtp = await this.redis.get(`admin_password_otp:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    // 2. Find Admin
    const admin = await this.repo.findCaseInsensitive(email);
    if (!admin) {
      throw new BadRequestException('Admin account not found');
    }

    // 3. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // 4. Update password
    await this.repo.updateAdminPassword(admin.id, passwordHash);

    // 5. Cleanup OTP
    await this.redis.del(`admin_password_otp:${email}`);

    return { message: 'Password reset successfully' };
  }
}
