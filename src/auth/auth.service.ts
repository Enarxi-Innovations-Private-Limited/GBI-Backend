import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import {
  SignupDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  CompleteProfileDto,
  RequestPhoneOtpDto,
  VerifyEmailOtpDto,
} from './dto';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    organization?: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    isProfileComplete: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Register a new user with email and password
   */
  async signup(
    signupDto: SignupDto,
  ): Promise<{ message: string; email: string }> {
    let { email, password, name, organization, phone, city } = signupDto;

    // Normalize identifiers
    email = email.trim().toLowerCase();
    if (phone) phone = phone.trim().replace(/[^\d+]/g, '');

    // 1. Fail-fast lock check
    await this.checkLockout(email);

    // 2. Account level rate limit (Signup: max 3 per hour)
    await this.checkAccountRateLimit('signup_attempts', email, 3, 3600);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    // NOTE: Auto-verifying email and phone since we're using mock providers
    // When real email/SMS providers are integrated, set these to false
    // and implement proper OTP verification flow
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        organization,
        phone,
        city,
        emailVerified: false, // Default: false (User must verify)
        phoneVerified: false, // Default: false (User must verify)
      },
    });

    // Generate EMAIL OTP
    const otp = randomInt(100000, 999999).toString();
    await this.redis.set(`email_otp:${email}`, otp, 'EX', 600);
    console.log(`[AUTH] Email Verification OTP for ${email}: ${otp}`);

    return {
      message: 'User registered successfully. Please verify your email.',
      email: user.email,
    };
  }

  /**
   * Verify Email OTP and Login
   */
  async verifyEmailOtp(
    verifyEmailOtpDto: VerifyEmailOtpDto,
  ): Promise<AuthResponse> {
    let { email, otp } = verifyEmailOtpDto;

    // Normalize identifiers
    email = email.trim().toLowerCase();

    // 1. Fail-fast lock check
    await this.checkLockout(email);

    // 2. Verify OTP
    const storedOtp = await this.redis.get(`email_otp:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      await this.recordFailure(email);
      throw new BadRequestException('Invalid or expired Email OTP');
    }

    // On Success: Clear failure counters
    await this.clearFailures(email);

    // Find User
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Mark email as verified
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Delete OTP
    await this.redis.del(`email_otp:${email}`);

    // Generate tokens
    const tokens = await this.generateTokens(updatedUser.id, updatedUser.email);

    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        isProfileComplete: updatedUser.isProfileComplete,
      },
    };
  }

  /**
   * Login user with email and password
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    let { email, password } = loginDto;

    // Normalize
    email = email.trim().toLowerCase();

    // 1. Fail-fast lock check
    await this.checkLockout(email);

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      await this.recordFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is restricted
    if (user.isRestricted) {
      throw new UnauthorizedException(
        'Your account has been restricted. Please contact support.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.recordFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      await this.clearFailures(email); // Successful identity verification, clear failures

      // Generate EMAIL OTP
      const otp = randomInt(100000, 999999).toString();
      await this.redis.set(`email_otp:${email}`, otp, 'EX', 600);
      console.log(
        `[AUTH] Email Verification OTP for ${email} (Login Attempt): ${otp}`,
      );

      throw new ConflictException('Email not verified. OTP sent.'); // Using Conflict (409) or Forbidden (403) to distinguish
    }

    // On Success: Clear failure counters
    await this.clearFailures(email);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );

    if (!isOldPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Request password reset OTP
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    let { email } = forgotPasswordDto;

    // Normalize
    email = email.trim().toLowerCase();

    // 1. Fail-fast lock check
    await this.checkLockout(email);

    // 2. Account level rate limit (Forgot PW: max 3 per hour)
    await this.checkAccountRateLimit('forgot_pw', email, 3, 3600);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal user existence
      return { message: 'If email exists, an OTP has been sent.' };
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();

    // Store in Redis (expires in 10 minutes)
    await this.redis.set(`reset_otp:${email}`, otp, 'EX', 600);

    // TODO: Send via Email/SMS Provider
    // For now, log to console
    console.log(`[AUTH] Password Reset OTP for ${email}: ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    let { email, otp, newPassword } = resetPasswordDto;

    // Normalize
    email = email.trim().toLowerCase();

    // 1. Fail-fast lock check
    await this.checkLockout(email);

    // Verify OTP
    const storedOtp = await this.redis.get(`reset_otp:${email}`);

    if (!storedOtp || storedOtp !== otp) {
      await this.recordFailure(email);
      throw new BadRequestException('Invalid or expired OTP');
    }

    // On Success: Clear failures
    await this.clearFailures(email);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await this.prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // Delete OTP
    await this.redis.del(`reset_otp:${email}`);

    // Revoke all sessions for security
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Password reset successfully' };
  }

  /**
   * Request OTP for Phone Verification
   */
  async requestPhoneOtp(
    requestPhoneOtpDto: RequestPhoneOtpDto,
  ): Promise<{ message: string; isOtpRequired: boolean }> {
    let { phone } = requestPhoneOtpDto;

    // Normalize
    if (phone) phone = phone.trim().replace(/[^\d+]/g, '');

    // Skip OTP generation if verification is not required
    if (this.configService.get('REQUIRE_PHONE_VERIFICATION') !== 'true') {
      return {
        message: 'OTP verification disabled by server.',
        isOtpRequired: false,
      }; // Mock success with flag to bypass frontend screen
    }

    // 1. Fail-fast lock check
    await this.checkLockout(phone);

    // 2. Account level rate limit (OTP Requests: max 3 per 15 minutes)
    await this.checkAccountRateLimit('otp_requests', phone, 3, 900);

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();

    // Store in Redis (expires in 5 minutes)
    await this.redis.set(`phone_otp:${phone}`, otp, 'EX', 300);

    // TODO: Send via SMS Provider
    // For now, log to console
    console.log(`[AUTH] Phone Verification OTP for ${phone}: ${otp}`);

    return {
      message: 'OTP sent to mobile number',
      isOtpRequired: true,
    };
  }

  /**
   * Complete Profile with Phone Verification
   */
  async completeProfile(
    completeProfileDto: CompleteProfileDto,
  ): Promise<AuthResponse> {
    let { email, name, organization, city, phone, otp, password } = completeProfileDto;

    // Normalize
    email = email.trim().toLowerCase();
    if (phone) phone = phone.trim().replace(/[^\d+]/g, '');

    const requirePhoneVerif =
      this.configService.get('REQUIRE_PHONE_VERIFICATION') === 'true';

    // 1. Fail-fast lock check
    if (requirePhoneVerif && phone) {
      await this.checkLockout(phone);
    } else {
      await this.checkLockout(email);
    }

    // 2. Verify Phone OTP (Only if required)
    if (requirePhoneVerif) {
      if (!otp) {
        throw new BadRequestException(
          'OTP is required for phone verification.',
        );
      }
      const storedOtp = await this.redis.get(`phone_otp:${phone}`);
      if (!storedOtp || storedOtp !== otp) {
        if (phone) await this.recordFailure(phone);
        throw new BadRequestException('Invalid or expired Phone OTP');
      }

      // On Success: Clear failures
      if (phone) await this.clearFailures(phone);
    }

    // 2. Find User
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 3. Hash password if provided (first-time setup or update)
    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    // 4. Update User Profile
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        organization,
        city,
        phone,
        ...(passwordHash && { passwordHash }),
        phoneVerified: requirePhoneVerif ? true : false,
        isProfileComplete: true,
      },
    });

    // 4. Delete OTP (Only if generated)
    if (requirePhoneVerif) {
      await this.redis.del(`phone_otp:${phone}`);
    }

    // 5. Generate New Tokens (refresh claims)
    const tokens = await this.generateTokens(updatedUser.id, updatedUser.email);

    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        organization: updatedUser.organization,
        emailVerified: updatedUser.emailVerified,
        phoneVerified: updatedUser.phoneVerified,
        isProfileComplete: updatedUser.isProfileComplete,
      },
    };
  }

  /**
   * Google OAuth login/signup
   */
  async googleLogin(profile: any): Promise<AuthResponse> {
    const { id: googleId, emails, displayName, _json } = profile;
    const email = emails[0].value;
    // Extract organization from Hosted Domain (hd) only.
    // We do NOT default to email domain (like gmail.com) as that is not a real organization.
    const organization = _json?.hd;

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update googleId if not set, and ensure organization is set if missing
      const updateData: any = { emailVerified: true };
      if (!user.googleId) updateData.googleId = googleId;
      if (!user.organization && organization)
        updateData.organization = organization;

      // Perform update if we have new data
      if (Object.keys(updateData).length > 1 || updateData.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }

      // Check if user is restricted
      if (user.isRestricted) {
        throw new UnauthorizedException(
          'Your account has been restricted. Please contact support.',
        );
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          name: displayName,
          organization: organization, // Save organization on create
          emailVerified: true, // Google accounts are email verified
          phoneVerified: false,
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organization: user.organization, // Return organization
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        isProfileComplete: user.isProfileComplete,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Find refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Check if user is restricted
    if (storedToken.user.isRestricted) {
      throw new UnauthorizedException(
        'Your account has been restricted. Please contact support.',
      );
    }

    // Revoke old refresh token (token rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
    );

    return {
      ...tokens,
      user: {
        id: storedToken.user.id,
        email: storedToken.user.email,
        name: storedToken.user.name,
        emailVerified: storedToken.user.emailVerified,
        phoneVerified: storedToken.user.phoneVerified,
        isProfileComplete: storedToken.user.isProfileComplete,
      },
    };
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        organization: true,
        phone: true,
        city: true,
        emailVerified: true,
        phoneVerified: true,
        isRestricted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isRestricted) {
      throw new UnauthorizedException(
        'Your account has been restricted. Please contact support.',
      );
    }

    return user;
  }

  /**
   * Generate access token and refresh token
   */
  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, email };

    // Generate access token (short-lived)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    // Generate refresh token (long-lived, random string)
    const refreshToken = randomBytes(64).toString('hex');

    // Calculate expiration date (default 30 days)
    const refreshTokenExpiresIn =
      this.configService.get('REFRESH_TOKEN_EXPIRES_IN') || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(refreshTokenExpiresIn));

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Clean up expired refresh tokens (should be called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * Fail-fast check for account lockout
   */
  private async checkLockout(identifier: string) {
    const isLocked = await this.redis.exists(`lockout:${identifier}`);
    if (isLocked) {
      throw new HttpException(
        'Account temporarily locked due to multiple failed attempts.',
        423,
      );
    }
  }

  /**
   * Record a failed authentication or OTP attempt
   */
  private async recordFailure(identifier: string) {
    const key = `otp_failures:${identifier}`;
    const failures = await this.redis.incr(key);
    if (failures === 1) {
      await this.redis.expire(key, 900); // 15 mins
    }
    if (failures >= 5) {
      // Set lockout first to prevent race conditions during concurrent hits
      await this.redis.set(`lockout:${identifier}`, 'true', 'EX', 900);
      await this.redis.del(key);
    }
  }

  /**
   * Clear failures and lockouts on successful authentication
   */
  private async clearFailures(identifier: string) {
    await this.redis.del(`otp_failures:${identifier}`);
    await this.redis.del(`lockout:${identifier}`);
  }

  /**
   * Account-level rate limiting using fixed window
   */
  private async checkAccountRateLimit(
    prefix: string,
    identifier: string,
    limit: number,
    ttlSeconds: number,
  ) {
    const key = `${prefix}:${identifier}`;
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    if (current > limit) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        429,
      );
    }
  }
}
