import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  durationDays: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
