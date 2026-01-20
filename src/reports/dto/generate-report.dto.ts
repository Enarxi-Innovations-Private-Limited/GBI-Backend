import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateReportDto {
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  deviceIds: string[];

  @IsString()
  start: string;

  @IsString()
  end: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalMinutes?: number;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  parameters: string[];
}
