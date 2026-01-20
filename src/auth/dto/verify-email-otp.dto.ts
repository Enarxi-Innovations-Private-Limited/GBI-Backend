import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}
