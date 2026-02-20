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
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
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
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.adminService.getDevices(search, pageNumber, limitNumber);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

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
