# User Devices API Documentation

## Overview
The Devices Module allows authenticated users to claim, manage, and unclaim IoT devices.
All endpoints require **User Access Token**.
**Header:** `Authorization: Bearer <accessToken>`

---

## API Endpoints

### 1. Claim a Device
**POST** `/devices/claim`

Claims ownership of a device using its unique Device ID.
*   **Prerequisite**: Device must be created by Admin first.
*   **Rule**: A device can only be claimed by one user at a time.

**Request Body:**
```json
{
  "deviceId": "GBI-001",
  "name": "Living Room Monitor", 
  "location": "Home" 
}
```
*   `name` and `location` are optional.

**Response (201):**
```json
{
  "assignment": {
    "id": "uuid",
    "deviceId": "uuid",
    "userId": "uuid",
    "assignedAt": "..."
  },
  "meta": {
    "name": "Living Room Monitor",
    "location": "Home"
  }
}
```
**Errors:**
*   `404 Not Found`: Device ID does not exist.
*   `409 Conflict`: Device is already owned by someone else.

### 2. List My Devices
**GET** `/devices`

Returns a list of all devices currently assigned to the user, including their custom names.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "deviceId": "GBI-001",
    "type": "Air Quality Monitor",
    "status": "active",
    "name": "Living Room Monitor",
    "location": "Home",
    "claimedAt": "..."
  }
]
```

### 3. Update Device Details
**PATCH** `/devices/:id`

Updates the friendly name or location of a device.
*   `:id` is the **Device ID String** (e.g., `GBI-001`).

**Request Body:**
```json
{
  "name": "Kitchen Monitor",
  "location": "Kitchen"
}
```

**Response (200):**
```json
{
  "id": "...",
  "name": "Kitchen Monitor",
  "location": "Kitchen"
}
```

### 4. Unclaim Device
**DELETE** `/devices/:id`

Removes ownership of the device. The device becomes available for efficient claiming by others (or re-claiming).
*   `:id` is the **Device ID String** (e.g., `GBI-001`).

**Response (200):**
```json
{
  "success": true
}
```
