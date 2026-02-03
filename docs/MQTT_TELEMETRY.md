# MQTT & Telemetry Documentation

## Overview
The **MQTT Module** acts as the nervous system of the GBI/Ari Quality Monitor. It listens for real-time sensor data from IoT devices, validates it, and persists it to the database for historical analysis and real-time alerting.

---

## Connection Details
The backend connects to an MQTT Broker (defined in `MQTT_BROKER_URL`).
*   **Protocol**: MQTT (TCP/WebSockets)
*   **Client ID**: `gbi-backend-service` (or process ID based)
*   **QoS**: Level 1 (At least once) recommended.

---

## Topics & Payloads

### 1. Telemetry Data
Devices send sensor readings to this topic.

*   **Topic**: `gbi/devices/{deviceId}/telemetry`
    *   Example: `gbi/devices/ESP32-001/telemetry`
*   **Direction**: Device -> Backend
*   **Payload (JSON)**:
```json
{
  "pm25": 12.5,       // PM2.5 (ug/m3)
  "pm10": 20.1,       // PM10 (ug/m3)
  "tvoc": 0.5,        // Total Volatile Organic Compounds (ppm/ppb)
  "co2": 450.0,       // Carbon Dioxide (ppm)
  "temperature": 24.5,// Celsius
  "humidity": 60.2,   // Percentage
  "noise": 45.0       // Decibels
}
```
*   **Validation**:
    *   Extra fields are ignored.
    *   Types must match (numbers).
    *   If validation fails, the message is logged as a warning and discarded.

### 2. Heartbeat / Status
Devices send a periodic "I'm alive" signal.

*   **Topic**: `gbi/devices/{deviceId}/heartbeat`
*   **Direction**: Device -> Backend
*   **Payload**: Empty or any JSON.
*   **Effect**:
    *   Sets the device's status to **'active'** in the database.
    *   Updates `lastHeartbeatAt` timestamp.
    *   **Note**: If no heartbeat is received for **7 minutes**, the system marks the device as `inactive` and sends an "Offline" notification. Inactive devices cannot send telemetry.

---

## Implementation Details

### MqttService (`src/mqtt/mqtt.service.ts`)
*   Manages the connection to the broker.
*   Handles reconnection logic automatically.
*   Subscribes to wildcards: `gbi/devices/+/telemetry`.

### Real-time Broadcasting
*   When a valid telemetry message is received, it is **automatically broadcast** to connected WebSocket clients via the `RealtimeService`.
*   See [Real-time API](../REALTIME_API.md) for details on subscribing to these updates.

### MqttConsumer (`src/mqtt/mqtt.consumer.ts`)
*   **Routes Messages**: extracts `deviceId` from the topic.
*   **Validates Data**: Uses `class-validator` and `TelemetryPayloadDto` to ensure data integrity.
*   **Persists Data**: Saves valid readings to the `DeviceTelemetry` table.
*   **Triggers Alerts**: Calls `AlertsService.evaluate()` immediately after saving telemetry.

---

## Troubleshooting
**Q: My device sent data but it's not in the database.**
1.  Check if the topic matches exactly: `gbi/devices/YOUR_ID/telemetry`.
2.  Check the payload format. Strings ("12.5") instead of numbers (12.5) might fail if not fully compatible.
3.  Check backend logs for `❌ MQTT error` or `Invalid telemetry payload`.
