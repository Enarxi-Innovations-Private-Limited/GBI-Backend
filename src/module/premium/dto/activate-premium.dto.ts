import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ActivatePremiumDto {
  @IsUUID()
  userId: string;

  @IsDateString()
  activationDate: string;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
