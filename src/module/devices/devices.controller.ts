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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';
import { ClaimDeviceDto } from './dto/claim-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SetDeviceThresholdDto } from './dto/set-device-threshold.dto';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('claim')
  claim(@CurrentUser() user: any, @Body() dto: ClaimDeviceDto) {
    return this.devicesService.claimDevice(user.id, dto);
  }

  @Get()
  getMyDevices(@CurrentUser() user: any) {
    return this.devicesService.getMyDevices(user.id);
  }

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
  @Delete(':id')
  @HttpCode(403)
  unclaimDevice(): never {
    throw new ForbiddenException('Unassign feature is currently disabled');
  }

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

  @Delete(':id/threshold')
  removeDeviceThreshold(
    @CurrentUser() user: any,
    @Param('id') deviceId: string,
  ) {
    return this.devicesService.removeDeviceThreshold(user.id, deviceId);
  }
}
