import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards';
import { ReadonlyGuard } from 'src/auth/guards/readonly.guard';
import { ReadonlyBlocked } from 'src/auth/decorators/readonly.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('change-password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('request-email-verification')
  requestEmailVerification(@CurrentUser('id') userId: string) {
    return this.usersService.requestEmailVerification(userId);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('verify-email')
  verifyEmail(@CurrentUser('id') userId: string, @Body() dto: VerifyEmailDto) {
    return this.usersService.verifyEmail(userId, dto.code);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('request-phone-verification')
  requestPhoneVerification(@CurrentUser('id') userId: string) {
    return this.usersService.requestPhoneVerification(userId);
  }

  @UseGuards(ReadonlyGuard)
  @ReadonlyBlocked()
  @Post('verify-phone')
  verifyPhone(@CurrentUser('id') userId: string, @Body() dto: VerifyPhoneDto) {
    return this.usersService.verifyPhone(userId, dto.code);
  }
}
