import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AdminForgotPasswordDto } from './dto/admin-forgot-password.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(AdminGuard)
  @Get('me')
  getMe(@Req() req: FastifyRequest & { user: any }) {
    return this.adminService.getMe(req.user.sub);
  }

  @Post('login')
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.adminService.login(dto);
    const isProduction = process.env.NODE_ENV === 'production';

    // Set tokens as HttpOnly cookies
    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: 15 * 60, // 15 mins
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/', // Changed from /api/admin to ensure proxy compatibility if needed
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return { user: result.user };
  }

  @Post('refresh-token')
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.adminService.refreshTokens(refreshToken);
    const isProduction = process.env.NODE_ENV === 'production';

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
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { user: result.user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return this.adminService.logout();
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: AdminForgotPasswordDto) {
    return this.adminService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: AdminResetPasswordDto) {
    return this.adminService.resetPassword(dto);
  }



  @UseGuards(AdminGuard)
  @Get('users/:userId/impersonate')
  impersonateUser(
    @Param('userId') userId: string,
    @Req() req: FastifyRequest & { user: any },
  ) {
    return this.adminService.impersonateUser(req.user.sub, userId);
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
    @Query('assignmentStatus') assignmentStatus?: 'assigned' | 'unassigned',
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getDevices(
      search,
      pageNumber,
      limitNumber,
      assignmentStatus,
    );
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
