# Admin API Documentation

## Overview
The Admin Module provides endpoints for system administrators to manage devices and users.
These endpoints are protected by a separate **Admin Strategy**.

## Authentication
**Header:** `Authorization: Bearer <adminToken>`
*   Admin tokens are signed with a distinct secret (`ADMIN_JWT_SECRET`).
*   Standard user tokens **cannot** access these endpoints.

---

## API Endpoints

### 1. Admin Login
**POST** `/admin/login`

Authenticates an admin and issues an Admin Access Token (valid for 12 hours).

**Request Body:**
```json
{
  "email": "admin@gbi.com",
  "password": "AdminPassword123!"
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Create Device
**POST** `/admin/devices`

Registers a new IoT device in the system.

**Request Body:**
```json
{
  "deviceId": "ESP32-001",
  "deviceType": "Air Quality Monitor" 
}
```
*   `deviceType` is optional. 
*   **Allowed Values:** `Air Quality Monitor`.
*   **Default:** `Air Quality Monitor` if not specified.

**Response (201):**
```json
{
  "id": "uuid",
  "deviceId": "ESP32-001",
  "type": "Air Quality Monitor",
  "createdAt": "..."
}
```
**Errors:**
*   `400 Bad Request`: If `deviceType` is not a valid enum value.
*   `409 Conflict`: If Device ID already exists.

### 3. List Devices
**GET** `/admin/devices`

Returns a list of all registered devices and their assignment status.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "deviceId": "ESP32-001",
    "assignments": [] // Empty if unassigned
  }
]
```

### 4. Force Unassign Device
**POST** `/admin/devices/:id/unassign`

Forcefully removes a device from any user it is currently assigned to.

**Response (201):**
```json
{
  "success": true
}
```

### 5. List Users
**GET** `/admin/users`

Returns a list of all registered users with summary statistics.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "organization": "GBI Corp",
    "isRestricted": false,
    "deviceCount": 2
  }
]
```

### 6. Restrict User
**PATCH** `/admin/users/:id/restrict`

Bans a user from the system.
*   Sets `isRestricted = true`.
*   **Revokes all active sessions** (User is logged out immediately).

**Response (200):**
```json
{
  "success": true
}
```

### 7. Unrestrict User
**PATCH** `/admin/users/:id/unrestrict`

Restores access for a banned user.
*   Sets `isRestricted = false`.
*   Note: The user will need to log in again if their session has verified the restriction status.

**Response (200):**
```json
{
  "success": true
}
```

---

## User Restriction Logic
When an admin restricts a user, the following happens immediately:

1.  **Database Flag**: The user's `isRestricted` column is set to `true`.
2.  **Session Revocation**: All active Refresh Tokens for that user are deleted (`revokedAt`).
3.  **Access Block**:
    *   Any new login attempts will fail.
    *   Any attempt to refresh an access token will fail.
    *   Currently active Access Tokens (short-lived, e.g., 15m) will continue to work until they expire, after which the user will be forced to re-login and fail. This ensures near-immediate lockout without requiring a centralized blacklist for access tokens.

