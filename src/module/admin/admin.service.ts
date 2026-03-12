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

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.repo.findByEmail(dto.email);
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: admin.id,
      type: 'admin',
    };

    const token = this.jwt.sign(payload, {
      secret: this.config.get('ADMIN_JWT_SECRET'),
      expiresIn: '12h',
    });

    return { accessToken: token };
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
}
