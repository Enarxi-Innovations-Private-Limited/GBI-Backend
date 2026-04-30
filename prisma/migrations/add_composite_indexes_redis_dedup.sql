-- ============================================================
-- GBI Backend — Production Index Migration
-- Filename: add_composite_indexes_redis_dedup.sql
--
-- INSTRUCTIONS: Run in your Postgres client while the SSH tunnel
-- is active (localhost:5555 → DB). All indexes use CONCURRENTLY
-- so there is ZERO table lock — safe to run on live production.
--
-- Run time estimate (existing DB size):
--   Small DB (< 1M rows):  ~5–30 seconds per index
--   Large DB (10M+ rows):  ~2–10 minutes per index (runs in background)
--
-- NOTE: CONCURRENTLY cannot run inside a transaction block.
--       Run this file as plain SQL, not inside BEGIN...COMMIT.
-- ============================================================

-- ─── 1. Device table ───────────────────────────────────────────────────────

-- Replaces full table scan in OfflineDetectorService.checkOfflineDevices()
-- and all admin device filtering queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Device_isDeleted_status_idx"
  ON "Device" ("isDeleted", status);

-- Enables heartbeat cutoff comparison in offline detector to use B+ tree range scan
-- instead of sequential scan across the entire Device table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Device_isDeleted_lastHeartbeatAt_idx"
  ON "Device" ("isDeleted", "lastHeartbeatAt");

-- Fixes the correlated subquery in AlertsRepository.getGroupThresholdByDevice().
-- With this index, the join Device->GroupThreshold is O(log N) not a full table scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Device_groupId_idx"
  ON "Device" ("groupId");

-- ─── 2. DeviceAssignment table ─────────────────────────────────────────────

-- PARTIAL INDEX: only indexes ACTIVE assignments (unassignedAt IS NULL).
-- A device with 50 historical assignments now costs O(log M) where M = active count (usually 1).
-- This is the most impactful single index in the system for the claim/unclaim hot path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeviceAssignment_active_deviceId_idx"
  ON "DeviceAssignment" ("deviceId")
  WHERE "unassignedAt" IS NULL;

-- Drop the old wide index on deviceId alone (superseded by the partial index above)
DROP INDEX CONCURRENTLY IF EXISTS "DeviceAssignment_deviceId_idx";

-- Add the combined index covering both FK and active-assignment filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeviceAssignment_deviceId_unassignedAt_idx"
  ON "DeviceAssignment" ("deviceId", "unassignedAt");

-- ─── 3. UserDevice table ───────────────────────────────────────────────────

-- CRITICAL: Previously NO index on userId existed!
-- Every call to getUserDevices(), reports, event log meta fetch, and admin panel
-- was a FULL TABLE SCAN on UserDevice. At 100K users × 5 devices = 500K row scans
-- on every single API call that needs device metadata.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserDevice_userId_idx"
  ON "UserDevice" ("userId");

-- Covering index for the most common 2-field filter (userId + deviceId lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserDevice_userId_deviceId_idx"
  ON "UserDevice" ("userId", "deviceId");

-- ─── 4. EventLog table ─────────────────────────────────────────────────────

-- Replace two narrow single-column indexes with two composite covering indexes.
-- These cover WHERE + ORDER BY for both dashboard queries and alert cooldown checks.

-- Drop old narrow indexes
DROP INDEX CONCURRENTLY IF EXISTS "EventLog_deviceId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "EventLog_userId_idx";

-- New composite: device event timeline (alert cooldown check, device event feed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EventLog_deviceId_eventType_createdAt_idx"
  ON "EventLog" ("deviceId", "eventType", "createdAt" DESC);

-- New composite: user event timeline (dashboard ONLINE/OFFLINE + ALERT feed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EventLog_userId_eventType_createdAt_idx"
  ON "EventLog" ("userId", "eventType", "createdAt" DESC);

-- ─── 5. Notification table ─────────────────────────────────────────────────

-- Enables ORDER BY createdAt DESC with no in-memory sort (covers the filter + sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt" DESC);

-- ─── 6. AlertState table ───────────────────────────────────────────────────

-- Alert resolution queries filter by (deviceId, state='ALERTING')
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AlertState_deviceId_state_idx"
  ON "AlertState" ("deviceId", state);

-- ─── 7. PremiumSubscription table ──────────────────────────────────────────

-- Drop separate narrow indexes (each causing a separate index scan for combined filters)
DROP INDEX CONCURRENTLY IF EXISTS "PremiumSubscription_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "PremiumSubscription_expiryDate_idx";

-- Composite covers expireOverdueSubscriptions(): WHERE status='ACTIVE' AND expiryDate < NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PremiumSubscription_status_expiryDate_idx"
  ON "PremiumSubscription" (status, "expiryDate");

-- ─── 8. User table ─────────────────────────────────────────────────────────

-- Enables expireOverdueSubscriptions() user sync step to use index scan
-- instead of full User table scan. At 1M users: crucial.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_isPremium_premiumExpiry_idx"
  ON "User" ("isPremium", "premiumExpiry");

-- ─── 9. Remove DeviceTelemetry unique constraint ───────────────────────────

-- The @@unique([deviceId, messageId]) constraint caused B+ tree write amplification
-- on EVERY telemetry insert (maintain the index + enforce uniqueness check).
-- Deduplication is now handled upstream by Redis SETNX in mqtt.consumer.ts
-- with a 5-minute TTL. The Redis gate is hit BEFORE any DB operation.
-- 
-- ONLY run this line AFTER confirming mqtt.consumer.ts is deployed with
-- the Redis dedup block (search for `dedup:${deviceId}:${payload.messageId}`).
DROP INDEX CONCURRENTLY IF EXISTS "DeviceTelemetry_deviceId_messageId_key";

-- ============================================================
-- VERIFY: After running, check indexes were created:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE '%_idx'
-- ORDER BY tablename, indexname;
-- ============================================================
