import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RenewPremiumDto {
  @IsUUID()
  userId: string;

  @IsDateString()
  newExpiryDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
