1️⃣ High-level backend pipeline (end-to-end)
Think of your system as four pipes, not one big blob.
Air Quality Device
   ↓
MQTT Ingestion Layer
   ↓
Backend Core (validation + storage + rules)
   ↓
Realtime Distribution (WebSocket)
   ↓
Frontend Dashboard

Each pipe has one responsibility.

2️⃣ Device → MQTT → Backend (clean, scalable design)
2.1 How devices send data (MQTT topic design)
❌ Bad approach (clumsy)
air-quality/data

All devices dump data into one topic → chaos, filtering, scaling pain.

✅ Recommended approach (industry standard)
One topic namespace, one device per topic
gbi/aqm/{deviceId}/telemetry
gbi/aqm/{deviceId}/heartbeat

Example
gbi/aqm/AQM-102938/telemetry
gbi/aqm/AQM-102938/heartbeat

This gives you:
Clean separation
Easy filtering
Horizontal scalability
Debugging clarity
👉 Rule: One device = one topic path

2.2 What device sends (payload contract)
Devices send simple JSON, nothing fancy.
{
  "pm25": 45,
  "pm10": 80,
  "co2": 620,
  "tvoc": 120,
  "temperature": 26.5,
  "humidity": 58,
  "noise": 42
}

❗ Device does not send timestamps
❗ Device does not decide alerts
👉 Server is source of truth

2.3 MQTT ingestion service (backend responsibility)
Create a dedicated MQTT consumer service (even if in same codebase).
Responsibilities
Subscribe to:
gbi/aqm/+/telemetry
gbi/aqm/+/heartbeat


Extract deviceId from topic
Validate payload
Attach server timestamp
Forward clean data to core backend logic
Important principle
MQTT layer does ZERO business logic
No alerts, no DB decisions — just ingestion + validation.

3️⃣ Backend core (where real logic lives)
This is your brain.
3.1 Validation pipeline (non-negotiable)
Every MQTT message passes through:
Raw MQTT payload
  ↓
Schema validation
  ↓
Type validation
  ↓
Range validation

If invalid → drop silently (no crash, no DB write).
👉 This protects you from:
Firmware bugs
Garbage data
Malicious packets

3.2 Device ownership check
After validation:
Does device exist?
Is device active?
Is device assigned to a user?
If not assigned:
Data is ignored (current scope)
No frontend update
No alerts

3.3 Storage strategy (simple now, scalable later)
Write path
Telemetry data
  ↓
Time-series table (append-only)

No updates
Only inserts
Indexed by device_id + timestamp
This works fine initially and is easy to partition later.

3.4 Alert evaluation (rule engine lite)
After storing:
New value
  ↓
Compare with user threshold
  ↓
Crossed? → trigger event

Key rules:
Trigger only on cross
No repeated alerts while staying above
Reset when value drops below
👉 Keep alert logic stateless + Redis-assisted.

4️⃣ Backend → Frontend (real-time distribution)
4.1 Why WebSockets here
Because frontend needs:
Live values
Alerts
Compare mode
Dynamic subscriptions

4.2 WebSocket room model (clean & scalable)
Use rooms, not broadcast.
user:{userId}
device:{deviceId}

Example
User connects
Backend subscribes user to:
user:123
device:AQM-102938
device:AQM-556677
Now when new telemetry arrives:
Backend emits only to relevant rooms
👉 This avoids unnecessary traffic.

4.3 What backend sends to frontend
Never send raw DB rows.
Send normalized events:
{
  "deviceId": "AQM-102938",
  "timestamp": "2025-01-12T10:22:30Z",
  "parameters": {
    "pm25": 45,
    "pm10": 80,
    "co2": 620,
    "noise": 42
  }
}

Frontend is dumb → just renders.

5️⃣ Frontend approach (how other team should work)
Even though another team handles frontend, you must align principles.
5.1 Event-driven frontend (important)
Frontend should think in events, not polling.
Examples:
telemetry_update
alert_triggered
device_offline
UI reacts to events.

5.2 API + WebSocket separation
REST APIs (request–response)
Used for:
Login
Device list
Historical data
Reports
Config changes
WebSockets (real-time)
Used for:
Live telemetry
Alerts
Status changes
👉 Never mix them

5.3 Graph rendering strategy
Frontend:
Requests historical data via REST (start/end time)
Subscribes to live updates via WebSocket
Appends new points to graph in memory
For compare:
Two device IDs
Same parameter
Two lines on same time axis
Backend doesn’t care — frontend handles visualization.

6️⃣ Team execution plan (this is crucial)
Step 1: Lock contracts FIRST
MQTT topic structure
MQTT payload schema
REST API contracts
WebSocket event shapes
📌 Write these as simple JSON contracts

Step 2: Backend first, frontend mocked
Backend exposes APIs
Backend emits WebSocket events
Use mock frontend / Postman / WS client

Step 3: Frontend develops independently
Uses API contracts
Uses WebSocket events
No backend logic duplicated

Step 4: Integrate & test with real devices
MQTT → backend → WebSocket → UI
Validate alerts & graphs

7️⃣ Why this design is minimal AND scalable
Minimal now
Single MQTT broker
Single backend service
Simple topic structure
No microservice explosion
Scalable later
MQTT topics already partitioned by device
WebSocket rooms already segmented
DB append-only design
Can split ingestion / core / WS later
👉 No rewrite needed

8️⃣ One-page mental model (remember this)
Devices publish to their own MQTT topics
Backend validates & owns truth
Alerts are server-side
WebSockets push only what user needs
Frontend reacts to events
Contracts are locked first

If you want next, I can:
Draw a sequence diagram (MQTT → DB → WS → UI)
Design exact MQTT topics + REST APIs
Create a backend folder structure
Help you write a device firmware contract
Just tell me what you want next.

