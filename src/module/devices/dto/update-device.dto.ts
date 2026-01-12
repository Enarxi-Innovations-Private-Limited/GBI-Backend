import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;
}
