# Alerts & Notifications System

## Overview
The alerting system monitors incoming telemetry in real-time. Just-in-time (JIT) evaluation determines if any user-defined thresholds have been breached.

---

## How It Works

### 1. Configuration (Thresholds)
Users define "Alert Thresholds" for specific devices and parameters.
*   **Example**: "Notify me if CO2 > 1000 ppm on Device A".
*   These are stored in the `AlertThreshold` table.

### 2. Real-Time Evaluation
When `MqttConsumer` receives a telemetry packet:
1.  It calls `AlertsService.evaluate(deviceId, data)`.
2.  The service fetches **all assigned users** for that device + their **thresholds**.
3.  It compares the incoming value against the limit: `CurrentValue > LimitValue`.

### 3. Cooldown Mechanism
To prevent spamming the user (e.g., sending 60 emails a minute if value is 1001), a **Cooldown** is applied.
*   **Default Cooldown**: 5 Minutes.
*   **Logic**: Before sending an alert, the system checks if an `Alert_Triggered` event was already logged for this (User, Device, Parameter) tuple in the last 5 minutes.
*   If found, the alert is suppressed.

---

## Notifications

### Event Logs
Every valid alert creates a permanent record in the `EventLog` table with `eventType: 'Alert_Triggered'`. This is useful for graphs and auditing.

### In-App Notifications
A `Notification` record is created for the user.
*   **Fields**: `message`, `isRead`, `readAt`.
*   **API**:
    *   `GET /notifications` - Fetch unread/all.
    *   `PATCH /notifications/:id/read` - Mark specific as read.
    *   `PATCH /notifications/read-all` - Mark all as read.

---

## Database Optimization
The evaluation process is optimized to handle high loads:
*   **Batch Fetching**: Users and thresholds are fetched in a single query via `getAssignedUsersWithThresholds`.
*   **Batch Cooldown Check**: All potential alerts are checked against the history table in a single DB round-trip using `getRecentAlerts`.
