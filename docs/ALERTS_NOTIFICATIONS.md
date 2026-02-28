# Notifications API

**Base URL:** `/notifications`  
**Auth:** All endpoints require `Authorization: Bearer <accessToken>` (user JWT).

---

## Overview

The Notifications module delivers real-time in-app alerts to users when significant events occur on their devices (e.g., threshold breaches, device going offline).

Notifications are stored in the database and delivered via **Server-Sent Events (SSE)** to active frontend connections. They can also be retrieved and managed via REST.

---

## Endpoints

### 1. Get My Notifications

**GET** `/notifications`

Returns a paginated list of notifications for the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `isRead` | boolean | — | Filter by read status (`true` / `false`). Omit for all. |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page |

**Example Request:**

```http
GET /notifications?isRead=false&page=1&limit=10
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "message": "PM25 exceeded limit on device GBI-DEV-001",
      "deviceId": "GBI-DEV-001",
      "isRead": false,
      "createdAt": "2026-02-27T08:15:00.000Z",
      "readAt": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

---

### 2. Mark Notification as Read

**PATCH** `/notifications/:id/read`

Marks a single notification as read.  
`:id` is the notification UUID.

**Response (200):**

```json
{
  "id": "uuid",
  "isRead": true,
  "readAt": "2026-02-27T08:20:00.000Z"
}
```

---

### 3. Mark All Notifications as Read

**PATCH** `/notifications/read-all`

Marks all of the user's unread notifications as read in one operation.

**Response (200):**

```json
{
  "updated": 15
}
```

---

## Notification Triggers

Notifications are generated automatically by the system in the following scenarios:

| Trigger                                      | Message Example                         |
| -------------------------------------------- | --------------------------------------- |
| Telemetry parameter exceeds threshold        | `"PM25 exceeded limit on GBI-DEV-001"`  |
| Device goes offline (no telemetry > 5 min)   | `"Device GBI-DEV-001 is offline"`       |
| Threshold resolved (value returns to normal) | `"GBI-DEV-001 PM25 returned to normal"` |

---

## Real-Time Delivery (SSE)

Notifications are also pushed in real-time to the frontend via Server-Sent Events.  
See [REALTIME_API.md](./REALTIME_API.md) for the SSE connection endpoint and event format.
