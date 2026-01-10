# Users API Documentation

## Overview
The Users Module provides endpoints for managing user profiles, password changes, and verification processes (email & phone).

## Authentication
All endpoints in this module require a valid **User Access Token**.
**Header:** `Authorization: Bearer <accessToken>`

---

## API Endpoints

### 1. Get Current User Profile
**GET** `/users/me`

Retrieves the profile of the currently logged-in user.

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "organization": "GBI Corp",
  "emailVerified": true,
  "phoneVerified": false
}
```

### 2. Update Profile
**PATCH** `/users/me`

Updates the user's profile information.

**Request Body:**
```json
{
  "name": "Jane Doe",
  "organization": "New GBI Corp",
  "phone": "+1987654321",
  "city": "London"
}
```
*Note: All fields are optional.*

**Response (200):** Returns the updated user object.

### 3. Change Password
**POST** `/users/change-password`

Allows a logged-in user to change their password.

**Request Body:**
```json
{
  "oldPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

**Response (200):**
```json
{
  "success": true
}
```
*Note: Using this endpoint revokes all existing refresh tokens for security.*

---

## Verification Endpoints (Redis-Backed OTP)

### 4. Request Email Verification
**POST** `/users/request-email-verification`

Generates a cryptographically secure 6-digit OTP and attempts to send it to the user's registered email.
*   **Security**: Rate limited (1-minute cooldown, max 5 requests/hour).
*   **Storage**: OTP is stored in Redis with a 5-minute expiration (`TTL: 300s`).
*   **Dev Mode**: In `NODE_ENV=development`, the OTP is logged to the server console.

**Response (201):**
```json
{
  "message": "OTP sent to email (check server logs)"
}
```
**Errors:**
*   `400 Bad Request`: If email is already verified.
*   `429 Too Many Requests`: If rate limit is exceeded.
    *   Example: `"Please wait 45 seconds before requesting another OTP."`
    *   Example: `"You have reached the maximum of 5 OTP requests per hour."`

### 5. Verify Email OTP
**POST** `/users/verify-email`

Validates the OTP entered by the user.

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 6. Request Phone Verification
**POST** `/users/request-phone-verification`

Similar to email verification, but sends an OTP to the user's registered phone number.
*   **Dev Mode**: Logs OTP to console.
*   **Security**: Rate limited (1-minute cooldown, max 5 requests/hour).
*   **Storage**: Stored in Redis (`otp_phone:<userId>`).

**Response (201):**
```json
{
  "message": "OTP sent to phone (check server logs)"
}
```

### 7. Verify Phone OTP
**POST** `/users/verify-phone`

Validates the SMS OTP.

**Request Body:**
```json
{
  "code": "654321"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Phone verified successfully"
}
```
