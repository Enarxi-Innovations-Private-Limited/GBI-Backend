import { IsOptional, IsString, Length } from 'class-validator';

export class ClaimDeviceDto {
  @IsString()
  @Length(3, 50)
  deviceId: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;
}
