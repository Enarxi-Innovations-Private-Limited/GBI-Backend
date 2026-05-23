# PDF Generation Tech Stack & Implementation Flow

This document details the architecture, technology stack, and implementation flow for the PDF report generation system in the GBI Air Quality Monitor backend.

## 1. Technology Stack

The report generation system is built using a modern, asynchronous architecture to ensure scalability and high performance.

- **Core Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **PDF Generation Engine**: [pdfkit](https://pdfkit.org/)
  - Chosen for its low-level control over layout, vector graphics, and text positioning.
  - Allows custom drawing for headers, footers, and complex table structures.
- **Background Job Queue**: [BullMQ](https://docs.bullmq.io/) with Redis
  - Handles PDF generation in the background to avoid blocking the main API thread.
  - Configured with optimized polling (drain delay) to minimize Redis request costs (specifically for Upstash Redis limits).
- **Database**: [Prisma](https://www.prisma.io/) (PostgreSQL)
  - Manages report metadata, job statuses, and device ownership validation.
- **Data Retrieval**: Raw SQL (via Prisma)
  - Uses time-bucketed aggregation for high-performance retrieval of large telemetry datasets.
- **Storage**: Local Filesystem (Phase 1) / S3 (Phase 2)
  - Currently saves generated files to a `generated-reports` directory.

---

## 2. Implementation Flow

The system follows a 4-phase asynchronous flow to provide a smooth user experience while handling CPU-intensive tasks.

### Phase 1: Request & Enqueueing
1. **API Call**: The client sends a `POST /reports/pdf` request with filters (`deviceId`, `start`, `end`, `interval`, and `parameters`).
2. **Validation**: The `ReportsService` verifies if the user owns the device and if the date range is valid.
3. **Job Creation**:
   - A unique `jobId` (UUID) is generated.
   - A job is added to the BullMQ `reports` queue.
   - A record is created in the `GeneratedReport` table with a 24-hour expiration.
4. **Immediate Response**: The server returns the `jobId` to the client immediately (HTTP 201).

### Phase 2: Background Processing
1. **Worker Pickup**: The `ReportsProcessor` picks up the job from the Redis queue.
2. **Data Aggregation**:
   - `TelemetryQueryService` executes a bucketed SQL query to fetch data points based on the requested interval (e.g., 5 min, 1 hour).
   - Data is converted to the IST timezone and rounded for readability.
3. **PDF Construction (`PdfService`)**:
   - **Header**: Draws the company logo, report title, and date range.
   - **Watermark**: Adds a professional, low-opacity logo in the center of every page.
   - **Table**: Iterates through telemetry rows, drawing cells with borders and properly formatted units (e.g., µg/m³, ppm, °C).
   - **Footer**: Adds a "Generated on" timestamp and page numbers.
   - **Pagination**: Automatically handles page breaks by calculating remaining vertical space.
4. **Storage**: The final PDF buffer is written to the `generated-reports/` folder.
5. **State Update**: The database record is updated with the `fileKey` (logical path), marking the report as `completed`.

### Phase 3: Status Polling
1. **Polling**: The client periodically calls `GET /reports/status/:jobId`.
2. **Status Check**: The service checks BullMQ and the database to report the current state (`waiting`, `active`, `completed`, or `failed`).

### Phase 4: Download
1. **Download Request**: Once completed, the client calls `GET /reports/download/:jobId`.
2. **Streaming**: The `ReportsController` verifies ownership, sets the `Content-Type` to `application/pdf`, and uses `createReadStream` to pipe the file directly to the client's browser.

---

## 3. Key Design Features

- **Professional Aesthetics**: Custom font sizes, bold headers, and glassmorphic-inspired spacing.
- **Performance**: PDF generation is CPU-bound; the processor is limited to a concurrency of 2 to prevent system starvation.
- **Cost Optimization**: Custom BullMQ configuration (`drainDelay: 10000`, `stalledInterval: 60000`) reduces Redis operations by over 90% during idle periods.
- **Scalability**: Decoupling the API from the worker allows the background processing to be scaled independently of the web server.
