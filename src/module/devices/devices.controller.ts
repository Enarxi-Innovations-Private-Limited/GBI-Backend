import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
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
    // Note: :id here is the String ID ("GBI-001"), not UUID, for user friendliness
    return this.devicesService.updateDevice(user.id, id, dto);
  }

  @Delete(':id')
  unclaim(@CurrentUser() user: any, @Param('id') id: string) {
    return this.devicesService.unclaimDevice(user.id, id);
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
