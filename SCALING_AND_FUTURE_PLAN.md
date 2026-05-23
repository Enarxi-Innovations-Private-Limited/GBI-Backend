# GBI Air Quality Monitor: Scaling & Architecture Plan

This document outlines the strategy for horizontally scaling the GBI backend and resolving synchronization issues between local development and production environments.

## 1. Current Architectural Analysis
Currently, the system uses a shared Database but isolated Redis instances (or local caches) and a shared MQTT broker with Shared Subscriptions.

### The "Flickering Dashboard" Problem
In a load-balanced environment (or dev vs. prod), if multiple backend instances exist:
*   **Cause**: Backend A processes an MQTT message and updates the database. Backend B, however, has a stale version of the device status in its local Redis cache.
*   **Effect**: When a user's browser polls the system, it may hit Backend A (showing new data) and then hit Backend B (showing "Offline" or old data), causing the UI to "flicker" or show inconsistent states.

### The "Silent Notification" Problem
If real-time features (SSE/WebSockets) are used:
*   **Cause**: Backend A detects a threshold breach and emits a warning event to its locally connected clients. Users connected to Backend B never receive the alert because the event never leaves Backend A's memory.
*   **Effect**: Critical alerts are missed by a significant portion of the user base.

---

## 2. Horizontal Scaling Strategy

To support thousands of devices and multiple backend instances, we must implement the following "Source of Truth" patterns:

### Phase 1: Centralized Session & Cache (Required)
*   **Action**: All backend instances must connect to the **same Redis Cluster** (e.g., AWS ElastiCache or Upstash).
*   **Benefit**: If any backend instance updates a device status or telemetry cache, all other instances see that change immediately. This eliminates the "Flickering Dashboard" problem.

### Phase 2: Redis Pub/Sub for Event Synchronization (Required for Real-time)
*   **Action**: Implement a Redis-backed event bus.
    *   When a telemetry spike is detected, the processing backend publishes to a Redis channel: `PUBLISH device:alerts {"deviceId": "...", "type": "WARNING"}`.
    *   Every backend instance subscribes to this channel.
    *   When an instance receives the message, it checks its local SSE/WebSocket connections and forwards the alert to relevant users.
*   **Benefit**: Global real-time notifications regardless of which server the user is connected to.

---

## 3. Local Development vs. Production Isolation

To prevent development tests from interfering with production data and vice-versa, we will implement **Topic Prefixing**.

### Proposed MQTT Topic Structure
*   **Production**: `gbi/devices/{deviceId}/telemetry`
*   **Development**: `dev/gbi/devices/{deviceId}/telemetry`

### Implementation Steps:
1.  **Backend Logic**: Update `MqttConsumer.extractDeviceId` to handle variable prefixes (find the `devices` segment in the array rather than using a hardcoded index).
2.  **Configuration**: 
    *   In Prod `.env`: `MQTT_TELEMETRY_TOPIC=gbi/devices/+/telemetry`
    *   In Local `.env`: `MQTT_TELEMETRY_TOPIC=dev/gbi/devices/+/telemetry`
3.  **Simulation Scripts**: Update `publish_data.js` to use a `dev/` prefix by default.

---

## 4. Database Strategy
*   **Current State**: Shared Production Database.
*   **Future Standard**: Implement a strictly isolated **Development Database**. Local development should NEVER write to the production database to avoid corrupting telemetry history or generating false alerts in production logs.

---

## 5. Summary Checklist for Scaling
- [ ] Move all backends to a single, shared Redis instance.
- [ ] Implement Redis Pub/Sub for cross-instance event broadcasting.
- [ ] Implement `MQTT_TOPIC_PREFIX` in `.env` for environment isolation.
- [ ] Migrate local development to a local/staging PostgreSQL instance.
