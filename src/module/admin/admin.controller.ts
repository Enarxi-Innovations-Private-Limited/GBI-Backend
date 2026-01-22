import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  getDevices(@Query('search') search?: string) {
    return this.adminService.getDevices(search);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
