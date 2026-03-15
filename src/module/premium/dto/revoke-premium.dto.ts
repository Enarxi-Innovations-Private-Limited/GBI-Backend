import { IsString, IsUUID } from 'class-validator';

export class RevokePremiumDto {
  @IsUUID()
  userId: string;

  @IsString()
  reason: string;
}
