import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
