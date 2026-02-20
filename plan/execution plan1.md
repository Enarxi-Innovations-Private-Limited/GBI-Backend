Understood. We are tightening the belt. To hit a **12-day delivery window**, we will aim for a **10-day "Development Complete"** milestone, leaving the final 2 days as your 20% "safety margin" for bug fixing, final environment tweaks, and unforeseen blockers.

Here is your high-velocity, 12-day GBI Implementation & Deployment Plan.

---

## 1. GBI Backend & Integration: 12-Day Sprint Map

| Phase | Days | Focus | Key Deliverables |
| --- | --- | --- | --- |
| **Phase 1: Hardening** | 1–2 | Backend Gaps & Validation | Pincode validation, Admin Dash tiles, Excel Bulk Upload API. |
| **Phase 2: Business** | 3–5 | Subscription & Reporting | PDF Engine (Reports), Subscription Schema, Premium Guards. |
| **Phase 3: Connect** | 6–8 | Frontend & E2E Integration | UI-to-API binding, WS reconnection logic, Subscription UI locks. |
| **Phase 4: Deploy** | 9–10 | DigitalOcean Production | Droplet setup, Nginx, SSL, PM2, Manual Deploy script. |
| **Phase 5: Margin** | 11–12 | **Buffer / QA / Go-Live** | Final UAT, Bug squashing, Database backups, DNS pointing. |

---

## 2. Detailed Daily Breakdown

### Days 1–2: Backend Gaps & Admin Power Tools

* **Validation:** Update `ClaimDeviceDto` for strict 6-digit numeric Pincodes.
* **Admin Tiles:** Create `GET /admin/stats` to return total devices, online/offline counts, and active warnings.
* **Bulk Upload:** Implement `POST /admin/devices/bulk` (using `exceljs`) to allow admins to register multiple device IDs via spreadsheet.

### Days 3–5: The Revenue & Reporting Engine

* **Schema Update:** Add `subscriptionType` (BASIC/PREMIUM) and `premiumExpiresAt` to the User model.
* **PDF Service:** Integrate `pdfkit` to generate the GBI-branded PDF report (Logo + Telemetry table).
* **Access Control:** Build the `@PremiumOnly()` decorator. Apply it to the Reporting and advanced History endpoints.
* **Automation:** Set up a simple Cron job (using `node-cron`) to check for expired subscriptions daily.

### Days 6–8: Frontend Fusion & Real-Time Resiliency

* **API Integration:** Connect the React/Vue frontend to the new Admin stats and Bulk Upload screens.
* **Subscription UI:** Implement "Premium Only" overlays or disabled states for Basic users.
* **WebSocket Hardening:** Add "Auto-Reconnect" logic to the frontend to ensure the live dashboard stays live if the internet flickers.
* **Reporting UI:** Connect the "Download PDF" button to the new backend stream.

### Days 9–10: DigitalOcean "Hard Launch"

* **Droplet Provisioning:** Setup Ubuntu, Node.js, Database (Postgres/Mongo), and MQTT Broker.
* **Process Management:** Deploy code and manage with **PM2** (`pm2 start dist/main.js`).
* **Web Server:** Configure **Nginx** as a reverse proxy for Port 80/443. Install **SSL** via Certbot.
* **Deployment Script:** Create a `deploy.sh` script:
```bash
git pull origin main && npm install && npm run build && pm2 restart GBI-Backend

```



### Days 11–12: The Safety Margin (10% + Buffer)

* **Testing:** Final walk-through of the user journey (Signup -> Claim -> View Live Data -> Download Report).
* **Security Audit:** Enable **UFW** (Firewall), check CORS settings, and hide all `.env` secrets.
* **Production Handover:** Finalize documentation for the manual deployment process.

---

## 3. Critical Production Checklist (The "Must-Haves")

Since we are skipping CI/CD for now, these **Manual Production** steps are mandatory:

* **[ ] Security:** Ensure the MQTT broker is password-protected and not open to the public.
* **[ ] Stability:** Set up PM2 to "autostart" on server reboot (`pm2 save` and `pm2 startup`).
* **[ ] Backups:** Manually trigger a DB dump before the final Day 12 handover.

---

**Next Step:**
To stay on track for Day 1, would you like me to provide the **strict 6-digit Pincode validation logic and the Admin Stats endpoint code** right now?