import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, IsIn } from 'class-validator';
import { IsNotArray } from 'src/common/decorators/is-not-array.decorator';

export class GenerateReportDto {
  @IsString({ message: 'deviceId must be a valid string' })
  @IsNotArray({
    message:
      'Report generation only supports one device at a time. Please provide exactly one deviceId.',
  })
  @IsNotEmpty({ message: 'deviceId is required in the query parameters' })
  deviceId: string;

  @IsString({ message: 'start time must be a valid ISO string' })
  @IsNotEmpty({ message: 'start time is required' })
  start: string;

  @IsString({ message: 'end time must be a valid ISO string' })
  @IsNotEmpty({ message: 'end time is required' })
  end: string;

  @Type(() => Number)
  @IsInt({ message: 'intervalMinutes must be an integer' })
  @IsIn([1, 3, 5, 10, 60, 360], {
    message: 'intervalMinutes must be one of: 1, 3, 5, 10, 60, 360',
  })
  @IsNotEmpty({ message: 'intervalMinutes is required' })
  intervalMinutes: number;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @Type(() => String)
  @IsString({ each: true, message: 'each parameter mapped must be a string' })
  @IsNotEmpty({
    message: 'at least one parameter is required (e.g. pm25, temperature, etc)',
  })
  parameters: string[];
}
