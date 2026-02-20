import { IsOptional, IsString, Length, Matches } from 'class-validator';

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

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode: string;

  @IsString()
  @Length(1, 100)
  city: string;
}
