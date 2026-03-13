# Reports API

**Base URL:** `/reports`  
**Auth:** All endpoints require `Authorization: Bearer <accessToken>` (user JWT).

---

## Overview

The Reports module generates downloadable telemetry reports in two formats:

- **CSV** — Spreadsheet-compatible, suitable for data analysis tools.
- **PDF** — Branded, print-ready report with GBI headers and company info.

> **Ownership Enforcement:** Only devices actively assigned to the requesting user can be included in a report. Unauthorized device IDs return `403 Forbidden`.

> **Frontend Implementation:** For details on how the frontend should securely download these asynchronously generated files once they are ready, please see the [**Async Download Guide**](./reports/ASYNC_DOWNLOAD_GUIDE.md).

---

## Shared Query Parameters

Both `/reports/csv` and `/reports/pdf` accept the same query parameters:

| Parameter         | Type              | Required | Description                                                   |
| ----------------- | ----------------- | -------- | ------------------------------------------------------------- |
| `deviceIds`       | `string[]`        | ✅       | One or more Device IDs to include (repeat param for multiple) |
| `start`           | ISO 8601 datetime | ✅       | Report start time (e.g., `2026-01-01T00:00:00Z`)              |
| `end`             | ISO 8601 datetime | ✅       | Report end time                                               |
| `parameters`      | `string[]`        | ✅       | Telemetry fields to include                                   |
| `intervalMinutes` | number            | ❌       | Time-bucket size for aggregation. Default: `5`                |

**Supported `parameters` values:**
`pm25` | `pm10` | `tvoc` | `co2` | `temperature` | `humidity` | `noise` | `aqi`

**Aggregation Logic:**  
Raw telemetry is grouped into `intervalMinutes` buckets and the **average (AVG)** for each parameter is calculated per bucket. This keeps file sizes manageable for long date ranges.

---

## Endpoints

### 1. Export CSV Report

**GET** `/reports/csv`

Generates and downloads a time-bucketed CSV report.

**Example Request:**

```http
GET /reports/csv?deviceIds=GBI-DEV-001&deviceIds=GBI-DEV-002&start=2026-01-01T08:00:00Z&end=2026-01-01T17:00:00Z&parameters=co2&parameters=temperature&intervalMinutes=15
Authorization: Bearer <token>
```

**Response:**

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="GBI-Air-Quality-Monitor-report.csv"`

**Example CSV Output:**

```csv
timestamp,deviceId,co2,temperature
2026-01-01T08:00:00.000Z,GBI-DEV-001,450.5,22.1
2026-01-01T08:00:00.000Z,GBI-DEV-002,460.0,23.5
2026-01-01T08:15:00.000Z,GBI-DEV-001,455.2,22.3
```

---

### 2. Export PDF Report

**GET** `/reports/pdf`

Generates and downloads a branded PDF report with GBI company header, device details, and telemetry data table.

**Example Request:**

```http
GET /reports/pdf?deviceIds=GBI-DEV-001&start=2026-01-01T08:00:00Z&end=2026-01-01T17:00:00Z&parameters=pm25&parameters=co2&intervalMinutes=30
Authorization: Bearer <token>
```

**Response:**

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="GBI-Air-Quality-Monitor-report.pdf"`

**PDF Contents:**

- GBI company logo and address header
- Report generation timestamp
- Device ID(s) and selected parameters
- Time-bucketed telemetry data table

---

## Error Responses

| Code              | Reason                                                      |
| ----------------- | ----------------------------------------------------------- |
| `400 Bad Request` | Missing required query parameters                           |
| `403 Forbidden`   | One or more device IDs are not owned by the requesting user |
| `404 Not Found`   | No telemetry data found for the given time range            |

---

## Tips

- For large date ranges (> 7 days), use a higher `intervalMinutes` (e.g., `60`) to keep output size reasonable.
- PDF reports are best suited for single-device, shorter time windows for readability.
- CSV reports support multiple devices in a single file — each row is identified by `deviceId`.
