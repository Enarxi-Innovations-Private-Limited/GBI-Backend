import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class TelemetryPayloadDto {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'PM2.5 must be non-negative' })
  @Max(2000)
  pm25?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'PM10 must be non-negative' })
  @Max(2000)
  pm10?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'TVOC must be non-negative' })
  @Max(60000)
  tvoc?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'CO2 must be non-negative' })
  @Max(20000)
  co2?: number;

  @IsOptional()
  @IsNumber()
  @Min(-50, { message: 'Temperature cannot be below -50°C' })
  @Max(100, { message: 'Temperature cannot be above 100°C' })
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Humidity must be non-negative' })
  @Max(100, { message: 'Humidity cannot be above 100%' })
  humidity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Noise must be non-negative' })
  @Max(200, { message: 'Noise cannot be above 200 dBA' })
  noise?: number;
}
