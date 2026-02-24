# Alerts & Notifications System

## Overview

The alerting system monitors incoming telemetry in real-time. Just-in-time (JIT) evaluation determines if any user-defined thresholds have been breached.

---

## How It Works

### 1. Configuration (Thresholds)

Users define "Alert Thresholds" for specific devices and parameters.

- **Example**: "Notify me if CO2 > 1000 ppm on Device A".
- These are stored in the `AlertThreshold` table.

### 2. Real-Time Evaluation

When `MqttConsumer` receives a telemetry packet:

1.  It calls `AlertsService.evaluate(deviceId, data)`.
2.  The service fetches **all assigned users** for that device + their **thresholds**.
3.  It compares the incoming value against the limit: `CurrentValue > LimitValue`.

### 3. Stateful Alerting (Hysteresis)

To prevent "alert fatigue" (flapping), the system uses a **Stateful** approach with Hysteresis, rather than a simple cooldown timer.

- **States**: Each (User, Device, Parameter) tuple tracks a state: `NORMAL` or `ALERTING`.
- **Hysteresis Buffer**: A 2% buffer is applied to prevent rapid toggling when values hover near the limit.

#### Logic:

1.  **Triggering (NORMAL -> ALERTING)**:
    - Occurs when `Value > Threshold`.
    - System sends an "Exceeded limit" notification.
    - Records state as `ALERTING`.

2.  **Recovery (ALERTING -> NORMAL)**:
    - Occurs only when `Value < (Threshold - 2%)`.
    - _Example_: If limit is 1000, recovery happens only when value drops below 980.
    - System sends a "Back to normal" notification.
    - Records state as `NORMAL`.

---

## Notifications

### Event Logs

Every valid alert creates a permanent record in the `EventLog` table with `eventType: 'Alert_Triggered'`. This is useful for graphs and auditing.

### In-App Notifications

A `Notification` record is created for the user.

- **Fields**: `message`, `isRead`, `readAt`.
- **API**:
  - `GET /notifications` - Fetch unread/all.
  - `PATCH /notifications/:id/read` - Mark specific as read.
  - `PATCH /notifications/read-all` - Mark all as read.

---

## Database Optimization

The evaluation process is optimized to handle high loads:

- **Batch Fetching**: Users and thresholds are fetched in a single query via `getAssignedUsersWithThresholds`.
- **Batch Cooldown Check**: All potential alerts are checked against the history table in a single DB round-trip using `getRecentAlerts`.

Act as an senior product manager, i did'nt know what my backend team written the code.
You need to completely analyse the backend code and create a in-depth detailed md file for the backend part.
