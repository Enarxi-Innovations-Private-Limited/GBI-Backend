import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DeviceType {
  AIR_QUALITY_MONITOR = 'Air Quality Monitor',
  // FUTURE_DEVICE = 'Future Device'
}

export class CreateDeviceto {
  @IsString()
  deviceId: string;

  @IsOptional()
  @IsEnum(DeviceType, {
    message: 'deviceType must be one of the following: Air Quality Monitor',
  })
  deviceType?: DeviceType;
}
