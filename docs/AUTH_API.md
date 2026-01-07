# Authentication API Documentation

## Overview
The GBI Backend implements a comprehensive authentication system with:
- **Email/Password** authentication
- **Google OAuth 2.0** social login
- **JWT Access Tokens** (short-lived, 15 minutes)
- **Refresh Tokens** (long-lived, 30 days) with token rotation
- Secure session management

## Architecture

### Token Strategy
1. **Access Token (JWT)**
   - Short-lived (15 minutes by default)
   - Used for API authorization via `Authorization: Bearer <token>` header
   - Contains user ID and email in payload
   - Stateless validation

2. **Refresh Token**
   - Long-lived (30 days by default)
   - Stored securely in database
   - Used to obtain new access tokens
   - Token rotation on refresh (old token revoked, new token issued)
   - Can be revoked for logout

## API Endpoints

### 1. Signup (Email/Password)
**POST** `/auth/signup`

Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "organization": "GBI Corp",
  "phone": "+1234567890",
  "city": "New York"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "phoneVerified": false
  }
}
```

**Validation Rules:**
- Email must be valid format
- Password minimum 8 characters
- Name, organization, phone, city are optional

---

### 2. Login (Email/Password)
**POST** `/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `401 Unauthorized` - Account restricted (user banned by admin)

---

### 3. Google OAuth Login
**GET** `/auth/google`

Initiates Google OAuth flow. Redirects user to Google consent screen.

**Flow:**
1. Frontend redirects user to `/auth/google`
2. User authenticates with Google
3. Google redirects to `/auth/google/callback`
4. Backend processes login and returns tokens

---

### 4. Google OAuth Callback
**GET** `/auth/google/callback`

Google OAuth callback endpoint (handled automatically by Passport).

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b...",
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "John Doe",
    "emailVerified": true,
    "phoneVerified": false
  }
}
```

**Notes:**
- If user exists with same email, links Google account
- If new user, creates account with `emailVerified: true`
- In production, should redirect to frontend with tokens in URL params

---

### 5. Refresh Access Token
**POST** `/auth/refresh`

Get a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-refresh-token-here...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "phoneVerified": false
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Refresh token invalid, expired, or revoked

**Token Rotation:**
- Old refresh token is automatically revoked
- New refresh token is issued
- Enhances security by preventing token reuse

---

### 6. Logout
**POST** `/auth/logout`

Revoke refresh token (logout user from this session).

**Request Body:**
```json
{
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b..."
}
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### 7. Get Current User
**GET** `/auth/me`

Get currently authenticated user details.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "organization": "GBI Corp",
  "phone": "+1234567890",
  "city": "New York",
  "emailVerified": true,
  "phoneVerified": false,
  "isRestricted": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` - No token provided or invalid token
- `401 Unauthorized` - User account restricted

---

## Protected Routes

To protect any route, use the `@UseGuards(JwtAuthGuard)` decorator:

```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
async protectedRoute(@CurrentUser() user: any) {
  return { message: 'This is protected', user };
}
```

The `@CurrentUser()` decorator extracts the authenticated user from the request.

---

## Environment Variables

Required in `.env`:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=15m

# Refresh Token Configuration (days)
REFRESH_TOKEN_EXPIRES_IN=30

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

---

## Security Features

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **Token Rotation**: Refresh tokens rotated on each use
3. **Account Restriction**: Admin can restrict user accounts
4. **Token Expiration**: Short-lived access tokens
5. **Database-backed Sessions**: Refresh tokens stored in DB, can be revoked
6. **Input Validation**: All inputs validated using class-validator
7. **SQL Injection Protection**: Prisma ORM with parameterized queries

---

## Frontend Integration Example

```typescript
// Signup
const signup = async (email: string, password: string) => {
  const response = await fetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  
  // Store tokens securely
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  return data;
};

// Login
const login = async (email: string, password: string) => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  return data;
};

// Make authenticated request
const getProtectedData = async () => {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 401) {
    // Access token expired, refresh it
    await refreshAccessToken();
    // Retry request
    return getProtectedData();
  }
  
  return response.json();
};

// Refresh access token
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  
  const data = await response.json();
  
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
};

// Logout
const logout = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  await fetch('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};
```

---

## Database Schema

### User Table
```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String?
  googleId      String?  @unique
  name          String?
  organization  String?
  phone         String?
  city          String?
  emailVerified Boolean  @default(false)
  phoneVerified Boolean  @default(false)
  isRestricted  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  refreshTokens RefreshToken[]
}
```

### RefreshToken Table
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<your-refresh-token>"
  }'
```

---

## Next Steps

1. **Email OTP Verification**: Implement OTP service for email verification
2. **Mobile OTP Verification**: Implement SMS service for phone verification
3. **Password Reset**: Add forgot password flow
4. **Admin Authentication**: Separate admin login with hardcoded credentials
5. **Rate Limiting**: Add rate limiting to prevent brute force attacks
