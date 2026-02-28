# GBI Backend Architecture & Deep Codebase Analysis

This document provides a comprehensive technical overview and deep dive into the GBI Backend architecture, technology stack, and systemic design patterns. It is intended for Product Managers, Engineering Leads, and new Developers to understand the structural implementation of the backend system.

---

## 1. System Overview

The GBI Backend is a high-performance, modular API built for an IoT/Dashboard ecosystem (Air Quality Monitoring) requiring real-time data processing, device management, robust user hierarchy handling, and resilient alerting.

It leverages a modern Node.js stack prioritizing speed, strict typing, and structured dependency injection.

### Technology Stack

- **Framework**: [NestJS](https://nestjs.com/) (v11)
- **HTTP/Web Server Adapter**: [Fastify](https://fastify.dev/) (Chosen for high-throughput and low overhead over Express)
- **Language**: TypeScript
- **Database**: PostgreSQL (Relational Engine)
- **ORM**: [Prisma](https://www.prisma.io/)
- **In-Memory Store / Queues**: Redis & [BullMQ](https://docs.bullmq.io/)
- **IoT Protocol**: MQTT (via `mqtt` package)
- **Authentication**: JWT, Passport.js (Local & Google OAuth2.0)
- **Emails**: SendGrid (`@sendgrid/mail`)
- **Others**: `exceljs` & `json2csv` (Reporting), `class-validator` (DTO Validation).

---

## 2. Core Architecture & Bootstrap (`src/main.ts` & `src/app.module.ts`)

The application bootstraps heavily optimized for speed via Fastify Adapter.

- **Global Pipes**: Global `ValidationPipe` is enabled to automatically validate incoming payloads against DTOs (`whitelist: true`, `forbidNonWhitelisted: true`), preventing payload pollution.
- **Fastify Plugins**: Integrates `@fastify/cookie` (signed cookies) and `@fastify/multipart` (handling file uploads up to 10MB).
- **CORS**: Enabled with `credentials: true` to support cross-origin dashboard requests.
- **Security / Rate Limiting**: Implements `@nestjs/throttler` (ThrottlerGuard) applied globally. Defaults to limiting users to 100 requests per 15-minute window per IP.

---

## 3. Database Schema & Data Modeling (`prisma/schema.prisma`)

The database uses a structured relational model tailored for multi-tenant IoT device management.

### Identity & Access Contexts

- **User**: Represents clients/customers mapping to Devices, Device Groups, and Notifications. Validations include `emailVerified`, `phoneVerified`, and `isRestricted`.
- **Admin**: Dedicated administrative context for internal dashboards.
- **RefreshToken**: Explicit schema for rotating/revoking JWT authorization safely.

### Device Management Ecosystem

- **Device**: Core IoT hardware entity. Tracks `type` (e.g., Air Quality Monitor), `status`, `lastHeartbeatAt` for liveness, and soft-delete states (`isDeleted`).
- **DeviceAssignment** / **UserDevice**: Many-to-Many mappings handling device distribution to various Users. Allows features to uniquely alias a Device per User (`name`, `location`).
- **DeviceGroup**: Allows organizing devices logicly per user, associated with its own `GroupThreshold`.

### Telemetry & Real-time Metrics

- **DeviceTelemetry**: Granular, time-series-like captures of IoT parameters (`pm25`, `pm10`, `tvoc`, `co2`, `temperature`, `humidity`, `noise`, `aqi`). Optimized with compound index on `[deviceId, timestamp]`.

### Alerting & Monitoring Logic

- **DeviceThreshold** / **GroupThreshold**: Stores flexible boundary configuration rules as `Json` payloads.
- **AlertState**: Maintains a state machine for alerting (`lastTriggeredAt`, `state`) to prevent flooding users with redundant alerts.
- **EventLog**: Audit trail for telemetry breaches, state changes, or user activities.
- **Notification**: User-facing notification dispatch entries (`isRead`, `message`).

---

## 4. Module Breakdown (Domain-Driven Design)

The backend follows NestJS's Domain-Driven Design (DDD) module structure.

### Platform Modules

1. **PrismaModule**: Global database connection pooling and query executions.
2. **RedisModule**: Configuration context for caching, rate limiting, and BullMQ task queues.
3. **MqttModule**: Essential for IoT interaction. Connects to brokers and subscribes to hardware telemetry pushes to persist into `DeviceTelemetry`.

### Business Context Modules

4. **AuthModule**: Handles `bcrypt` password hashing, Google OAuth strategies via Passport, and JWT access/refresh token issuing.
5. **UsersModule** & **AdminModule**: Isolates internal staff APIs and external client APIs. Manages assignments, profiles, and hierarchy validations.
6. **DevicesModule**: Comprehensive CRUD for hardware entities. Features liveness/heartbeat tracking and telemetry historical fetches.
7. **GroupsModule**: Handles logical boundaries of device collections and aggregates group-level boundaries.

### Realtime & Processing Modules

8. **AlertsModule**: Processing engine. It hooks into incoming telemetry data, correlates it with Device/Group `Json` Thresholds, and updates `AlertState`. High CPU footprint, heavily optimized.
9. **NotificationsModule**: External communication adapter. Connects to SendGrid to fire real-world emails based on triggers.
10. **InAppNotificationsModule**: Dispatches UI notifications to the Dashboard. Persists into the `Notification` schema.
11. **RealtimeModule**: Manages WebSockets/SSE to push live Dashboard telemetry updates bypassing standard HTTP polling.
12. **ReportsModule**: Asynchronous generation of raw telemetry/event logs into `.xlsx` (`exceljs`) and `.csv` (`json2csv`) formats.

---

## 5. Testing & Quality Assurance

- **Testing Framework**: Jest is extensively pre-configured (`moduleFileExtensions: ['js', 'json', 'ts']`, `transform: ts-jest`) for fast execution.
- **E2E Structure**: The backend embraces standard E2E testing (`test:e2e` running against `./test/jest-e2e.json`). E2E is critical for a Fastify/Prisma stack.
- **Code Quality**: Runs strict ESLint + Prettier integrations (`eslint.config.mjs`, `prettierrc`), forcing modern ECMAScript/TypeScript compilation target (`target: es2021`).

---

## 6. Deployment & CI/CD Characteristics

- **Dockerized**: Contains a `Dockerfile` and `.dockerignore`, allowing rapid orchestration in containerized environments (Kubernetes, AWS ECS).
- **Hosting Strategy**: Features a `render.yaml` implying usage of Render.com for serverless/managed deployments with PostgreSQL bridging.
- **Package Management**: Uses PNPM (v10.27.0). Fast, disk-space efficient node_module management which is critical for CI/CD pipeline speed.

## Summary for Product Managers

The backend is aggressively modernized. The decision to use Fastify over Express indicates a focus on low-latency IoT handling. The separation of `AlertsModule`, `MqttModule`, and `RealtimeModule` proves the system is built specifically to handle concurrent WebSocket loads, millions of heartbeat telemetry rows, and decoupled notification dispatches without slowing down standard HTTP API calls. It's built for scale.
