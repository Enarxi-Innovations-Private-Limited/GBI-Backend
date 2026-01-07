# Authentication Implementation Guide

## 📚 Table of Contents
1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Folder Structure](#folder-structure)
4. [DTOs (Data Transfer Objects)](#dtos-data-transfer-objects)
5. [Services](#services)
6. [Strategies](#strategies)
7. [Guards](#guards)
8. [Decorators](#decorators)
9. [Controllers](#controllers)
10. [Mock OTP System](#mock-otp-system)
11. [Token Management](#token-management)
12. [Security Features](#security-features)

---

## Overview

Our authentication system implements a **comprehensive, production-ready** solution with:

- ✅ Email/Password authentication
- ✅ Google OAuth 2.0
- ✅ JWT Access Tokens (short-lived)
- ✅ Refresh Tokens (long-lived, database-backed)
- ✅ Token rotation on refresh
- ✅ Mock OTP system (AWS-ready)
- ✅ Account restriction support
- ✅ Type-safe with TypeScript

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Frontend)                    │
└─────────────┬───────────────────────────────────────────┘
              │
      ┌───────▼────────┐
      │  API Endpoint  │  (/auth/signup, /auth/login)
      └───────┬────────┘
              │
      ┌───────▼────────┐
      │  Auth Guard    │  (JWT validation for protected routes)
      └───────┬────────┘
              │
      ┌───────▼────────┐
      │  Controller    │  (Request handling)
      └───────┬────────┘
              │
      ┌───────▼────────┐
      │  Service       │  (Business logic)
      └───────┬────────┘
              │
      ┌───────▼────────┐
      │  Prisma        │  (Database operations)
      └───────┬────────┘
              │
      ┌───────▼────────┐
      │  PostgreSQL    │  (Data storage)
      └────────────────┘
```

---

## Authentication Flow

### 1. Signup Flow

```
User submits signup form
    ↓
Controller receives request
    ↓
DTO validates input (email format, password length, etc.)
    ↓
Service checks if email already exists
    ↓
Password hashed with bcrypt (12 rounds)
    ↓
User created in database
    ↓
Email & Phone auto-verified (Mock OTP)
    ↓
Access Token generated (JWT, 15 min)
    ↓
Refresh Token generated (Random, 30 days)
    ↓
Refresh Token stored in database
    ↓
Both tokens returned to client
```

### 2. Login Flow

```
User submits credentials
    ↓
Controller receives request
    ↓
DTO validates input
    ↓
Service finds user by email
    ↓
Check if user is restricted
    ↓
Verify password with bcrypt.compare()
    ↓
Generate new Access Token
    ↓
Generate new Refresh Token
    ↓
Store Refresh Token in database
    ↓
Return tokens to client
```

### 3. Protected Route Access

```
Client makes request with Authorization header
    ↓
JWT Auth Guard intercepts request
    ↓
Extract token from "Bearer <token>"
    ↓
JWT Strategy validates token
    ↓
Check token signature & expiration
    ↓
Extract user ID from token payload
    ↓
Load user from database
    ↓
Check if user is restricted
    ↓
Attach user to request object
    ↓
Request proceeds to controller
        ↓
@CurrentUser() decorator extracts user
```

### 4. Token Refresh Flow

```
Client sends refresh token
    ↓
Service finds token in database
    ↓
Check if token is revoked
    ↓
Check if token is expired
    ↓
Check if user is restricted
    ↓
Revoke old refresh token (Token Rotation)
    ↓
Generate new access token
    ↓
Generate new refresh token
    ↓
Store new refresh token
    ↓
Return new tokens
```

### 5. Google OAuth Flow

```
User clicks "Login with Google"
    ↓
Frontend redirects to /auth/google
    ↓
Google OAuth Guard initiates OAuth flow
    ↓
User authenticates on Google
    ↓
Google redirects to /auth/google/callback
    ↓
Google Strategy receives profile
    ↓
Service checks if user exists by email
    ↓
If exists: Link Google ID
If not: Create new user with Google data
    ↓
Set emailVerified = true (Google verified)
    ↓
Generate tokens
    ↓
Return tokens
```

---

## Folder Structure

```
src/auth/
├── dto/                          # Data Transfer Objects
│   ├── signup.dto.ts            # Signup validation
│   ├── login.dto.ts             # Login validation
│   ├── refresh-token.dto.ts     # Refresh token validation
│   └── index.ts                 # Barrel export
│
├── guards/                       # Route protection
│   ├── jwt-auth.guard.ts        # JWT validation guard
│   ├── google-auth.guard.ts     # Google OAuth guard
│   └── index.ts
│
├── strategies/                   # Passport strategies
│   ├── jwt.strategy.ts          # JWT token validation
│   ├── google.strategy.ts       # Google OAuth handler
│   └── index.ts
│
├── decorators/                   # Custom decorators
│   ├── current-user.decorator.ts # Extract user from request
│   └── index.ts
│
├── auth.controller.ts            # HTTP endpoints
├── auth.service.ts               # Business logic
└── auth.module.ts                # Module configuration
```

### Dependency Flow

```
AuthModule
  ├── imports: [PrismaModule, PassportModule, JwtModule]
  ├── controllers: [AuthController]
  ├── providers: [AuthService, JwtStrategy, GoogleStrategy]
  └── exports: [AuthService]
```

---

## DTOs (Data Transfer Objects)

DTOs define the **shape and validation rules** for incoming data.

### 1. SignupDto (`dto/signup.dto.ts`)

```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  organization?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;
}
```

**What It Does:**
- Validates email format
- Ensures password is at least 8 characters
- Makes name, organization, phone, city optional
- Automatically transforms types (if enabled)

**Usage in Controller:**
```typescript
@Post('signup')
async signup(@Body() signupDto: SignupDto) {
  // signupDto is validated automatically
  return this.authService.signup(signupDto);
}
```

**Validation Examples:**

✅ **Valid:**
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

❌ **Invalid - Short Password:**
```json
{
  "email": "user@example.com",
  "password": "short"
}
```
Error: `password must be longer than or equal to 8 characters`

❌ **Invalid - Bad Email:**
```json
{
  "email": "not-an-email",
  "password": "securepass123"
}
```
Error: `email must be an email`

### 2. LoginDto (`dto/login.dto.ts`)

```typescript
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

**Purpose:** Validates login credentials

### 3. RefreshTokenDto (`dto/refresh-token.dto.ts`)

```typescript
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
```

**Purpose:** Validates refresh token format

---

## Services

### AuthService (`auth.service.ts`)

The **brain of authentication** - contains all business logic.

#### Key Methods

##### 1. `signup(signupDto: SignupDto)`

```typescript
async signup(signupDto: SignupDto): Promise<AuthResponse> {
  const { email, password, name, organization, phone, city } = signupDto;

  // 1. Check if email exists
  const existingUser = await this.prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new ConflictException('Email already exists');
  }

  // 2. Hash password (bcrypt, 12 rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // 3. Create user
  const user = await this.prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      organization,
      phone,
      city,
      emailVerified: true,  // Auto-verified (mock)
      phoneVerified: true,  // Auto-verified (mock)
    },
  });

  // 4. Generate tokens
  const tokens = await this.generateTokens(user.id, user.email);

  // 5. Return response
  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    },
  };
}
```

**Security Features:**
- Password hashed with bcrypt (12 salt rounds)
- Duplicate email check
- SQL injection protection (Prisma)
- Type-safe operations

##### 2. `login(loginDto: LoginDto)`

```typescript
async login(loginDto: LoginDto): Promise<AuthResponse> {
  const { email, password } = loginDto;

  // 1. Find user
  const user = await this.prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 2. Check if restricted
  if (user.isRestricted) {
    throw new UnauthorizedException('Account restricted');
  }

  // 3. Verify password
  const isPasswordValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  // 4. Generate tokens
  const tokens = await this.generateTokens(user.id, user.email);

  // 5. Return response
  return {
    ...tokens,
    user: { /* ... */ },
  };
}
```

**Security Features:**
- Constant-time password comparison
- Generic error messages (don't reveal if email exists)
- Account restriction check
- No password in response

##### 3. `googleLogin(profile: any)`

```typescript
async googleLogin(profile: any): Promise<AuthResponse> {
  const { id: googleId, emails, displayName } = profile;
  const email = emails[0].value;

  // 1. Find or create user
  let user = await this.prisma.user.findUnique({ where: { email } });

  if (user) {
    // Update Google ID if needed
    if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId, emailVerified: true },
      });
    }
  } else {
    // Create new user
    user = await this.prisma.user.create({
      data: {
        email,
        googleId,
        name: displayName,
        emailVerified: true,  // Google verified
        phoneVerified: false,
      },
    });
  }

  // 2. Check restriction
  if (user.isRestricted) {
    throw new UnauthorizedException('Account restricted');
  }

  // 3. Generate tokens
  return this.generateTokens(user.id, user.email);
}
```

##### 4. `refreshTokens(refreshToken: string)`

```typescript
async refreshTokens(refreshToken: string): Promise<AuthResponse> {
  // 1. Find token in database
  const storedToken = await this.prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  // 2. Check if revoked
  if (storedToken.revokedAt) {
    throw new UnauthorizedException('Token revoked');
  }

  // 3. Check expiration
  if (storedToken.expiresAt < new Date()) {
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
    throw new UnauthorizedException('Token expired');
  }

  // 4. Check user restriction
  if (storedToken.user.isRestricted) {
    throw new UnauthorizedException('Account restricted');
  }

  // 5. TOKEN ROTATION - Revoke old token
  await this.prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  // 6. Generate NEW tokens
  const tokens = await this.generateTokens(
    storedToken.user.id,
    storedToken.user.email
  );

  return {
    ...tokens,
    user: { /* ... */ },
  };
}
```

**Token Rotation Security:**
- Old refresh token immediately revoked
- New refresh token generated
- Prevents token reuse
- Detects token theft

##### 5. `generateTokens(userId, email)`

```typescript
private async generateTokens(
  userId: string,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: JwtPayload = { sub: userId, email };

  // 1. Generate Access Token (JWT)
  const accessToken = this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_SECRET'),
    expiresIn: '15m',
  });

  // 2. Generate Refresh Token (Random)
  const refreshToken = randomBytes(64).toString('hex');

  // 3. Calculate expiration (30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // 4. Store refresh token
  await this.prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}
```

**Why Two Token Types?**

**Access Token (JWT):**
- ✅ Stateless - no database lookup
- ✅ Short-lived - 15 minutes
- ✅ Sent with every request
- ❌ Can't be revoked before expiration

**Refresh Token:**
- ✅ Can be revoked (database-stored)
- ✅ Long-lived - 30 days
- ✅ Only used to get new access tokens
- ✅ Supports token rotation

---

## Strategies

Strategies tell Passport.js **how to authenticate** users.

### 1. JWT Strategy (`strategies/jwt.strategy.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Called AFTER JWT is verified
    // payload = { sub: userId, email, iat, exp }

    // Load user from database
    const user = await this.authService.validateUser(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User attached to request.user
    return user;
  }
}
```

**How It Works:**

1. **Extract Token:**
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                        ↑ This part is extracted
   ```

2. **Verify Signature:**
   - Checks if token was signed with JWT_SECRET
   - Ensures token wasn't tampered with

3. **Check Expiration:**
   - Compares `exp` claim with current time
   - Rejects if expired

4. **Call `validate()`:**
   - Receives decoded payload
   - Loads fresh user data from database
   - Returns user object

5. **Attach to Request:**
   ```typescript
   request.user = returnedUserObject;
   ```

### 2. Google Strategy (`strategies/google.strategy.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // Google verified user
    // profile contains: { id, emails, displayName, photos }
    
    // Pass to controller for processing
    done(null, profile);
  }
}
```

**OAuth Flow:**

1. User clicks "Login with Google"
2. Redirected to Google consent screen
3. User authenticates and approves
4. Google redirects to callback URL
5. Strategy receives profile
6. Profile passed to controller
7. Controller calls `authService.googleLogin()`

---

## Guards

Guards decide **if a request should be handled** by the route handler.

### 1. JWT Auth Guard (`guards/jwt-auth.guard.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Usage:**

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: any) {
  return user;
}
```

**What Happens:**

1. Guard intercepts request
2. Calls JWT Strategy
3. Strategy validates token
4. Strategy loads user
5. User attached to request
6. Request proceeds to handler
7. `@CurrentUser()` decorator extracts user

**If Token Invalid:**
- Guard throws `UnauthorizedException`
- Returns `401 Unauthorized`
- Handler never called

### 2. Google Auth Guard (`guards/google-auth.guard.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
```

**Usage:**

```typescript
@Get('google')
@UseGuards(GoogleAuthGuard)
async googleAuth() {
  // Redirects to Google
}

@Get('google/callback')
@UseGuards(GoogleAuthGuard)
async googleCallback(@Req() req: any) {
  // req.user = Google profile
  return this.authService.googleLogin(req.user);
}
```

---

## Decorators

Custom decorators extract data from the request.

### CurrentUser Decorator (`decorators/current-user.decorator.ts`)

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // If data specified, return that property
    return data ? user?.[data] : user;
  },
);
```

**Usage:**

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
async getMe(@CurrentUser() user: any) {
  // user = full user object
  return user;
}

@Get('email')
@UseGuards(JwtAuthGuard)
async getEmail(@CurrentUser('email') email: string) {
  // email = user.email
  return { email };
}
```

**Why Use Decorator?**

✅ **With Decorator:**
```typescript
async getProfile(@CurrentUser() user: any) {
  return user;
}
```

❌ **Without Decorator:**
```typescript
async getProfile(@Req() req: any) {
  const user = req.user;
  return user;
}
```

Benefits:
- Cleaner code
- Type-safe
- Reusable
- Self-documenting

---

## Controllers

### AuthController (`auth.controller.ts`)

The **HTTP interface** - defines API endpoints.

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Guard handles redirect
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.googleLogin(req.user);
    return res.json(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
```

**Decorators Explained:**

- `@Controller('auth')` → Base path `/auth`
- `@Post('signup')` → POST `/auth/signup`
- `@HttpCode()` → Custom HTTP status code
- `@Body()` → Extract request body
- `@UseGuards()` → Apply authentication guard
- `@CurrentUser()` → Extract authenticated user

---

## Mock OTP System

### Why Mock?

During development, we don't want to:
- Send real emails (costs money)
- Send real SMS (costs money)
- Wait for delivery
- Deal with rate limits

### How It Works

#### NotificationService (`notifications/notification.service.ts`)

```typescript
@Injectable()
export class NotificationService {
  constructor(
    private emailProvider: IEmailProvider,
    private smsProvider: ISmsProvider,
  ) {}

  async sendEmailOTP(params: {
    email: string;
    otp: string;
    name?: string;
  }): Promise<boolean> {
    const result = await this.emailProvider.sendOTP(params);
    return result.success;
  }

  async sendSmsOTP(params: {
    phone: string;
    otp: string;
  }): Promise<boolean> {
    const result = await this.smsProvider.sendOTP(params);
    return result.success;
  }
}
```

#### Mock Email Provider (`notifications/providers/mock-email.provider.ts`)

```typescript
@Injectable()
export class MockEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async sendOTP(params: {
    to: string;
    otp: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log('🔐 [MOCK EMAIL OTP]');
    this.logger.log(`To: ${params.to}`);
    this.logger.log(`OTP: ${params.otp}`);
    this.logger.log('==================');

    return {
      success: true,
      messageId: `mock-email-${Date.now()}`,
    };
  }
}
```

**Console Output:**
```
[MockEmailProvider] 🔐 [MOCK EMAIL OTP]
[MockEmailProvider] To: user@example.com
[MockEmailProvider] OTP: 123456
[MockEmailProvider] ==================
```

#### Auto-Verification

Since we're using mocks, we auto-verify users:

```typescript
const user = await this.prisma.user.create({
  data: {
    email,
    passwordHash,
    emailVerified: true,  // ← Auto-verified for mock
    phoneVerified: true,  // ← Auto-verified for mock
  },
});
```

**When Switching to Real Providers:**

1. Change to `false`:
   ```typescript
   emailVerified: false,
   phoneVerified: false,
   ```

2. Implement OTP flow:
   - Generate random 6-digit code
   - Store in database with expiration
   - Send via real provider
   - Create verify endpoint
   - Check code and mark verified

---

## Token Management

### Access Token (JWT)

**Structure:**
```
Header.Payload.Signature
```

**Decoded Payload:**
```json
{
  "sub": "user-id-uuid",
  "email": "user@example.com",
  "iat": 1704067200,  // Issued at
  "exp": 1704068100   // Expires at
}
```

**Storage (Client):**
- ✅ Memory (most secure for SPA)
- ✅ HttpOnly cookie
 - ❌ localStorage (XSS vulnerable)

**Lifetime:** 15 minutes

### Refresh Token

**Format:** Random 128-character hex string
```
3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b...
```

**Database Record:**
```typescript
{
  id: 'uuid',
  userId: 'user-uuid',
  token: '3f5a8c9d...',
  expiresAt: '2024-02-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  revokedAt: null,  // null = active
}
```

**Storage (Client):**
- ✅ HttpOnly cookie (best)
- ⚠️ localStorage (acceptable for mobile)

**Lifetime:** 30 days

### Token Rotation Flow

```
Client has:
- Access Token (expired)
- Refresh Token (valid)
    ↓
Client → POST /auth/refresh
         Body: { refreshToken: "..." }
    ↓
Server finds token in DB
    ↓
Server validates (not revoked, not expired)
    ↓
Server REVOKES old refresh token
    ↓
Server generates NEW access token
Server generates NEW refresh token
    ↓
Server returns BOTH new tokens
    ↓
Client stores new tokens
Client discards old tokens
```

**Security Benefits:**
1. Limits token lifetime
2. Detects stolen tokens
3. Allows forced logout (revoke all user tokens)

---

## Security Features

### 1. Password Hashing

```typescript
// During signup
const passwordHash = await bcrypt.hash(password, 12);
```

**bcrypt Parameters:**
- `password`: Plain text password
- `12`: Salt rounds (iterations)

**Why 12 rounds?**
- Computational cost ≈ 250ms per hash
- Too low: Easy to brute force
- Too high: Slow user experience
- 12 is OWASP recommended

### 2. Constant-Time Comparison

```typescript
// During login
const isValid = await bcrypt.compare(password, hash);
```

**Why Not `===`?**
- `===` returns immediately on first mismatch
- Timing attack: measure response time to guess password
- `bcrypt.compare()` always takes same time

### 3. Generic Error Messages

❌ **Bad:**
```typescript
if (!user) return 'Email not found';
if (!isValid) return 'Wrong password';
```

✅ **Good:**
```typescript
if (!user || !isValid) {
  throw new UnauthorizedException('Invalid credentials');
}
```

**Why?**
- Don't reveal which field is wrong
- Prevents user enumeration attacks

### 4. Account Restriction

```typescript
if (user.isRestricted) {
  throw new UnauthorizedException('Account restricted');
}
```

**Admin Can:**
- Ban malicious users
- Prevent login
- Revoke all tokens (by checking on each request)

### 5. SQL Injection Protection

Prisma automatically parameterizes queries:

❌ **Vulnerable (raw SQL):**
```sql
SELECT * FROM users WHERE email = '${email}'
```

✅ **Safe (Prisma):**
```typescript
prisma.user.findUnique({ where: { email } })
```

### 6. Input Validation

All DTOs use `class-validator`:
- Email format
- Password length
- Required fields
- Type checking

### 7. Rate Limiting (TODO)

Recommended: Add rate limiting to prevent brute force

---

## Summary

### What We Built

1. ✅ Complete authentication system
2. ✅ Email/Password + Google OAuth
3. ✅ JWT + Refresh tokens
4. ✅ Token rotation security
5. ✅ Mock OTP (AWS-ready)
6. ✅ Type-safe with DTOs
7. ✅ Protected routes with Guards
8. ✅ Clean architecture

### Key Components

- **DTOs**: Input validation
- **Services**: Business logic
- **Strategies**: Authentication methods
- **Guards**: Route protection
- **Decorators**: Clean code
- **Controllers**: HTTP interface

### Security Highlights

- bcrypt hashing (12 rounds)
- Token rotation
- Account restriction
- Generic errors
- SQL injection protection
- Input validation

---

**Next Steps:**
- See `docs/test/auth/` for testing guide
- See `docs/MOCK_NOTIFICATIONS.md` for AWS migration
