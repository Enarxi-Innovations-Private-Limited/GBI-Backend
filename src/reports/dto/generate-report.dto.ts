import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, IsIn } from 'class-validator';

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

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 3, 5, 10], { message: 'Interval must be one of: 1, 3, 5, 10' })
  intervalMinutes: number;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  parameters: string[];
}
