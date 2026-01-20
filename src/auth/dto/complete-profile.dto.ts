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

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class RequestPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  phone: string;
}
