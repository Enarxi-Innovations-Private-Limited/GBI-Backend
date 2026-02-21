import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteProfileDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  organization: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  // SMS OTP validation removed for now, but keeping the field optional in DTO
  // in case the frontend still sends it or for future re-integration without breaking changes.
  @IsOptional()
  @IsString()
  otp?: string;
}

// RequestPhoneOtpDto is kept for backward compatibility if the frontend still calls it,
// though the service method will be simplified.
export class RequestPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
