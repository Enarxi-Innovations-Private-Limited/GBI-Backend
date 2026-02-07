import { IsObject } from 'class-validator';

export class SetDeviceThresholdDto {
  @IsObject()
  thresholds: Record<string, number>;
}
