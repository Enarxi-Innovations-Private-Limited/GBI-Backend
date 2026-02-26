GBI IoT Platform – Post-Schema Stabilization Roadmap

✅ Current System Status (Baseline Locked)

The platform has successfully achieved:

Drift-free Prisma migration history

Clean baseline migration

PostgreSQL native ENUM enforcement (DeviceStatus)

Idempotent telemetry ingestion (@@unique(deviceId, messageId))

Shared MQTT subscription for horizontal scaling

Atomic Prisma $transaction for ingestion

Stateless offline detection scheduler

Redis latest snapshot caching

Clean DB state with validated ENUM casting

Schema phase is complete.
Further schema modifications should be minimized.

🚀 Phase 1 — Observability & Monitoring (Immediate Next Step)

Before scaling further, visibility must be implemented.

1.1 Add Telemetry Counters

Track:

telemetry_received_total

telemetry_insert_success_total

telemetry_duplicate_total

telemetry_rejected_missing_messageId_total

device_marked_offline_total

scheduler_execution_total

Can start with structured logs, later integrate Prometheus.

1.2 Add Health Check Endpoint

Create /health endpoint to verify:

DB connectivity

Redis connectivity

MQTT connection status

Scheduler active status

1.3 Add Structured Logging

Replace raw console logs with structured logging:

Include deviceId

Include messageId

Include event type

Include timestamp

🧪 Phase 2 — Load & Stress Testing

Gradual scaling validation.

2.1 Load Stages

100 devices

1,000 devices

5,000 devices

10,000 devices (if applicable)

2.2 Monitor During Load

Track:

CPU usage

Memory usage

Node event loop lag

PostgreSQL connection pool usage

Redis latency

Duplicate rejection count

Scheduler execution time

2.3 Validate Under Multi-Instance Setup

Run:

2 backend instances

3 backend instances

Confirm:

No duplicate DB rows

Proper load balancing via $share

No race condition issues

⚙ Phase 3 — Database Performance Optimization
3.1 Query Analysis

Run:

EXPLAIN ANALYZE
SELECT *
FROM "DeviceTelemetry"
WHERE "deviceId" = ?
ORDER BY "timestamp" DESC
LIMIT 1;

Ensure index usage.

3.2 Confirm Index Coverage

Recommended indexes:

@@index([deviceId, timestamp])

@@index([lastHeartbeatAt])

Unique: @@unique([deviceId, messageId])

3.3 Connection Pool Hardening

Ensure Prisma pool settings are tuned for:

Expected device scale

Instance count

Neon connection limits

🔁 Phase 4 — Failure Simulation

Test resilience.

4.1 Kill Backend Mid-Transaction

Verify:

No partial writes

No inconsistent device state

4.2 Kill Redis

Verify:

DB ingestion unaffected

System continues operating

Snapshot recovery works

4.3 Kill One Instance

Verify:

Shared subscription redistributes load

No ingestion gap

4.4 Duplicate Storm Simulation

Send repeated same messageId.

Verify:

Only one DB insert

Others rejected via P2002

🔐 Phase 5 — Production Hardening
5.1 Graceful Shutdown

Ensure:

MQTT disconnect clean

Scheduler interval cleared

Redis connections closed

Prisma disconnect called

5.2 Add Rate Limiting (Security)

Protect:

Auth endpoints

Password reset

OTP endpoints

5.3 Alerting & Monitoring

Integrate:

Uptime monitoring

DB slow query alerts

Redis memory alerts

Crash reporting

🏗 Phase 6 — Architecture Scaling Plan

If targeting >10k devices:

Consider:

Dedicated ingestion service

Separate read-replica DB

Kafka (future)

Telemetry table partitioning

Cold storage archival

📦 Phase 7 — Data Lifecycle Strategy

Define:

Telemetry retention period

Archival strategy

Aggregation tables

Cleanup jobs

📈 Phase 8 — Analytics Layer (Future)

AQI aggregation per hour/day

Trend analysis

Device reliability metrics

Warning frequency tracking

🚫 Rules Going Forward

Never use prisma db push in shared environments

Always use migrations

Do not manually alter DB without migration

Never mark migration as applied unless SQL executed

Do not change schema casually

🎯 Immediate Next Action

Start with:

Observability metrics

1,000 device load test

Performance validation

Schema modifications are complete.