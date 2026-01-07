import { AuthService } from 'src/auth/auth.service';
import { UsersRepository } from './users.repository';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organization: user.organization,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.usersRepo.updateProfile(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    return this.authService.changePassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  async verifyEmail(userId: string, _code: string) {
    // OTP verification is mocked for now
    // Email is already marked verified by default
    await this.usersRepo.markEmailAsVerified(userId);

    return { success: true };
  }

  async verifyPhone(userId: string, _code: string) {
    // OTP verification is mocked for now
    // Email is already marked verified by default
    await this.usersRepo.markPhoneAsVerified(userId);

    return { success: true };
  }
}
