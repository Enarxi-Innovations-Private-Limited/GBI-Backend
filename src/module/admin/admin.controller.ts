import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import type { FastifyRequest } from 'fastify';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.adminService.login(dto);
    const isProduction = process.env.NODE_ENV === 'production';

    // Set admin tokens as HttpOnly cookies
    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/admin', // Scoped to admin endpoints
      maxAge: 3 * 24 * 60 * 60, // 3 days
    });

    return result;
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.adminService.refreshTokens(oldRefreshToken);
    const isProduction = process.env.NODE_ENV === 'production';

    // Set new tokens as HttpOnly cookies (Rotation)
    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60,
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/admin',
      maxAge: 3 * 24 * 60 * 60,
    });

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    await this.adminService.logout(refreshToken);

    // Clear HttpOnly cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/admin' });

    return { message: 'Logged out successfully' };
  }

  @UseGuards(AdminGuard)
  @Get('me')
  getMe(@Req() req: any) {
    // AdminGuard already populated req.user with the payload
    return req.user;
  }

  @UseGuards(AdminGuard)
  @Post('devices')
  createDevice(@Body() dto: CreateDeviceDto) {
    return this.adminService.createDevice(dto);
  }

  @UseGuards(AdminGuard)
  @Post('devices/bulk')
  async uploadBulkDevices(@Req() req: FastifyRequest) {
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('Request must be multipart/form-data');
    }

    let file;
    try {
      file = await req.file();
    } catch (e) {
      throw new BadRequestException('Failed to process file upload');
    }

    if (!file) {
      throw new BadRequestException('Missing file in upload');
    }

    const buffer = await file.toBuffer();
    return this.adminService.bulkCreateDevices(buffer, file.filename);
  }

  @UseGuards(AdminGuard)
  @Post('devices/:id/unassign')
  forceUnassign(@Param('id') id: string) {
    return this.adminService.forceUnassign(id);
  }

  @UseGuards(AdminGuard)
  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @UseGuards(AdminGuard)
  @Patch('users/:id/restrict')
  restrictUser(@Param('id') id: string) {
    return this.adminService.restrictUser(id);
  }

  @UseGuards(AdminGuard)
  @Patch('users/:id/unrestrict')
  unrestrictUser(@Param('id') id: string) {
    return this.adminService.unrestrictUser(id);
  }

  @UseGuards(AdminGuard)
  @Get('devices')
  getDevices(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'ASSIGNED' | 'UNASSIGNED' | 'ALL',
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const assignmentStatus = status === 'ALL' ? undefined : status;
    return this.adminService.getDevices(search, pageNumber, limitNumber, assignmentStatus);
  }

  @UseGuards(AdminGuard)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @UseGuards(AdminGuard)
  @Patch('devices/:deviceId/delete')
  deleteDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.deleteDevice(deviceId);
  }

  @UseGuards(AdminGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }
}
