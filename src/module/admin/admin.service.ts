import { JwtService } from '@nestjs/jwt';
import { AdminRepository } from './admin.repository';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminLoginDto } from './dto/admin-login.dto';
import * as bcrypt from 'bcrypt';
import { CreateDeviceto } from './dto/create-device.dto';

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

  async createDevice(dto: CreateDeviceto) {
    const exists = await this.repo.findDevice(dto.deviceId);
    if (exists) throw new ConflictException('Device already exists');

    return this.repo.createDevice(dto.deviceId, dto.deviceType);
  }

  getDevices() {
    return this.repo.getDevices();
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
    await this.repo.restricUser(userId);
    await this.repo.revokeUserSessions(userId);
    return { success: true };
  }
}
