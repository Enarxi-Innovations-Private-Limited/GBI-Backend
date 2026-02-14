import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform, Expose } from 'class-transformer';

export class TelemetryPayloadDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'PM2.5 must be a valid number' })
  @Min(0, { message: 'PM2.5 must be non-negative' })
  @Max(2000)
  pm25?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'PM10 must be a valid number' })
  @Min(0, { message: 'PM10 must be non-negative' })
  @Max(2000)
  pm10?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'TVOC must be a valid number' })
  @Min(0, { message: 'TVOC must be non-negative' })
  @Max(60000)
  tvoc?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'CO2 must be a valid number' })
  @Min(0, { message: 'CO2 must be non-negative' })
  @Max(20000)
  co2?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : parseFloat(num.toFixed(1));
  })
  @IsNumber({}, { message: 'Temperature must be a valid number' })
  @Min(-50, { message: 'Temperature cannot be below -50°C' })
  @Max(100, { message: 'Temperature cannot be above 100°C' })
  temperature?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : parseFloat(num.toFixed(1));
  })
  @IsNumber({}, { message: 'Humidity must be a valid number' })
  @Min(0, { message: 'Humidity must be non-negative' })
  @Max(100, { message: 'Humidity cannot be above 100%' })
  humidity?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'Noise must be a valid number' })
  @Min(0, { message: 'Noise must be non-negative' })
  @Max(200, { message: 'Noise cannot be above 200 dBA' })
  noise?: number;

  @IsOptional()

  @Transform(({ value }) => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? NaN : Math.round(num);
  })
  @IsNumber({}, { message: 'AQI must be a valid number' })
  @Min(0, { message: 'AQI must be non-negative' })
  @Max(500, { message: 'AQI cannot be above 500' })
  aqi?: number;
}

