# Admin API

**Base URL:** `/admin`  
**Auth:** All endpoints (except `/admin/login`) require `Authorization: Bearer <adminToken>`.  
Admin tokens are signed with a distinct `ADMIN_JWT_SECRET` — standard user tokens **cannot** access these endpoints.

---

## Authentication

### Admin Login

**POST** `/admin/login`

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

Token is valid for **12 hours**.

---

## Device Management

### Create Device

**POST** `/admin/devices`

Registers a single IoT device in the system.

**Request Body:**

```json
{
  "deviceId": "GBI-DEV-001",
  "deviceType": "Air Quality Monitor"
}
```

- `deviceType` is optional (defaults to `Air Quality Monitor`).

**Response (201):**

```json
{
  "id": "uuid",
  "deviceId": "GBI-DEV-001",
  "type": "Air Quality Monitor",
  "status": "OFFLINE",
  "addedAt": "2026-02-27T08:00:00.000Z"
}
```

**Errors:** `409 Conflict` if Device ID already exists.

---

### Bulk Create Devices (Excel Upload)

**POST** `/admin/devices/bulk`

Imports multiple devices from an Excel (`.xlsx`) file via `multipart/form-data`.

**Request:** `Content-Type: multipart/form-data`  
Upload a `.xlsx` file with:

- **Column A:** Device ID (e.g., `GBI-DEV-001`)
- **Column B (optional):** Device Type

**Response (201):**

```json
{
  "created": 25,
  "skipped": 3,
  "errors": [
    { "row": 4, "deviceId": "GBI-DEV-004", "reason": "Already exists" }
  ]
}
```

---

### List All Devices

**GET** `/admin/devices`

Returns a paginated list of all registered devices with their assignment status.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Filter by Device ID (partial match) |
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "deviceId": "GBI-DEV-001",
      "status": "ONLINE",
      "type": "Air Quality Monitor",
      "addedAt": "...",
      "isDeleted": false,
      "assignments": [{ "userId": "...", "assignedAt": "..." }]
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 10
}
```

---

### Force Unassign Device

**POST** `/admin/devices/:id/unassign`

Forcefully removes a device from any user assignment it is currently in.  
`:id` is the Device display ID (e.g., `GBI-DEV-001`).

**Response (201):**

```json
{ "success": true }
```

---

### Soft Delete Device

**PATCH** `/admin/devices/:deviceId/delete`

Marks a device as deleted (`isDeleted = true`). The device is hidden from users and ignored by the MQTT consumer — no new telemetry is accepted.

**Response (200):**

```json
{ "success": true }
```

---

## User Management

### List All Users

**GET** `/admin/users`

Returns all registered users with summary statistics.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "organization": "GBI Corp",
    "city": "Chennai",
    "isRestricted": false,
    "emailVerified": true,
    "phoneVerified": false,
    "deviceCount": 5,
    "createdAt": "..."
  }
]
```

---

### Restrict User

**PATCH** `/admin/users/:id/restrict`

Bans a user from the platform.

1. Sets `isRestricted = true` in the database.
2. **Revokes all active Refresh Tokens** — user is immediately logged out.
3. Existing short-lived Access Tokens continue working until expiry (typically 15 min), then fail on next refresh.

**Response (200):** `{ "success": true }`

---

### Unrestrict User

**PATCH** `/admin/users/:id/unrestrict`

Restores platform access for a banned user.  
Sets `isRestricted = false`. User must log in again.

**Response (200):** `{ "success": true }`

---

### Delete User

**DELETE** `/admin/users/:id`

Permanently deletes a user account from the system.

**Response (200):** `{ "success": true }`

---

## Platform Stats

**GET** `/admin/stats`

Returns high-level platform statistics for the admin dashboard.

**Response (200):**

```json
{
  "totalUsers": 120,
  "totalDevices": 250,
  "activeDevices": 198,
  "assignedDevices": 175,
  "unassignedDevices": 75
}
```

---

## User Restriction Flow

```
Admin → PATCH /admin/users/:id/restrict
           ↓
   isRestricted = true (DB)
           ↓
   All RefreshTokens revoked (revokedAt set)
           ↓
   Next login attempt → 403 Forbidden
   Next token refresh → 401 Unauthorized
   Existing access token → works until expiry (~15 min)
```
