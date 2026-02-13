# Staged Implementation Plan - GBI Backend

**Goal:** systematic implementation of "Revised PRD" features, prioritizing Core Logic and Stability.

## Stage 1: Core Thresholds & Groups (High Priority)
**Objective:** Clean up old code, fix security holes, and establish the "Single Source of Truth" for thresholds.

### 1.1 Cleanup Old Logic
- **[DELETE]** `AlertThreshold` model from `schema.prisma`.
- **[DELETE]** Remove all code referencing `AlertThreshold` (Service/Controller).
- **[VERIFY]** Ensure `DeviceThreshold` and `GroupThreshold` (JSON models) are the ONLY way to set limits.

### 1.2 Fix Device Group Security
- **[MODIFY]** `GroupsService.addDeviceToGroup`:
    - **Step 1:** fetch `DeviceAssignment` for the `userId` and `deviceId`.
    - **Step 2:** IF no active assignment found -> Throw `ForbiddenException("You do not own this device")`.
    - **Step 3:** Proceed to add to group.

### 1.3 Enforce Mutex Logic (One Threshold Rule)
- **[MODIFY]** `GroupsService.addDeviceToGroup`:
    - Ensure device has NO individual `DeviceThreshold` before adding.
- **[MODIFY]** `DevicesService.setDeviceThreshold`:
    - Ensure device is NOT in a Group (`groupId` is null) before setting.

## Stage 2: Alerting Engine & Notifications
**Objective:** robust event generation and real-time delivery tailored for 1-minute intervals.

### 2.1 Alert Evaluation Logic
- **[MODIFY]** `AlertsService.evaluate`:
    - Triggered on data ingestion (every 1 min).
    - **Step 1:** Check if Device has `DeviceThreshold`. IF YES -> Use it.
    - **Step 2:** ELSE Check if Device has `groupId` -> Fetch `GroupThreshold`. IF YES -> Use it.
    - **Step 3:** Compare values.
    - **Step 4:** IF Breach -> Call `triggerEvent`.

### 2.2 Event & Notification Creation
- **[IMPLEMENT]** `triggerEvent(deviceId, param, value, type)`:
    - Create `EventLog` (Database).
    - Create `Notification` (Database).
    - **[NEW]** Emit via SSE (Server-Sent Events) to frontend.

### 2.3 SSE Implementation (No WebSockets)
- **[NEW]** `src/realtime/sse.controller.ts`:
    - Endpoint: `GET /events/stream`.
    - Logic: Keep connection open, push new `Notification` objects as they are created.

## Stage 3: Subscriptions (Golden Crown)
**Objective:** Monetization features.

### 3.1 Schema Updates
- **[MODIFY]** `User` model:
    - Add `subscriptionType` (BASIC/PREMIUM).
    - Add `subscriptionExpiresAt`.

### 3.2 Access Control
- **[NEW]** `SubscriptionGuard`:
    - usage: `@UseGuards(SubscriptionGuard)` on premium endpoints.

## Stage 4: Admin Features (Lower Priority)
**Objective:** Admin tools.

### 4.1 Bulk Upload
- **[NEW]** `POST /admin/devices/bulk`:
    - accepts Excel/CSV.
    - Parses and creates devices.

### 4.2 User Management
- **[NEW]** Admin endpoints to manually set Subscription status.

## Stage 5: Reports (Lower Priority)
**Objective:** Exporting data.

### 5.1 PDF Generation
- **[NEW]** `pdfkit` integration for Report endpoints.
