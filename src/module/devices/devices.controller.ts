import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ReadonlyGuard } from '../../auth/guards/readonly.guard';
import { ReadonlyBlocked } from '../../auth/decorators/readonly.decorator';
import { DevicesService } from './devices.service';
import { ClaimDeviceDto } from './dto/claim-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SetDeviceThresholdDto } from './dto/set-device-threshold.dto';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('claim')
  claim(@CurrentUser() user: any, @Body() dto: ClaimDeviceDto) {
    return this.devicesService.claimDevice(user.id, dto);
  }

  @Get()
  getMyDevices(@CurrentUser() user: any) {
    return this.devicesService.getMyDevices(user.id);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.updateDevice(user.id, id, dto);
  }

  /**
   * Unassign feature is intentionally disabled at the application layer.
   * DB schema and internal service logic are preserved for future re-enablement.
   */
  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Delete(':id')
  unclaimDevice(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.unclaimDevice(user.id, id);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post(':id/threshold')
  setDeviceThreshold(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Body() dto: SetDeviceThresholdDto,
  ) {
    return this.devicesService.setDeviceThreshold(
      user.id,
      deviceId,
      dto.thresholds,
    );
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Delete(':id/threshold')
  removeDeviceThreshold(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
  ) {
    return this.devicesService.removeDeviceThreshold(user.id, deviceId);
  }

  @Get(':id/latest')
  getLatestTelemetry(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.getLatestTelemetry(user.id, id);
  }

  @Get(':id/telemetry')
  getDeviceTelemetry(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Query('metric') metric: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!metric) {
      const { BadRequestException } = require('@nestjs/common');
      throw new BadRequestException('metric query parameter is required');
    }
    return this.devicesService.getDeviceTelemetry(
      user.id,
      deviceId,
      metric,
      startDate,
      endDate,
    );
  }
}
