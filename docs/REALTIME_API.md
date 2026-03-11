# Realtime API (Server-Sent Events)

**Endpoint:** `GET /events/stream`  
**Protocol:** Server-Sent Events (SSE) — HTTP/1.1 persistent connection  
**Auth:** `Authorization: Bearer <accessToken>` header

---

## Overview

The Realtime module delivers live updates to the frontend using **Server-Sent Events (SSE)**, not WebSockets. The frontend opens a single persistent HTTP connection and receives events pushed by the server.

Events are delivered for:

- New in-app notifications (threshold breaches, offline alerts)
- Custom server-side broadcasts to a specific user

## Real-time Strategy

The system uses a hybrid approach for real-time updates:

1.  **SSE (Server-Sent Events)**: For low-frequency, critical events like **In-App Notifications** and Alerts.
2.  **HTTP Polling**: For high-frequency data like **Latest Telemetry** (Dashboard updates). Fetch the latest state from the Redis-backed cache.

---

## 1. Latest Telemetry Polling

**Endpoint:** `GET /devices/:id/latest`

This endpoint provides the absolute latest data received from the device, served directly from a high-performance Redis cache.

**Recommended Polling Interval:** 30–60 seconds.

**Example Request:**

```http
GET /devices/GBI-DEV-001/latest
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "timestamp": "2026-03-11T08:15:00.000Z",
  "status": "ONLINE",
  "pm25": 12.5,
  "pm10": 20.1,
  "tvoc": 0.5,
  "co2": 450,
  "temperature": 24.5,
  "humidity": 60.2,
  "noise": 45.0,
  "aqi": 42
}
```

---

## 2. Notification Stream (SSE)

```javascript
const token = 'YOUR_JWT_ACCESS_TOKEN'; // from /auth/login

const source = new EventSource(`http://localhost:4000/events/stream`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

source.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};

source.onerror = () => {
  console.error('SSE connection error');
};
```

> **Note:** Native browser `EventSource` does not support custom headers. Use the [`eventsource`](https://www.npmjs.com/package/eventsource) npm package or `fetch`-based SSE libraries in React/Next.js apps.

---

## Event Format

All server-sent events are JSON-serialized with the following structure:

```json
{
  "type": "NOTIFICATION",
  "data": {
    "id": "notification-uuid",
    "message": "PM25 exceeded limit on GBI-DEV-001",
    "deviceId": "GBI-DEV-001",
    "createdAt": "2026-02-27T08:15:00.000Z"
  }
}
```

### Event Types

| `type`         | Trigger                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `NOTIFICATION` | A new in-app notification was created for the user (threshold breach, offline alert, alert resolved) |

---

## Connection Lifecycle

| Scenario                      | Behaviour                                                    |
| ----------------------------- | ------------------------------------------------------------ |
| User connects with valid JWT  | Connection accepted, user added to SSE client pool           |
| User disconnects / closes tab | Connection cleaned up automatically                          |
| Invalid/expired JWT           | Connection rejected with `401 Unauthorized`                  |
| Server restart                | Client must reconnect (standard SSE reconnect logic applies) |

---

## Related

- New notifications appear in both SSE and the REST endpoint.
- See [ALERTS_NOTIFICATIONS.md](./ALERTS_NOTIFICATIONS.md) for fetching and managing stored notifications via REST.
