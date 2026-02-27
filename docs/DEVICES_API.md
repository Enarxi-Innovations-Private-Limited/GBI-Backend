# Devices API

**Base URL:** `/devices`  
**Auth:** All endpoints require `Authorization: Bearer <accessToken>` (user JWT).

---

## Endpoints

### 1. Claim a Device

**POST** `/devices/claim`

Claims ownership of a device using its unique Device ID. All fields are **mandatory**.

- Device must be pre-registered in the Admin Portal.
- A device can only be claimed by **one user at a time** (enforced atomically at DB level).

**Request Body:**

```json
{
  "deviceId": "GBI-DEV-001",
  "name": "Living Room Monitor",
  "location": "Living Room",
  "city": "Chennai",
  "pincode": "600016"
}
```

| Field      | Type   | Required | Validation                       |
| ---------- | ------ | -------- | -------------------------------- |
| `deviceId` | string | ✅       | length 3–50                      |
| `name`     | string | ✅       | length 1–50 (user-defined alias) |
| `location` | string | ✅       | length 1–100 (e.g., "Kitchen")   |
| `city`     | string | ✅       | length 1–100                     |
| `pincode`  | string | ✅       | exactly 6 digits `^[0-9]{6}$`    |

**Response (201):**

```json
{
  "assignment": {
    "id": "uuid",
    "deviceId": "device-internal-uuid",
    "userId": "user-uuid",
    "assignedAt": "2026-02-27T08:00:00.000Z"
  },
  "meta": {
    "id": "uuid",
    "deviceId": "GBI-DEV-001",
    "userId": "user-uuid",
    "name": "Living Room Monitor",
    "location": "Living Room",
    "city": "Chennai",
    "pincode": "600016"
  }
}
```

**Errors:**
| Code | Reason |
|------|--------|
| `400 Bad Request` | Validation failed (missing field / invalid pincode) |
| `404 Not Found` | Device ID does not exist in the system |
| `409 Conflict` | Device is already claimed by another user |

> **Integrity Note:** The claim operation is fully **transactional** — device lookup, active-assignment check, `DeviceAssignment` creation, and `UserDevice` creation all happen atomically. Concurrent race conditions are handled both in application code and at the **database level** (partial unique index on `DeviceAssignment.deviceId WHERE unassignedAt IS NULL`).

---

### 2. List My Devices

**GET** `/devices`

Returns all devices currently assigned to the authenticated user, merged with their geo-metadata.

**Response (200):**

```json
[
  {
    "id": "device-internal-uuid",
    "deviceId": "GBI-DEV-001",
    "type": "Air Quality Monitor",
    "status": "ONLINE",
    "name": "Living Room Monitor",
    "location": "Living Room",
    "city": "Chennai",
    "pincode": "600016",
    "claimedAt": "2026-02-27T08:00:00.000Z"
  }
]
```

**Device Status Values:** `ONLINE` | `OFFLINE` | `WARNING` | `ACTIVE`

---

### 3. Update Device Details

**PATCH** `/devices/:id`

Updates the metadata of a claimed device.  
`:id` is the **display ID** (e.g., `GBI-DEV-001`).

**Request Body** (all fields optional):

```json
{
  "name": "Kitchen Sensor",
  "location": "Kitchen"
}
```

**Response (200):** Updated `UserDevice` record.

---

### 4. Set Device Threshold

**POST** `/devices/:id/threshold`

Sets custom alert thresholds for an individual device.

> ❌ Not allowed if the device belongs to a Group — remove it from the group first.

**Request Body:**

```json
{
  "thresholds": {
    "pm25": 35,
    "co2": 1000,
    "temperature": 40
  }
}
```

**Supported Parameters:** `pm25`, `pm10`, `tvoc`, `co2`, `temperature`, `humidity`, `noise`, `aqi`

---

### 5. Remove Device Threshold

**DELETE** `/devices/:id/threshold`

Removes the individual threshold for a device (fallback to Group threshold if applicable).

**Response (200):**

```json
{ "message": "Device threshold removed" }
```

---

### 6. Unclaim Device

**DELETE** `/devices/:id`

> ⚠️ **Currently Disabled**  
> This endpoint is intentionally disabled at the application layer.  
> Returns `403 Forbidden`.  
> The schema and internal logic are preserved for future re-enablement.

---

## Device Ownership Model

```
Admin registers device in Device table
         ↓
User claims device via POST /devices/claim
         ↓
DeviceAssignment created  (deviceId = Device.id UUID, FK enforced)
UserDevice created        (name, location, city, pincode)
         ↓
User views devices via GET /devices
(Merges DeviceAssignment + UserDevice for display)
```

---

## Device Health Monitoring

Devices report connectivity via MQTT heartbeat topic.

| Condition                  | Status    |
| -------------------------- | --------- |
| Heartbeat received         | `ONLINE`  |
| No heartbeat for 7 minutes | `OFFLINE` |
| Threshold breached         | `WARNING` |

Offline transitions trigger **in-app notifications** to the device owner.
