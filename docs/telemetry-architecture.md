# GBI IoT Platform – Telemetry & State Architecture

This document details the production ingestion architecture, device lifecycle, and database stabilization mechanisms for the GBI Air Quality Monitor backend. It establishes the technical reasoning behind key design choices to guarantee idempotency, horizontal scalability, and zero-data-loss observability.

## 1️⃣ Overview

The ingestion architecture is designed to handle high-frequency MQTT telemetry across multiple horizontally scaled NestJS backend instances without introducing race conditions, duplicate database entries, or memory leaks.

**High-Level Flow Diagram:**

```text
    [ IoT Hardware ]
          │
          ▼
    [ EMQX Broker ] ──► (Shared Subscription $share/gbi_backend/telemetry)
          │
      MQTT Payload
          │
          ▼
 ┌────────────────────────┐
 │      NestJS Core       │
 │     (MqttConsumer)     │
 └────────┬───────────────┘
          │ 1. Validate 'messageId' presence
          │ 2. Execute Idempotent Prisma $transaction
          ▼
   ┌───────────────┐
   │ SQLite/Neon   │ ◄──── (Unique DB Constraint P2002 ignores parallel dups)
   └───────┬───────┘       (Inserts Telemetry & Updates DeviceStatus)
           │
           │ 3. On successful atomic DB commit
           ▼
       ┌───────┐
       │ Redis │ ◄─────── (Caches latest state with 2x dynamic offline TTL)
       └───────┘

============================================================
              Background High-Precision Scheduler
============================================================
 [ @nestjs/schedule (SchedulerRegistry) ]
          │
          │ Runs every (DEVICE_TELEMETRY_INTERVAL_SECONDS / 2)
          ▼
   ┌───────────────┐
   │ SQLite/Neon   │ ◄──── Finds devices where lastHeartbeatAt < cutoff
   └───────┬───────┘       Updates to DeviceStatus.OFFLINE natively
           │
           ▼
   ┌─────────────────┐
   │ RealtimeService │ ◄─ Emits 'offline' through WebSockets
   └─────────────────┘
```

## 2️⃣ Shared Subscription Architecture

The platform relies on EMQX shared subscriptions (`$share/gbi_backend/telemetry`) to distribute incoming MQTT messages across all active NestJS instances in a load-balanced round-robin fashion.

- **Horizontal Scaling:** By using the `$share` prefix, EMQX ensures that a single telemetry payload is delivered to exactly one backend node computationally, rather than broadcasting the same payload to every node.
- **Duplicate Possibility:** EMQX guarantees "at least once" delivery under QoS 1. Network stutters, broker failovers, or client disconnects can result in EMQX redelivering the exact same payload a second time.
- **Database Uniqueness Requirement:** Because of QoS 1 redeliveries, the distribution layer is not inherently idempotent. A database-level unique constraint (`@@unique([deviceId, messageId])`) is strictly required to prevent redeliveries from becoming duplicate database records.
- **Clean Sessions:** The MQTT connection uses `clean: true`. This ensures that if a backend node crashes, the broker drops its specific session queue, allowing the `$share` group to organically route pending messages to surviving nodes without storing stale data locally.
- **Client ID Uniqueness:** Each backend node dynamically generates a distinct MQTT `clientId` (e.g., using `uuid` or process IDs) so the broker identifies them as unique workers within the shared subscription pool.

## 3️⃣ Idempotent Telemetry Ingestion

The telemetry ingestion path is strictly idempotent. Processing the exact same payload multiple times results in only one database change.

- **`@@unique([deviceId, messageId])` Constraint:** The Prisma schema enforces uniqueness at the PostgreSQL execution level.
- **Prisma P2002 Handling:** When a duplicate payload arrives, `prisma.deviceTelemetry.create` throws a `PrismaClientKnownRequestError` with code `P2002`. The `MqttConsumer` explicitly catches this specific code, logs a trace message, and aborts processing smoothly.
- **Duplicate Ignorance:** Duplicates are discarded early. The system does not attempt to update the `Device` table's `lastHeartbeatAt` or push to Redis upon encountering a duplicate, saving compute and write IO per duplicate.
- **`$transaction` Usage:** Inserting the telemetry payload and updating the parent device's status and `lastHeartbeatAt` timestamp are wrapped inside a `prisma.$transaction`.
- **Atomic Updates:** Wrapping them ensures that if the telemetry insert fails (e.g., due to a duplicate or network drop), the device status is not falsely updated. The state update is strictly tied to a successful, first-time telemetry ingestion.
- **Post-Commit Redis Execution:** Redis caching logic runs exclusively _after_ the Prisma transaction resolves successfully. This avoids polluting Redis with duplicate payloads or caching state for transactions that ultimately roll back.

## 4️⃣ Device Status Lifecycle

Device state transitions strictly among three defined vectors stored directly in the `Device` table.

- **ACTIVE:** All required telemetry metrics (`pm25`, `pm10`, `tvoc`, `co2`, `temperature`, `humidity`, `noise`, `aqi`) are present and non-null in the incoming payload.
- **WARNING:** The payload was successfully ingested, but one or more hardware metrics were `null` or missing, indicating a partial sensor failure.
- **OFFLINE:** The device has not transmitted a successful payload within the dynamically calculated threshold window. This is actively enforced by the background scheduler, not the ingestion path.

**Environment Variables:**

- `DEVICE_TELEMETRY_INTERVAL_SECONDS`: The expected frequency (in seconds) that hardware devices transmit telemetry.
- `DEVICE_OFFLINE_THRESHOLD_MISSES`: The number of consecutive missed intervals before a device is considered dead.

**Formula:**
`offlineTimeoutSeconds = DEVICE_TELEMETRY_INTERVAL_SECONDS * DEVICE_OFFLINE_THRESHOLD_MISSES`

## 5️⃣ Offline Detection Scheduler

The system utilizes a stateless, precise background scheduler using `@nestjs/schedule` to mark delayed devices as OFFLINE.

- **Removal of In-Memory Counters:** Legacy systems tracked node-local memory timers per device. This approach fails entirely in a horizontally scaled environment because traffic routed to Server A means Server B's local memory flags the device as offline falsely.
- **DB-Driven Timestamp Model:** The scheduler queries the singular source of truth: `Device.lastHeartbeatAt`.
- **Cutoff Calculation:** If `NOW() - offlineTimeoutSeconds > lastHeartbeatAt`, the device is updated to OFFLINE.
- **`SchedulerRegistry` Usage:** The dynamic NestJS `SchedulerRegistry` is utilized instead of raw Node `setInterval` to allow lifecycle hooks to properly attach to the frame.
- **`onModuleDestroy` Cleanup:** Exiting or reloading a module gracefully clears the specific timer reference, completely eliminating phantom execution leaks on teardown.
- **Cluster Safety:** The raw `updateMany` database query functions as an atomic lock. Multiple pods can run the same chron query concurrently; PostgreSQL's MVCC ensures only one pod successfully alters the row, preventing race conditions or duplicated WebSocket `offline` broadcasts.

## 6️⃣ PostgreSQL ENUM Enforcement

The structure of `status` was migrated from a loose string to a strongly-typed native PostgreSQL ENUM constraint.

- **TEXT → ENUM Conversion:** Loose text columns invite fatal typos (e.g., lowercase "offline" parsing logic failing against uppercase constants). The schema enforces rigid integrity at the compiler and database layer securely.
- **The Corrupted Row Blockade:** During initial schema evolution, Prisma's safety checks failed silently against the migration diff because precisely one row in the active database possessed the value `"invalid_status"`. Native Postgres casting via `USING "status"::"DeviceStatus"` aggressively aborted.
- **Sanitization:** Corrupt strings were surgically overwritten to `'OFFLINE'` to enable PostgreSQL's strict compiler to complete the ENUM cast perfectly.
- **Final Guarantee:** The PostgreSQL database engine will physically reject any `INSERT` or `UPDATE` query attempting to push an unregistered structural shape into the status column.

**Final Native ENUM:**

```prisma
enum DeviceStatus {
  ACTIVE
  WARNING
  OFFLINE
}
```

## 7️⃣ Migration Strategy & Baseline Stabilization

Database structural integrity represents the highest risk vector for production environments.

- **Migration Drift:** Drift occurs when the live database schema (e.g., altered manually or via `db push`) structurally diverges from the tracked chronological history folder (`prisma/migrations`).
- **Cause of Drift:** Overuse of `prisma db push` during staging without committing the corresponding `--name` `migrate dev` folder permanently disconnected the environment's truth vector.
- **Baseline Re-Snapshot:** To permanently eradicate the drift without losing data, the broken migration history (`_prisma_migrations` table and local folder) was wiped. A single, fresh snapshot containing the exact physical reflection of the live architecture was carved natively from a clean schema as `baseline_v2`.
- **Shadow DB Replay:** Prisma verifies migration syntax by first running the raw SQL scripts against a temporary, isolated "shadow" database. If the SQL contains toxic commands or attempts to alter missing tables, the shadow compilation crashes before it can touch production.
- **`migrate dev` vs `migrate diff`:** `dev` interactively tracks structural mutations by querying the active database vs the Prisma schema. `diff` is a lower-level command that calculates the raw physical delta between two targets offline (used to safely generate the baseline).
- **`db push` Prohibition:** `db push` forces schema matching by overwriting structure without documenting the transactional history in SQL, guaranteeing future drift. It must never be used in a deployed PostgreSQL environment.

## 8️⃣ Redis Snapshot Layer

A real-time lookup cache is utilized parallel to the main datastore to absorb extreme frontend read volumes without taxing the PostgreSQL connections.

- **Purpose:** The latest payload shape is serialized and stored natively in Redis to instantly service high-frequency React frontend requests without executing an expensive `ORDER BY timestamp DESC LIMIT 1` database query.
- **Key Format:** `device:{deviceId}:latest`
- **Dynamic TTL Construction:** The TTL is mathematically bound to `offlineTimeoutSeconds * 2`. If a device dies, the Redis key organically evaporates shortly after the device is formally marked OFFLINE, preventing the frontend from reading perpetually stale metrics.
- **Ingestion Resilience:** Redis cache setting failures are wrapped in `catch` blocks. If the Redis server crashes, PostgreSQL ingestion handles the payload successfully, and the system continues uninterrupted.

## 9️⃣ Failure Safety Guarantees

- **Duplicate Prevention:** `P2002` exact composite rejection.
- **Race Condition Mitigation:** MVCC database update locking ensures parallel ingestion nodes cannot overlap `Device` status mutations.
- **Transaction Atomicity:** `prisma.$transaction` guarantees partial metric inserts do not corrupt the lifecycle timestamp.
- **Scheduler Safety:** NestJS registry handles lifecycle booting strictly once, avoiding stack overflow overlaps.
- **Enum Safety:** Native PostgreSQL rejection bounds state strictly to 3 distinct physical variants.

## 🔟 Operational Rules Going Forward

- **Never use `prisma db push` in a shared tracking database.**
- **Always use explicit `npx prisma migrate dev --name <description>` migrations.**
- **Never use `migrate resolve --applied` arbitrarily.** Resolving blindly obscures physical differences between Prisma's expectations and reality.
- **Never manually execute DDL (`CREATE`, `ALTER`, `DROP`) via raw SQL against the production schema.** All architecture shape changes must originate from `schema.prisma`.
- **Always test migration paths using `npx prisma migrate dev --create-only`** to pre-verify SQL compilation viability within the shadow environment before execution.

## 11️⃣ Verification Checklist

If schema drift is suspected in the future, execute the following commands precisely:

1.  `npx prisma migrate status`
    - **Clean Return:** `Database schema is up to date!`
2.  `npx prisma migrate dev --name create_test --create-only`
    - **Clean Return:** Completes silently via the shadow engine and generates an empty `.sql` file, proving `schema.prisma` natively matches the live DB constraints.
3.  `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url "$DATABASE_URL"`
    - **Clean Return:** `No difference detected.`

## 12️⃣ Future Improvements

- **PostgreSQL Partitioning:** Implement time-series native table partitioning for the `DeviceTelemetry` table (e.g., partitioning vertically by month) to maintain B-Tree index efficiency querying large ingestion volumes.
- **Prometheus Integrations:** Export atomic `@nestjs/metrics` tracking exactly how many packets are handled vs duplicated per second.
- **High-Volume Load Vectors:** Scale the staging environment to 10,000 parallel WebSocket publishers to stress-test the EMQX `$share` load balancer against Prisma connection pool exhaustions.
- **Telemetry Archival Jobs:** Write a cron function to compress and migrate logs > 90 days out of `DeviceTelemetry` into an S3 raw cold storage bucket or analytical datastore to combat scaling costs.
- **Multi-tenant Scaling:** Consider logical sub-groupings or namespace clustering if tenant volumes become deeply heterogeneous.
