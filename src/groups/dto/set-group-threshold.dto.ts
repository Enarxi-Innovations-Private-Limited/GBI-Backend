import { IsObject } from 'class-validator';

export class SetGroupThresholdDto {
  @IsObject()
  thresholds: Record<string, number>;
}
