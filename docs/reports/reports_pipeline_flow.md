# GBI Air Quality Monitor - Report Generation Pipeline

This document explains the technical details of the asynchronous PDF and CSV report generation pipeline, detailing how frontend requests, BullMQ jobs, Redis queues, background worker tasks, and client-side downloads interact.

---

## 1. Pipeline Architecture Overview

The GBI platform handles report generation asynchronously. Since compiling months of telemetry and rendering high-resolution PDFs is CPU-heavy and database-intensive, processing this synchronously would block the main API server and lead to gateway timeouts.

Instead, GBI uses **BullMQ** (powered by **Redis**) to manage an asynchronous job queue.

```
+------------------+     POST /reports/pdf     +--------------------+
|  Frontend UI     | ------------------------> |  NestJS API Server |
|  (User Dashboard)| <------------------------ |  (Fastify Router)  |
+------------------+       Returns Job ID      +--------------------+
        ^                                                |
        |                                                v Enqueue Job
        |                                      +--------------------+
        |                                      |    Upstash Redis   |
        |                                      |  ("reports" queue) |
        |                                      +--------------------+
        |                                                |
        | Poll status (2s) / SSE                         v Dequeue Job
        |                                      +--------------------+
        |                                      | NestJS Worker Host |
        |                                      | (ReportsProcessor) |
        |                                      +--------------------+
        |                                                |
        |                                                v Queries & Generates
        |                                      +--------------------+
        |                                      | PostgreSQL & Disk  |
        |                                      | (PDF/CSV Output)   |
        |                                      +--------------------+
        |                                                |
        |           GET /reports/download/:id            |
        +------------------------------------------------+
```

---

## 2. Step-by-Step Execution Lifecycle

### Step 1: User Configures & Requests Report
The user goes to the **Reports Page** on the dashboard and selects:
1. **Device**: The target device serial/UUID.
2. **Parameters**: Environmental metrics to include (AQI, PM2.5, PM10, CO2, TVOC, Temp, Humidity, Noise).
3. **Time Range**: Start date/time and End date/time.
4. **Data Interval**: Averaging buckets (e.g., 1 minute, 5 minutes, 1 hour).
5. **Format**: **CSV** or **PDF**.

When they click **Generate Report**, the frontend submits an authenticated `POST` request to the backend:
* **CSV Endpoint**: `POST /reports/csv`
* **PDF Endpoint**: `POST /reports/pdf`
* **Query Params / Body**: `deviceId`, `start`, `end`, `intervalMinutes`, `parameters`

---

### Step 2: Validation & Enqueueing (NestJS API)
Upon receiving the request, the backend [ReportsController](file:///d:/Users/chellakkumar/D-Documents/Enarxi/GBI/Air%20Quality%20Monitor/gbi-backend/src/reports/reports.controller.ts):
1. Validates that the user is authenticated (JWT Auth Guard) and has **Premium** tier status (Premium Guard).
2. Delegates to [ReportsService.enqueueReport()](file:///d:/Users/chellakkumar/D-Documents/Enarxi/GBI/Air%20Quality%20Monitor/gbi-backend/src/reports/reports.service.ts#L39-L79):
   * Validates device ownership: checks that the device exists and is currently assigned to the user.
   * Generates a unique `jobId` UUID to identify the job.
   * Adds the job to the **BullMQ** `reports` queue on Redis:
     ```typescript
     const job = await this.reportsQueue.add(type, { type, userId, dto }, { jobId });
     ```
   * Creates a tracking metadata record in the database using the Prisma `GeneratedReport` model.
   * Immediately returns the `{ jobId }` back to the frontend with an HTTP 201 response.

---

### Step 3: Asynchronous Background Processing (BullMQ Worker)
On the backend, a background NestJS worker thread ([ReportsProcessor](file:///d:/Users/chellakkumar/D-Documents/Enarxi/GBI/Air%20Quality%20Monitor/gbi-backend/src/reports/reports.processor.ts)) runs continuously, listening for new jobs in the `reports` queue on Redis.

1. **Job Pickup**: The worker grabs the job from the Redis queue.
2. **Querying Database**: The worker queries the historical telemetry database using time-bucketing SQL (managed by `TelemetryQueryService`). This aggregates raw device data points into the requested intervals (e.g. 5-min averages).
3. **File Compilation**:
   * **CSV Generation**: The worker formats the dataset into a custom tabular CSV structure, adding user-defined device metadata and location metrics into the header rows.
   * **PDF Generation**: The worker calls `PdfService` (which uses `PDFKit` under the hood) to construct a professional, branded PDF layout, including watermarks, headers, structured tables, and page footers.
4. **File Persistence**: The resulting buffer is written to local storage under `generated-reports/[jobId].[csv|pdf]`.
5. **Marking Database Completed**: The worker updates the `GeneratedReport` record in PostgreSQL with status `'completed'` and writes the logical `fileKey` (e.g. `reports/[jobId].[csv|pdf]`).

---

### Step 4: Completion Notification (SSE Stream vs Polling)

#### Option A: HTTP Polling (Active Frontend Implementation)
In [page.js](file:///d:/Users/chellakkumar/D-Documents/Enarxi/GBI/Air%20Quality%20Monitor/GBI/src/app/dashboard/reports/page.js#L184-L193), the frontend tracks the progress of the job by periodically querying the backend status endpoint:
```javascript
let status = "processing";
while (status === "processing") {
  await new Promise((resolve) => setTimeout(resolve, 2000)); // wait 2s
  const statusRes = await apiClient.get(`/reports/status/${jobId}`);
  status = statusRes.data.status;
}
```
If the status returns `'completed'`, the UI transitions from "generating" to "downloading" and triggers the file fetch.

#### Option B: Server-Sent Events (SSE) Stream (Alternative / Push Approach)
Instead of hammering the server with status checks every 2 seconds, we can notify the user via the established **SSE stream**.
1. **Frontend SSE Request**:
   During initial app mount, the frontend connects to the backend SSE endpoint via the `useSSE` hook:
   * **Endpoint**: `GET https://api.gbiair.in/events/stream`
   * The connection is kept open indefinitely by sending periodic `: heartbeat\n\n` comments from the server.
2. **Backend Broadcast**:
   Once the `ReportsProcessor` successfully writes the file, it calls:
   ```typescript
   this.sseService.sendEvent(job.data.userId, {
     type: 'NOTIFICATION',
     eventType: 'REPORT_COMPLETED',
     data: { jobId: job.id, fileKey: fileKey }
   });
   ```
3. **Frontend SSE Receiver**:
   The open SSE stream catches the `REPORT_COMPLETED` message frame. The `useSSE` hook parses the JSON payload and triggers the file download automatically.

---

### Step 5: Secure File Retrieval (Fetch + Blob Technique)

To secure the reports, the download endpoint (`GET /reports/download/:jobId`) requires a valid user session. A standard `<a href="...">` link fails here because the browser does not attach custom Authorization headers to native links.

We solve this using the **Fetch + Blob** download technique:

```javascript
// 1. Fetch the binary stream with auth cookies/headers attached
const response = await apiClient.get(`/reports/download/${jobId}`, {
  responseType: "blob", // Instruct Axios to parse response as a Binary Blob
});

// 2. Wrap the binary data in a Javascript Blob object
const blob = new Blob([response.data], {
  type: response.headers["content-type"] || "application/octet-stream",
});

// 3. Create a temporary local URL pointing to the Blob object in browser memory
const downloadUrl = window.URL.createObjectURL(blob);

// 4. Create a hidden <a> tag, assign the local URL to it, and simulate a click
const link = document.createElement("a");
link.href = downloadUrl;

// Extract filename from response Content-Disposition header
let finalFilename = `report-${jobId}.${format}`;
const disposition = response.headers["content-disposition"];
if (disposition && disposition.indexOf("attachment") !== -1) {
  const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
  if (matches != null && matches[1]) {
    finalFilename = matches[1].replace(/['"]/g, "");
  }
}
link.download = finalFilename;

// 5. Trigger download and clean up browser memory
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
window.URL.revokeObjectURL(downloadUrl); // Free up browser memory allocation
```

This ensures the report download is completely secure, verified, and handles errors (e.g. an expired report link) gracefully inside the user interface.
