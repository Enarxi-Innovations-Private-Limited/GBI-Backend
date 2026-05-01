import { IsEmail, IsNotEmpty } from 'class-validator';

export class AdminForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
