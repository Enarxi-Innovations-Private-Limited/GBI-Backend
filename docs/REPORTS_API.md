# Reporting API

## Overview
The Reporting module allows users to generate and export historical telemetry data for analysis. The primary output format is CSV (Comma-Separated Values).

## API Endpoints

### 1. Export Telemetry (CSV)
**GET** `/reports/csv`

Generates a time-bucketed CSV file for one or more devices.

**Headers:**
*   `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `deviceIds` | `string[]` | Yes | List of Device IDs to include. |
| `start` | `ISO Date` | Yes | Start time (e.g., `2024-01-01T00:00:00Z`). |
| `end` | `ISO Date` | Yes | End time. |
| `parameters` | `string[]` | Yes | List of telemetry keys to export (e.g., `co2`, `temperature`). |
| `intervalMinutes` | `number` | No | Aggregation window in minutes. Default: `5`. |

**Aggregation Logic:**
*   Data is grouped into time buckets defined by `intervalMinutes` (e.g., 5-minute windows).
*   For each bucket, the **Average (AVG)** of the requested parameters is calculated.
*   This prevents huge file sizes by downsampling raw high-frequency data.

**Example Request:**
```http
GET /reports/csv?deviceIds=GBI-001&deviceIds=GBI-002&start=2024-01-01T08:00:00Z&end=2024-01-01T17:00:00Z&parameters=co2&parameters=temperature&intervalMinutes=15
```

**Response:**
*   **Content-Type**: `text/csv`
*   **Content-Disposition**: `attachment; filename="telemetry-report.csv"`

**Example Output (CSV Content):**
```csv
timestamp,deviceId,co2,temperature
2024-01-01T08:00:00.000Z,GBI-001,450.5,22.1
2024-01-01T08:00:00.000Z,GBI-002,460.0,23.5
2024-01-01T08:15:00.000Z,GBI-001,455.2,22.3
...
```

**Errors:**
*   `403 Forbidden`: User does not own one or more of the requested devices.
