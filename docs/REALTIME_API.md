# Real-time API Documentation

## Overview
The **Realtime Module** enables the frontend to receive live updates from the backend using WebSockets (`socket.io`). This is primarily used for streaming live sensor telemetry and device status changes.

## Connection
*   **Protocol**: WebSocket (via `socket.io-client`)
*   **Namespace**: `/` (default)
*   **Authentication**: JWT Access Token required in handshake query.

### Connection Example (Frontend)
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  query: {
    token: "YOUR_JWT_ACCESS_TOKEN" // from /auth/login
  }
});

socket.on("connect", () => {
  console.log("Connected to GBI Realtime Server");
});
```

---

## Events

### 1. Subscribe to Device
You must "subscribe" to a specific device's room to receive its updates. This prevents clients from receiving data for devices they aren't viewing.

*   **Event**: `subscribe`
*   **Payload**:
    ```json
    { "deviceId": "GBI-001" }
    ```

### 2. Live Telemetry
Emitted when a device sends new sensor data via MQTT.

*   **Event**: `telemetry:GBI-001` (Dynamic event name)
*   **Payload**:
    ```json
    {
      "timestamp": "2024-01-20T10:00:00.000Z",
      "pm25": 12.5,
      "pm10": 20.1,
      "tvoc": 0.5,
      "co2": 450.0,
      "temperature": 24.5,
      "humidity": 60.2,
      "noise": 45.0
    }
    ```

### 3. Device Status Change
Emitted when a device comes online or goes offline.

*   **Event**: `device:status`
*   **Payload**:
    ```json
    {
      "deviceId": "GBI-001",
      "status": "active" // or "offline"
    }
    ```

---

## Security
*   **Guards**: `WsJwtGuard` validates the token provided in the connection handshake.
*   **Validation**: Invalid tokens are disconnected immediately.
