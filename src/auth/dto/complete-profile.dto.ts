import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  organization?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Please enter a valid 10-digit Indian mobile number',
  })
  phone: string;

  // SMS OTP validation removed for now, but keeping the field optional in DTO
  // in case the frontend still sends it or for future re-integration without breaking changes.
  @IsOptional()
  @IsString()
  otp?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

// RequestPhoneOtpDto is kept for backward compatibility if the frontend still calls it,
// though the service method will be simplified.
export class RequestPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Please enter a valid 10-digit Indian mobile number',
  })
  phone: string;
}
