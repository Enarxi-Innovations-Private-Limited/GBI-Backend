# GBI/Ari Quality Monitor Backend

## Description
The official backend for the GBI Air Quality Monitoring system. Built with **NestJS**, **Prisma**, and **PostgreSQL**.

It provides:
- **Authentication**: JWT-based auth with Role-Based Access Control (User/Admin).
- **IoT Integration**: MQTT Service for real-time telemetry ingestion.
- **Monitoring**: Real-time evaluation of sensor data against user-defined thresholds.
- **Management**: Admin APIs for device provisioning and user control.

---

## Compatibility Matrix

This matrix tracks the compatibility between the Frontend (`GBI`) and Backend (`gbi-backend`) releases.

| Frontend Version | Backend Version | Status               | Notes                                                                                                                         |
| :--------------- | :-------------- | :------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `v1.4.2`         | `>= v1.4.1`     | **Compatible**       | Sync individual device thresholds from backend on mount and invalidate cache on threshold updates.                            |
| `v1.4.1`         | `>= v1.4.0`     | **Compatible**       | Added dashboard cache TTL check (10 mins) and fixed connection retry handler crash.                                           |
| `v1.4.0`         | `v1.3.1`        | **Compatible**       | Made global defaults read-only, updated warning disclaimers, and removed mock sensor node references.                        |
| `v1.2.0` - `v1.3.0` | `>= v1.3.0`    | **Compatible**       | Aligned global threshold limits (including Noise at 55 dB) and added support for smooth progressive chart panning.            |
| `v1.1.0`         | `>= v1.0.0`     | **Compatible**       | No breaking API changes in backend `v1.1.0`. Frontend `v1.1.0` is compatible with both backend `v1.0.0` and `v1.1.0`.         |
| `v1.0.0`         | `v1.0.0`        | **Compatible**       | Initial production release.                                                                                                   |

---

## Documentation Index
Detailed documentation for specific modules can be found in the `docs/` folder:

*   **[Setup & Installation](./SETUP_GUIDE.md)**: How to run the app locally.
*   **[MQTT & Telemetry](./docs/MQTT_TELEMETRY.md)**: Topics, payloads, and device integration.
*   **[Alerts & Notifications](./docs/ALERTS_NOTIFICATIONS.md)**: Logic behind automated alerts.
*   **[Admin API](./docs/ADMIN_API.md)**: Endpoints for device/user management.
*   **[Auth API](./docs/AUTH_API.md)**: Login, registration, and session management.

---

## Features

### 1. Real-Time Telemetry
Ingests data from AQM devices via MQTT specific topics.
- **Protocol**: MQTT
- **Data**: PM2.5, PM10, CO2, TVOC, Temperature, etc.

### 2. Admin Control
Admins can:
- **Provision Devices**: Create new device IDs in the system.
- **Manage Users**: View user stats and **Restrict (Ban)** malicious users instantly.
- **Audit**: View system-wide event logs.

### 3. User Dashboard Support
- **Historical Data**: Efficient storage of time-series telemetry.
- **Thresholds**: Users can set custom limits for alerts.
- **Notifications**: In-app and validatable notification system.

---

## Quick Start
```bash
$ pnpm install
$ npx prisma migrate dev
$ pnpm run start:dev
```
