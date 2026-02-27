# Groups API

**Base URL:** `/groups`  
**Auth:** All endpoints require `Authorization: Bearer <accessToken>` (user JWT).

---

## Overview

The Groups module lets users organize multiple devices into logical groups (e.g., `"Floor 1"`, `"Living Area"`). Groups allow setting a single shared **threshold** that applies to all devices in the group, simplifying alert management at scale.

**Threshold Priority:**  
If a device has both a Group Threshold and an individual Device Threshold, the **Device Threshold takes priority**.

---

## Endpoints

### 1. Create Group

**POST** `/groups`

Creates a new device group for the authenticated user.

**Request Body:**

```json
{
  "name": "Office Floor 1"
}
```

**Response (201):**

```json
{
  "id": "group-uuid",
  "name": "Office Floor 1",
  "userId": "user-uuid",
  "createdAt": "2026-02-27T08:00:00.000Z"
}
```

---

### 2. Add Device to Group

**POST** `/groups/:groupId/devices`

Adds a claimed device to the group.  
`:groupId` is the group UUID.

> ❌ A device cannot have individual thresholds while in a group. Remove individual thresholds before adding to a group, or add the device to the group first.

**Request Body:**

```json
{
  "deviceId": "GBI-DEV-001"
}
```

**Response (201):** Updated device record with `groupId` set.

**Errors:**
| Code | Reason |
|------|--------|
| `403 Forbidden` | Device is not owned by the requesting user |
| `409 Conflict` | Device already has individual thresholds set |
| `404 Not Found` | Group or device not found |

---

### 3. Remove Device from Group

**DELETE** `/groups/:groupId/devices/:deviceId`

Removes a device from a group. The device retains its own configuration (no group threshold fallback after removal).

**Response (200):** Updated device record with `groupId` cleared.

---

### 4. Set Group Threshold

**POST** `/groups/:groupId/threshold`

Sets alert thresholds that apply to **all devices in the group** (unless a device has its own individual threshold).

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

**Supported Parameters:** `pm25` | `pm10` | `tvoc` | `co2` | `temperature` | `humidity` | `noise` | `aqi`

**Response (201):** Created/updated `GroupThreshold` record.

---

### 5. Remove Group Threshold

**DELETE** `/groups/:groupId/threshold`

Removes the threshold from a group. Devices in the group will no longer trigger alerts until a new threshold is set.

**Response (200):** `{ "success": true }`

---

### 6. Delete Group

**DELETE** `/groups/:groupId`

Deletes the group. Devices in the group are **not deleted** — they are simply unlinked (`groupId` cleared).

**Response (200):** `{ "success": true }`

---

## Threshold Priority Model

```
Device receives telemetry
         ↓
Does device have Device Threshold?
  ├─ YES → Use Device Threshold (highest priority)
  └─ NO  → Is device in a Group with a Group Threshold?
              ├─ YES → Use Group Threshold
              └─ NO  → No alerts triggered
```
