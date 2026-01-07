# Authentication Testing Guide

## 📚 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Testing with cURL](#testing-with-curl)
4. [Testing with Postman](#testing-with-postman)
5. [Testing with REST Client (VS Code)](#testing-with-rest-client-vs-code)
6. [Automated Testing](#automated-testing)
7. [Common Test Scenarios](#common-test-scenarios)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Server Running

Ensure the backend is running:

```bash
pnpm run start:dev
```

**Expected Output:**
```
[Nest] Starting Nest application...
[Nest] PrismaModule dependencies initialized
[Nest] AuthModule dependencies initialized
[Nest] Application successfully started
[Nest] Server running on http://localhost:4000
```

### 2. Database Connected

Check server logs for:
```
[PrismaService] ✅ Successfully connected to database
```

### 3. Base URL

```
http://localhost:4000/auth
```

---

## Test Environment Setup

### Environment Variables

Ensure `.env` has:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/gbi_dashboard"
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN=30
```

### Test User Data

Create a test user for consistent testing:

```json
{
  "email": "test@example.com",
  "password": "test password123",
  "name": "Test User",
  "phone": "+1234567890",
  "organization": "Test Org",
  "city": "Test City"
}
```

---

## Testing with cURL

### 1. Signup (Create New User)

**Request:**
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepass123",
    "name": "New User",
    "phone": "+1234567890",
    "organization": "My Company",
    "city": "New York"
  }'
```

**Expected Response (201 Created):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZjNhNGI2Yy0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6Im5ld3VzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDA2ODEwMH0.example-signature",
  "refreshToken": "3f5a8c9d2e1b4f7a6e9c8d7b5a4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e",
  "user": {
    "id": "8f3a4b6c-1234-5678-90ab-cdef12345678",
    "email": "newuser@example.com",
    "name": "New User",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

**Error Responses:**

**409 Conflict (Email Exists):**
```json
{
  "statusCode": 409,
  "message": "User with this email already exists",
  "error": "Conflict"
}
```

**400 Bad Request (Invalid Email):**
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email"
  ],
  "error": "Bad Request"
}
```

**400 Bad Request (Short Password):**
```json
{
  "statusCode": 400,
  "message": [
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request"
}
```

### 2. Login (Existing User)

**Request:**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepass123"
  }'
```

**Expected Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-refresh-token-here...",
  "user": {
    "id": "8f3a4b6c-1234-5678-90ab-cdef12345678",
    "email": "newuser@example.com",
    "name": "New User",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

**Error Responses:**

**401 Unauthorized (Wrong Password):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**401 Unauthorized (Email Not Found):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**401 Unauthorized (Account Restricted):**
```json
{
  "statusCode": 401,
  "message": "Your account has been restricted. Please contact support.",
  "error": "Unauthorized"
}
```

### 3. Get Current User (Protected Route)

**Request:**
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Replace `YOUR_ACCESS_TOKEN_HERE` with the actual token from signup/login response.**

**Expected Response (200 OK):**
```json
{
  "id": "8f3a4b6c-1234-5678-90ab-cdef12345678",
  "email": "newuser@example.com",
  "name": "New User",
  "organization": "My Company",
  "phone": "+1234567890",
  "city": "New York",
  "emailVerified": true,
  "phoneVerified": true,
  "isRestricted": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**

**401 Unauthorized (No Token):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**401 Unauthorized (Invalid Token):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**401 Unauthorized (Expired Token):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 4. Refresh Access Token

**Request:**
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'
```

**Expected Response (200 OK):**
```json
{
  "accessToken": "new-access-token...",
  "refreshToken": "new-refresh-token...",
  "user": {
    "id": "8f3a4b6c-1234-5678-90ab-cdef12345678",
    "email": "newuser@example.com",
    "name": "New User",
    "emailVerified": true,
    "phoneVerified": true
  }
}
```

**Important:** 
- Old refresh token is now REVOKED
- You must use the NEW refresh token for future requests
- Old refresh token will return 401 if used again

**Error Responses:**

**401 Unauthorized (Invalid Token):**
```json
{
  "statusCode": 401,
  "message": "Invalid refresh token",
  "error": "Unauthorized"
}
```

**401 Unauthorized (Token Already Used):**
```json
{
  "statusCode": 401,
  "message": "Refresh token has been revoked",
  "error": "Unauthorized"
}
```

**401 Unauthorized (Expired Token):**
```json
{
  "statusCode": 401,
  "message": "Refresh token has expired",
  "error": "Unauthorized"
}
```

### 5. Logout

**Request:**
```bash
curl -X POST http://localhost:4000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'
```

**Expected Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**After Logout:**
- Refresh token is revoked
- Access token still valid until expiration (15 min)
- User should discard both tokens on client side

### 6. Google OAuth (Manual Testing)

**Step 1: Initiate OAuth Flow**

Open in browser:
```
http://localhost:4000/auth/google
```

**Step 2: Authenticate with Google**
- Select Google account
- Grant permissions

**Step 3: Callback**
Redirects to:
```
http://localhost:4000/auth/google/callback
```

Returns JSON with tokens:
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { ... }
}
```

---

## Testing with Postman

### Setup

1. **Create New Collection:** "GBI Auth Tests"
2. **Set Base URL Variable:**
   - Variable: `base_url`
   - Value: `http://localhost:4000`

### Collection Structure

```
GBI Auth Tests/
├── 1. Signup
├── 2. Login
├── 3. Get Current User
├── 4. Refresh Token
├── 5. Logout
└── 6. Google OAuth
```

### Example Request: Signup

**Method:** POST
**URL:** `{{base_url}}/auth/signup`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "postman@example.com",
  "password": "test123456",
  "name": "Postman User"
}
```

**Tests Tab:**
```javascript
// Save tokens to environment
const response = pm.response.json();

if (response.accessToken) {
    pm.environment.set("access_token", response.accessToken);
    pm.environment.set("refresh_token", response.refreshToken);
    pm.environment.set("user_id", response.user.id);
}

// Verify response
pm.test("Status is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Returns access token", function () {
    pm.expect(response.accessToken).to.be.a('string');
});

pm.test("User email verified", function () {
    pm.expect(response.user.emailVerified).to.equal(true);
});
```

### Example Request: Get Current User

**Method:** GET
**URL:** `{{base_url}}/auth/me`

**Headers:**
```
Authorization: Bearer {{access_token}}
```

**Tests Tab:**
```javascript
const response = pm.response.json();

pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Returns user data", function () {
    pm.expect(response.email).to.be.a('string');
    pm.expect(response.id).to.equal(pm.environment.get("user_id"));
});
```

### Running Collection

1. Select "GBI Auth Tests"
2. Click "Run"
3. Select all requests
4. Click "Run GBI Auth Tests"

**Expected Output:**
```
✓ 1. Signup - Status is 201
✓ 1. Signup - Returns access token
✓ 2. Login - Status is 200
✓ 3. Get Current User - Status is 200
✓ 4. Refresh Token - Status is 200
✓ 5. Logout - Status is 200
```

---

## Testing with REST Client (VS Code)

### Setup

1. Install "REST Client" extension
2. Create `test.http` file

### test.http

```http
### Variables
@baseUrl = http://localhost:4000
@email = restclient@example.com
@password = test123456

### 1. Signup
POST {{baseUrl}}/auth/signup
Content-Type: application/json

{
  "email": "{{email}}",
  "password": "{{password}}",
  "name": "REST Client User",
  "organization": "Test Org"
}

### Store tokens from response
# Copy accessToken and refreshToken from response above

### 2. Login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "{{email}}",
  "password": "{{password}}"
}

### 3. Get Current User
# Replace YOUR_TOKEN with actual token
GET {{baseUrl}}/auth/me
Authorization: Bearer YOUR_TOKEN

### 4. Refresh Token
# Replace YOUR_REFRESH_TOKEN with actual refresh token
POST {{baseUrl}}/auth/refresh
Content-Type: application/json

{
  "refreshToken": "YOUR_REFRESH_TOKEN"
}

### 5. Logout
POST {{baseUrl}}/auth/logout
Content-Type: application/json

{
  "refreshToken": "YOUR_REFRESH_TOKEN"
}

### 6. Google OAuth (browser only)
# Open in browser:
# http://localhost:4000/auth/google
```

**Usage:**
- Click "Send Request" above each request
- Response appears in split view
- Copy tokens and update variables

---

## Automated Testing

### Unit Tests (Jest)

**File:** `src/auth/auth.service.spec.ts`

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthService, PrismaService, JwtService, ConfigService],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('signup', () => {
    it('should create a new user', async () => {
      const signupDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const result = await service.signup(signupDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(signupDto.email);
    });

    it('should throw ConflictException for duplicate email', async () => {
      const signupDto = {
        email: 'existing@example.com',
        password: 'password123',
      };

      // Create first user
      await service.signup(signupDto);

      // Try to create duplicate
      await expect(service.signup(signupDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login existing user', async () => {
      // Create user first
      await service.signup({
        email: 'login@example.com',
        password: 'password123',
      });

      // Login
      const result = await service.login({
        email: 'login@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      await service.signup({
        email: 'wrong@example.com',
        password: 'correctpass',
      });

      await expect(
        service.login({
          email: 'wrong@example.com',
          password: 'wrongpass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

**Run Tests:**
```bash
pnpm test auth.service.spec.ts
```

### E2E Tests

**File:** `test/auth.e2e-spec.ts`

```typescript
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/signup (POST)', () => {
    it('should create new user', () => {
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'e2e-test@example.com',
          password: 'test123456',
          name: 'E2E User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'test123456',
      };

      // First signup
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send(userData)
        .expect(201);

      // Duplicate signup
      return request(app.getHttpServer())
        .post('/auth/signup')
        .send(userData)
        .expect(409);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', async () => {
      // Create user
      const email = 'login-test@example.com';
      const password = 'test123456';

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email, password });

      // Login
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
        });
    });
  });

  describe('/auth/me (GET)', () => {
    it('should return user with valid token', async () => {
      // Signup and get token
      const signupRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'me-test@example.com',
          password: 'test123456',
        });

      const token = signupRes.body.accessToken;

      // Get current user
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('me-test@example.com');
        });
    });

    it('should reject without token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });
});
```

**Run E2E Tests:**
```bash
pnpm test:e2e
```

---

## Common Test Scenarios

### Scenario 1: Complete User Journey

```bash
# 1. Signup
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"journey@example.com","password":"test123456"}'

# Copy accessToken and refreshToken from response

# 2. Access Protected Resource
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 3. Wait 16 minutes (access token expires)

# 4. Try Protected Resource Again (should fail)
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer EXPIRED_ACCESS_TOKEN"
# Returns 401 Unauthorized

# 5. Refresh Access Token
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"REFRESH_TOKEN"}'

# Copy new accessToken and refreshToken

# 6. Access Protected Resource (should work)
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer NEW_ACCESS_TOKEN"

# 7. Logout
curl -X POST http://localhost:4000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"NEW_REFRESH_TOKEN"}'
```

### Scenario 2: Token Rotation Security

```bash
# 1. Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Copy refreshToken

# 2. Refresh (first time - should work)
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"OLD_TOKEN"}'

# 3. Try using OLD token again (should fail)
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"OLD_TOKEN"}'
# Returns 401: Token has been revoked
```

### Scenario 3: Account Restriction

```bash
# 1. Admin restricts user (via admin API - TODO)
# Sets user.isRestricted = true

# 2. Try to login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"restricted@example.com","password":"password123"}'
# Returns 401: Account restricted

# 3. Try to access with existing token
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer TOKEN"
# Returns 401: Account restricted
```

---

## Troubleshooting

### Issue 1: 401 Unauthorized on /auth/me

**Symptoms:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Possible Causes:**
1. Missing Authorization header
2. Wrong token format
3. Expired token
4. Invalid JWT_SECRET

**Solutions:**

**Check Header Format:**
```bash
# ✅ Correct
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# ❌ Wrong - missing "Bearer"
Authorization: eyJhbGciOiJIUzI1NiIs...

# ❌ Wrong - space in token
Authorization: Bearer eyJhbGci OiJIUzI1NiIs...
```

**Check Token Expiration:**
```bash
# Decode JWT at https://jwt.io
# Check "exp" claim
# If expired, use refresh token
```

**Verify JWT_SECRET:**
```bash
# .env file must match server
JWT_SECRET=same-secret-on-both-sides
```

### Issue 2: 400 Bad Request on Signup

**Symptoms:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

**Solutions:**
- Check email format (must have @)
- Check password length (minimum 8 chars)
- Ensure Content-Type header is set
- Verify JSON is valid

### Issue 3: 409 Conflict on Signup

**Symptoms:**
```json
{
  "statusCode": 409,
  "message": "User with this email already exists"
}
```

**Solutions:**
- Use different email
- Or login with existing email
- Or delete user from database

### Issue 4: Refresh Token Not Working

**Symptoms:**
```json
{
  "statusCode": 401,
  "message": "Invalid refresh token"
}
```

**Possible Causes:**
1. Token already used (rotation)
2. Token expired (30 days)
3. Token revoked (logout)
4. Database connection issue

**Solutions:**
- Get new token via login
- Check database for token record
- Verify REFRESH_TOKEN_EXPIRES_IN setting

### Issue 5: Google OAuth Not Working

**Symptoms:**
- Redirect loop
- "Invalid client ID"
- "Callback URL mismatch"

**Solutions:**

**Check Environment Variables:**
```bash
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
```

**Check Google Console:**
1. Authorized redirect URIs must include callback URL
2. OAuth consent screen configured
3. Client ID/Secret copied correctly

---

## Testing Checklist

### Before Testing
- [ ] Server running
- [ ] Database connected
- [ ] Environment variables set
- [ ] Test user credentials ready

### Signup Tests
- [ ] Valid signup works
- [ ] Duplicate email rejected
- [ ] Invalid email rejected
- [ ] Short password rejected
- [ ] Returns access & refresh tokens
- [ ] User auto-verified (mock)

### Login Tests
- [ ] Valid credentials work
- [ ] Wrong password rejected
- [ ] Non-existent email rejected
- [ ] Restricted account rejected
- [ ] Returns access & refresh tokens

### Protected Route Tests
- [ ] Valid token grants access
- [ ] Missing token rejected
- [ ] Invalid token rejected
- [ ] Expired token rejected
- [ ] Returns user data

### Token Refresh Tests
- [ ] Valid refresh token works
- [ ] Returns new tokens
- [ ] Old token revoked
- [ ] Reusing old token fails
- [ ] Expired refresh token rejected

### Logout Tests
- [ ] Logout revokes token
- [ ] Using revoked token fails

### Google OAuth Tests
- [ ] OAuth flow redirects to Google
- [ ] Callback receives tokens
- [ ] New users created
- [ ] Existing users linked
- [ ] Email auto-verified

---

## Summary

### Testing Tools
1. **cURL** - Quick command-line tests
2. **Postman** - Interactive testing with collections
3. **REST Client** - VS Code extension
4. **Jest** - Unit tests
5. **Supertest** - E2E tests

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /auth/signup | Create account |
| POST | /auth/login | Get tokens |
| GET | /auth/me | Get user info |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Revoke token |
| GET | /auth/google | Start OAuth |
| GET | /auth/google/callback | OAuth callback |

### Token Lifetimes
- Access Token: **15 minutes**
- Refresh Token: **30 days**

### HTTP Status Codes
- `200 OK` - Success
- `201 Created` - User created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Auth error
- `409 Conflict` - Duplicate email

---

**You now have everything needed to test the authentication system!** 🎉

For implementation details, see:
- `docs/auth/` - Authentication architecture
- `docs/prisma/` - Database interaction
