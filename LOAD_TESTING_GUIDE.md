# GBI Load Testing & Simulation: Operational Guide

Follow these steps to repeat the 100-device / 500-RPS simulation and monitoring.

## 1. Start the Infrastructure (Docker)
Ensure Docker Desktop is running, then open a terminal in `gbi-backend` and run:
```powershell
docker-compose -f monitoring/docker-compose.yml up -d
```
*   **Grafana**: http://localhost:3000 (admin/admin)
*   **Prometheus**: http://localhost:9090

## 2. Start the Backend & Frontend
Open two separate terminals:
*   **Terminal A (Backend)**: `cd gbi-backend && npm run start:dev`
*   **Terminal B (Frontend)**: `cd frontend && npm run dev`

## 3. Seed Testing Devices (Optional)
If you need to create/re-assign the 100 simulated devices to your account:
```powershell
node scripts/setup-sim-devices.js
```

## 4. Launch the Device Simulator (The "Writers")
This script makes the hardware "alive" by sending MQTT telemetry for 100 devices at 500 msgs/sec:
```powershell
node scripts/master-simulator.js
```

## 5. Launch the Load Test (The "Readers")
This simulates 500 users hitting the API and Dashboard simultaneously:
```powershell
Get-Content test/load/load-test.js | docker run --rm -i grafana/k6 run -
```

## 6. Monitor Results
*   **Visual Check**: Open `http://localhost:3001/dashboard` to see graphs moving.
*   **System Health**: Open `Explore` in Grafana and query `process_cpu_seconds_total` to see the server load.
*   **Final Report**: When the `k6` command (Step 5) finishes, look at the summary in the terminal for `http_req_duration`.

---

### Key Troubleshooting
*   **"No Data" in Grafana**: Check the **Instance** dropdown at the top and select `host.docker.internal:4000`.
*   **"Connection Refused" in k6**: Ensure you ran k6 with `-e TARGET_URL=http://host.docker.internal:4000` to hit your local machine.
*   **"Offline" Devices**: Ensure the `master-simulator.js` is running and your backend shows `MQTT Connected`.
