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
  BadRequestException,
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

  /**
   * GET /devices/chart-data
   * Returns time-bucketed telemetry for one or more devices for charting.
   *
   * Query params:
   *   deviceIds  - comma-separated display IDs, e.g. "GBIAIR1000,GBIAIR1001"
   *   parameter  - metric key, e.g. "pm25"
   *   start      - ISO 8601 start timestamp
   *   end        - ISO 8601 end timestamp
   *   intervalMinutes (optional) - bucket size in minutes; auto-computed if omitted
   */
  @Get('chart-data')
  async getChartData(
    @CurrentUser() user: any,
    @Query('deviceIds') rawDeviceIds: string,
    @Query('parameter') parameter: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('intervalMinutes') intervalMinutes?: string,
  ) {
    if (!rawDeviceIds || !parameter || !start || !end) {
      throw new BadRequestException(
        'deviceIds, parameter, start, and end are all required',
      );
    }

    const deviceIds = rawDeviceIds.split(',').map((id) => id.trim()).filter(Boolean);
    if (!deviceIds.length) {
      throw new BadRequestException('deviceIds must contain at least one ID');
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp');
    }

    const interval = intervalMinutes ? parseInt(intervalMinutes, 10) : undefined;

    return this.devicesService.getChartData(
      user.id,
      deviceIds,
      parameter,
      startDate,
      endDate,
      interval,
    );
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
  getLatestTelemetry(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('lastTimestamp') lastTimestamp?: string,
  ) {
    return this.devicesService.getLatestTelemetry(user.id, id, lastTimestamp);
  }

  @Get(':id/telemetry')
  getDeviceTelemetry(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
    @Query('metric') metric?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minutes') minutes?: string,
  ) {
    return this.devicesService.getDeviceTelemetry(
      user.id,
      deviceId,
      metric,
      startDate,
      endDate,
      minutes,
    );
  }
}
