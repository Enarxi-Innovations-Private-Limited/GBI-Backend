# Authentication API Documentation

## Overview

The GBI Backend implements a comprehensive and highly secure authentication system featuring:

- **Email/Password** authentication with mandatory Email OTP verification.
- **Google OAuth 2.0** social login.
- **Optional Phone (SMS) OTP** verification for profile completion.
- **Password Reset Flow** via Email OTP.
- **JWT Access Tokens** (short-lived, 15 minutes).
- **Refresh Tokens** (long-lived, 30 days) with token rotation.
- **HttpOnly Cookies** for secure token delivery to browsers.
- **Rate Limiting** to prevent brute-force attacks.
- **Account Lockout & CSRF Protection**.

## Architecture

### Token Strategy & Delivery

1. **Access Token (JWT)**
   - Short-lived (15 mins by default).
   - Delivered in response body AND as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`accessToken`).
   - Used for API authorization via `Authorization: Bearer <token>` header, or automatically sent by browser via cookie.
2. **Refresh Token**
   - Long-lived (30 days by default).
   - Delivered in response body AND as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`refreshToken`), scoped to `/api/auth` path.
   - Rotated on every use (old token revoked, new token issued).

---

## Complete Authentication Flows

### Flow A: Standard Email/Password Registration

1. Frontend calls `POST /auth/signup`. Backend creates an unverified user and automatically emails a 6-digit OTP.
2. Frontend prompts user for the OTP sent to their email.
3. Frontend calls `POST /auth/request-email-otp` to **resend** the OTP if needed.
4. Frontend calls `POST /auth/verify-email-otp`. If successful, backend returns the `user` object and sets HttpOnly cookies.

### Flow B: Standard Email/Password Login

1. Frontend calls `POST /auth/login`.
2. If email is verified: Backend returns the `user` object and sets HttpOnly cookies.
3. If email is **NOT** verified: Backend returns `409 Conflict`. No OTP is automatically sent.
4. Frontend prompts user that verification is required and calls `POST /auth/request-email-otp` to generate an OTP.
5. Frontend calls `POST /auth/verify-email-otp` with the OTP.

### Flow C: Google OAuth

1. Frontend redirects user to `GET /auth/google`.
2. User authenticates on Google.
3. Google redirects back to `GET /auth/google/callback`.
4. Backend sets HttpOnly session cookies, and redirects back to the Frontend (e.g. `http://localhost:3000/auth/callback`) without exposing tokens or user data in the URL.
5. Frontend calls `GET /auth/me` to fetch the current user session securely.

### Flow D: Profile Completion & Optional Phone Verification

If `REQUIRE_PHONE_VERIFICATION=true` in backend `.env`:

1. Frontend calls `POST /auth/request-phone-otp` to get a 6-digit SMS OTP.
2. Frontend calls `POST /auth/complete-profile` with the received OTP.
   If `REQUIRE_PHONE_VERIFICATION=false`:
3. Frontend calls `POST /auth/request-phone-otp`. Backend responds with `{ isOtpRequired: false }`.
4. Frontend skips OTP input and directly calls `POST /auth/complete-profile` without the OTP.

---

## API Endpoints

### 1. Signup (Email/Password)

**POST** `/auth/signup`

Registers a new user (with `emailVerified: false`). Automatically triggers an email with a 6-digit verification code.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201):**

```json
{
  "message": "User registered successfully. Please verify your email with the OTP sent.",
  "email": "user@example.com"
}
```

---

### 2. Request Email OTP

**POST** `/auth/request-email-otp`

Triggers an email with a 6-digit verification code.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "message": "OTP sent successfully"
}
```

---

### 3. Verify Email OTP

**POST** `/auth/verify-email-otp`

Verifies the 6-digit OTP sent to the user. Sets HttpOnly cookies upon success.

**Request Body:**

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200) - Success:**
Backend automatically sets `Set-Cookie` headers for `accessToken` and `refreshToken`.

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "emailVerified": true,
    "phoneVerified": false,
    "isProfileComplete": false
  }
}
```

---

### 4. Login

**POST** `/auth/login`

Login with email and password. Generates HttpOnly cookies and JSON response.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200) - Success:** Returns the identical `{ "user": { ... } }` JSON object as `/auth/verify-email-otp` along with HttpOnly `Set-Cookie` headers. No JWTs are exposed in the JSON body.

**Response (409 Conflict) - Unverified:** `"Email not verified. Please request an OTP."` Frontend must call `POST /auth/request-email-otp` explicitly to trigger an email, then redirect to OTP verification.

---

### 5. Google OAuth Login

**GET** `/auth/google`

Initiates Google OAuth flow. Redirects user to Google consent screen.

**GET** `/auth/google/callback`

Callback from Google. The backend processes the Google profile, sets HttpOnly cookies, and redirects back to the frontend application url without any sensitive URL parameters. Frontends should immediately call `/auth/me` to read the session state.

---

### 6. Forgot Password Request

**POST** `/auth/forgot-password`

Initiates the password reset flow. Generates a reset OTP, stores it in Redis, and asynchronously emails a reset link using BullMQ.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{ "message": "OTP sent successfully" }
```

_(Always returns success to prevent user enumeration attacks)._

---

### 7. Reset Password

**POST** `/auth/reset-password`

Consume the OTP (from the email link) to set a new password. Revokes all existing sessions/tokens for security.

**Request Body:**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123!"
}
```

**Response (200):**

```json
{ "message": "Password reset successfully" }
```

---

### 8. Change Password

**POST** `/auth/change-password`

Change the current password for an authenticated user. Requires a valid session (`accessToken` cookie or `Authorization: Bearer` header). On success, the backend will clear all existing tokens, requiring the user to log in again with their new password.

**Request Body:**

```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!"
}
```

**Response (200):**

```json
{
  "message": "Password changed successfully"
}
```

---

### 9. Request Phone OTP

**POST** `/auth/request-phone-otp`

Request an SMS OTP for phone verification. Useful for profile completion.

**Request Body:**

```json
{
  "phone": "+1234567890"
}
```

**Response (200):**

```json
{
  "message": "OTP sent to mobile number",
  "isOtpRequired": true
}
```

_Note: If `REQUIRE_PHONE_VERIFICATION=false` in `.env`, `isOtpRequired` will be `false`._

---

### 9. Complete Profile

**POST** `/auth/complete-profile`

Complete the user's profile and optionally verify the phone number. Returns the updated `{ "user": {...} }` and sets new HttpOnly cookies with fresh claims. **Requires an active session (valid `accessToken` cookie or `Authorization: Bearer` header) as the user's email is extracted from their JWT.**

**Request Body:**

```json
{
  "name": "John Doe",
  "organization": "GBI Corp",
  "city": "New York",
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "city": "New York",
    "phone": "+1234567890",
    "emailVerified": true,
    "phoneVerified": true,
    "isProfileComplete": true
  }
}
```

_Note: `otp` is only required if `/request-phone-otp` returned `isOtpRequired: true`._

---

### 10. Refresh Token

**POST** `/auth/refresh-token`

Get a new access token. Automatically rotates the refresh token.

**Request Body:** _(Optional if HttpOnly cookies are enabled)_

```json
{
  "refreshToken": "3f5a8c9d2..."
}
```

---

### 11. Logout

**POST** `/auth/logout`

Revokes the refresh token from the database and instructs the browser to clear HttpOnly cookies.

**Request Body:** _(Optional if HttpOnly cookies are enabled)_

```json
{
  "refreshToken": "3f5a8c9d2..."
}
```

---

### 12. Get Current User

**GET** `/auth/me`

Get currently authenticated user details. Must include valid `Authorization: Bearer <token>` OR an active session cookie.

---

## Security Best Practices

- **Account Lockout:** Failed OTP or password attempts (e.g., 5 failures in 15 minutes) result in a temporary Redis-backed IP/Account lockout (`423 Locked`).
- **Rate Limiting:** Distinct Throttle limits exist for `/signup` (5/hr) and `/forgot-password` (3/hr).
- **CSRF Protection (Crucial for Frontend):** All state-changing methods (`POST`, `PUT`, `DELETE`) require a valid `X-XSRF-TOKEN` header to prevent Cross-Site Request Forgery.

### How to handle the initial CSRF Token

Because `POST /auth/signup` and `POST /auth/login` are state-changing requests, they **strictly require** the `X-XSRF-TOKEN` header to succeed.

1. **The Initial "Handshake":** Before the frontend makes its _very first_ `POST` request to the API, it must make a simple `GET` request to any non-protected endpoint (e.g., `GET /api/health` or `GET /`).
2. **The Cookie:** The backend's `CsrfMiddleware` will intercept this `GET` request, generate a secure token, and attach a `Set-Cookie: XSRF-TOKEN=<token>; Path=/; SameSite=Lax` header to the response. **Note: This cookie is intentionally NOT HttpOnly so JS can read it.**
3. **The Interceptor:** Your frontend HTTP client (e.g., Axios) must be configured to automatically read the `XSRF-TOKEN` cookie and attach its value to the `X-XSRF-TOKEN` header on all subsequent `POST`/`PUT`/`DELETE` requests.

**Example Axios config:**

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.yourdomain.com',
  withCredentials: true, // MUST be true for cookies to be sent/received
  xsrfCookieName: 'XSRF-TOKEN', // The name of the cookie the backend sets
  xsrfHeaderName: 'X-XSRF-TOKEN', // The header the backend expects
});
```
