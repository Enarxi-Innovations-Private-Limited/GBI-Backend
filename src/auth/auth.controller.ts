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
  UnauthorizedException,
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
  RequestEmailOtpDto,
  ChangePasswordDto,
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
   * Login with email and password — sets HttpOnly cookies
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.login(loginDto);
    const isProduction = process.env.NODE_ENV === 'production';

    // Set tokens as HttpOnly cookies
    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { user: result.user };
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
   * Google OAuth callback — sets tokens as HttpOnly cookies, NOT in URL params
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    try {
      // Process Google login
      const result = await this.authService.googleLogin(req.user);

      const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
        .split(',')
        .map((url) => url.trim());
      
      const isProduction = process.env.NODE_ENV === 'production';
      const frontendUrl = isProduction
        ? frontendUrls.find((url) => url.includes('gbiair.in')) ||
          frontendUrls[0]
        : frontendUrls[0];

      // Set tokens as HttpOnly cookies — JS cannot access these
      res.setCookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax', // 'lax' needed for OAuth redirect flow
        path: '/',
        maxAge: 15 * 60, // 15 minutes (seconds)
      });

      res.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/api/auth', // Scoped to auth endpoints only
        maxAge: 30 * 24 * 60 * 60, // 30 days (seconds)
      });

      // Redirect to frontend without sensitive data in URL
      const callbackUrl = `${frontendUrl}/auth/callback`;

      return res.status(302).redirect(callbackUrl);
    } catch (error) {
      console.error('Google OAuth Error:', error);
      const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
        .split(',')
        .map((url) => url.trim());
      
      const isProduction = process.env.NODE_ENV === 'production';
      const frontendUrl = isProduction
        ? frontendUrls.find((url) => url.includes('gbiair.in')) ||
          frontendUrls[0]
        : frontendUrls[0];
      return res
        .status(302)
        .redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
  }

  /**
   * POST /auth/refresh-token
   * Get new access token — reads refreshToken from HttpOnly cookie first, body as fallback
   */
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() refreshTokenDto: RefreshTokenDto,
  ) {
    // Read refresh token from HttpOnly cookie first, fallback to body
    const refreshToken =
      req.cookies?.refreshToken || refreshTokenDto?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshTokens(refreshToken);
    const isProduction = process.env.NODE_ENV === 'production';

    // Set new tokens as HttpOnly cookies
    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { user: result.user };
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
   * POST /auth/change-password
   * Change current password (requires valid session)
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.changePassword(
      user.id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );

    // Clear HttpOnly cookies to force re-login with new credentials
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });

    return result;
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
   * POST /auth/request-email-otp
   * Request OTP for email verification
   */
  @Post('request-email-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
  async requestEmailOtp(@Body() requestEmailOtpDto: RequestEmailOtpDto) {
    return this.authService.requestEmailOtp(requestEmailOtpDto);
  }

  /**
   * POST /auth/complete-profile
   * Complete user profile with phone verification
   */
  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async completeProfile(
    @CurrentUser() user: any,
    @Body() completeProfileDto: CompleteProfileDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.completeProfile(
      completeProfileDto,
      user.email,
    );
    const isProduction = process.env.NODE_ENV === 'production';

    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { user: result.user };
  }

  /**
   * POST /auth/verify-email-otp
   * Verify email OTP and login
   */
  @Post('verify-email-otp')
  @HttpCode(HttpStatus.OK)
  async verifyEmailOtp(
    @Body() verifyEmailOtpDto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.authService.verifyEmailOtp(verifyEmailOtpDto);
    const isProduction = process.env.NODE_ENV === 'production';

    res.setCookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60,
    });

    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { user: result.user };
  }

  /**
   * POST /auth/logout
   * Logout user — revokes refresh token and clears HttpOnly cookies
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Body() refreshTokenDto: RefreshTokenDto,
  ) {
    const refreshToken =
      req.cookies?.refreshToken || refreshTokenDto?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear HttpOnly cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/api/auth' });

    return { message: 'Logged out successfully' };
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
