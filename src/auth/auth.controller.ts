import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  SignupDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RequestPhoneOtpDto,
  CompleteProfileDto,
  VerifyEmailOtpDto,
} from './dto';
import { GoogleAuthGuard, JwtAuthGuard } from './guards';
import { CurrentUser } from './decorators';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/signup
   * Register new user with email and password
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour per IP
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  /**
   * POST /auth/login
   * Login with email and password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * GET /auth/google
   * Initiate Google OAuth flow
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard redirects to Google
  }

  /**
   * GET /auth/google/callback
   * Google OAuth callback
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    try {
      // Process Google login
      const result = await this.authService.googleLogin(req.user);

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Encode data to safe query params
      const accessToken = encodeURIComponent(result.accessToken);
      const refreshToken = encodeURIComponent(result.refreshToken);
      const user = encodeURIComponent(JSON.stringify(result.user));

      const callbackUrl = `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}&user=${user}`;

      // Fastify redirect: reply.redirect(url) or reply.code(302).redirect(url)
      // The error "Called reply with an invalid status code: http..." suggests the arguments were swapped or misunderstood by the underlying framework.
      // Let's preserve the standard Fastify signature: code, url
      return res.status(302).redirect(callbackUrl);
    } catch (error) {
      console.error('Google OAuth Error:', error);
      return res
        .status(500)
        .send({ message: 'Authentication failed', error: error.message });
    }
  }

  /**
   * POST /auth/refresh
   * Get new access token using refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  /**
   * POST /auth/forgot-password
   * Request password reset OTP
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour per IP
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  /**
   * POST /auth/reset-password
   * Reset password with OTP
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  /**
   * POST /auth/request-phone-otp
   * Request OTP for phone verification
   */
  @Post('request-phone-otp')
  @HttpCode(HttpStatus.OK)
  async requestPhoneOtp(@Body() requestPhoneOtpDto: RequestPhoneOtpDto) {
    return this.authService.requestPhoneOtp(requestPhoneOtpDto);
  }

  /**
   * POST /auth/complete-profile
   * Complete user profile with phone verification
   */
  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  async completeProfile(@Body() completeProfileDto: CompleteProfileDto) {
    return this.authService.completeProfile(completeProfileDto);
  }

  /**
   * POST /auth/verify-email-otp
   * Verify email OTP and login
   */
  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(@Body() verifyEmailOtpDto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(verifyEmailOtpDto);
  }

  /**
   * POST /auth/logout
   * Logout user (revoke refresh token)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
