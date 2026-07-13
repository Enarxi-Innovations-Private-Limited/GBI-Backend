# GBI Sensor Chart: Technical Implementation Guide

This guide details the mathematical formulas, database queries, and frontend rendering workarounds used to implement the GBI Air Quality sensor trend chart.

---

## 1. Timeline Resolution & Preset Mapping

To maintain uniform chart density, we map time ranges to predefined aggregation intervals and visible point counts.

### Presets Configuration
Defined in [sensorService.js](../../GBI/src/services/sensorService.js):

| Key | Label | Database Aggregation Interval | Total Fetch Lookback |
| :--- | :--- | :--- | :--- |
| `'1min'` | 1 Min | `1` minute (raw data) | 24 hours |
| `'3min'` | 3 Min | `3` minutes | 24 hours |
| `'5min'` | 5 Min | `5` minutes | 24 hours |
| `'30min'` | 30 Min | `30` minutes | 24 hours |
| `'1h'` | 1 Hour | `60` minutes (1 hour) | 7 days |
| `'12h'` | 12 Hours | **`30` minutes** | 7 days |
| `'1w'` | 1 Week | **`240` minutes (4 hours)** | 30 days |
| `'1m'` | 1 Month | `1440` minutes (24 hours) | 60 days |
| `'custom'` | Custom | Dynamic (calculated at query-time) | Selected date range |

### Viewport Density mapping
Defined in `visiblePointsMap` inside [page.js](../../GBI/src/app/dashboard/analytics/page.js):

```javascript
const visiblePointsMap = {
    '1min': 30,   // 30 minutes viewport (30 points @ 1m interval)
    '3min': 30,   // 1.5 hours viewport (30 points @ 3m interval)
    '5min': 30,   // 2.5 hours viewport (30 points @ 5m interval)
    '30min': 30,  // 15 hours viewport (30 points @ 30m interval)
    '1h': 24,     // 24 hours (1 day) viewport (24 points @ 1h interval)
    '12h': 24,    // 12 hours viewport (24 points @ 30m interval)
    '1w': 42,     // 7 days (1 week) viewport (42 points @ 4h interval)
    '1m': 30,     // 30 days (1 month) viewport (30 points @ 24h interval)
    'custom': 100 // 100 points viewport (adaptive)
};
```

---

## 2. Adaptive Bucketing Math for Custom Ranges

When a user selects a Custom Date Range, the timeline interval is calculated dynamically at runtime on both the frontend and backend.

### A. Raw Interval Calculation
The range in minutes is divided by the target density (`100` points):

$$\text{raw\_interval} = \frac{\text{EndDate} - \text{StartDate} \text{ (in minutes)}}{100}$$

### B. Nearest-Neighbor Snapping
To prevent fractional intervals (like 47 minutes), `raw_interval` is snapped to the closest element from a fixed bucket list:

```typescript
const buckets = [
  1, 2, 3, 5, 10, 15, 30, 
  60, 120, 180, 240, 360, 720, 
  1440, 2880, 4320, 10080, 43200
];
```

The snapped value is computed via:

$$\text{snapped\_interval} = \operatorname*{arg\,min}_{b \in \text{buckets}} |b - \text{raw\_interval}|$$

### C. Aligned SQL Database Grouping
Buckets are aligned to the clock using PostgreSQL epoch floor arithmetic:

```sql
SELECT
  to_timestamp(floor(extract(epoch from "timestamp") / (${interval} * 60)) * (${interval} * 60)) as "timestamp",
  "deviceId",
  AVG("pm25") as "pm25",
  MAX("pm25") as "peak_pm25"
FROM "DeviceTelemetry"
GROUP BY 1, "deviceId"
ORDER BY 1 ASC;
```

---

## 3. Dual-Value Aggregation (Spike / Peak Tracking)

To ensure short pollution spikes are not averaged away on weekly/monthly presets, the backend queries both `AVG` and `MAX` values.

### Prisma SQL Selector
Located in [telemetry-query.service.ts](../../gbi-backend/src/telemetry/telemetry-query.service.ts):

```typescript
const selectAgg = Prisma.join(
  safeParams.map(
    (param) => Prisma.sql`
      AVG("${Prisma.raw(param)}") as "${Prisma.raw(param)}", 
      MAX("${Prisma.raw(param)}") as "peak_${Prisma.raw(param)}"
    `,
  ),
  ', ',
);
```

### Frontend Custom Tooltip Parser
The tooltip reads the `peakValue` from the coordinates. If the peak differs from the average and crosses the safety threshold, it highlights the breach in red:

```javascript
const peakVal = Number(w.globals.initialSeries[seriesIndex].data[dataPointIndex].peakValue);
const hasBreach = peakVal && threshold && peakVal > threshold;

const peakSection = (peakVal && Math.round(peakVal) !== Math.round(val))
    ? `<div class="flex justify-between items-center gap-4 text-[10px] mt-1 pt-1.5 border-t border-border/40">
        <span class="text-text-muted">Peak Value</span>
        <span class="font-bold ${hasBreach ? 'text-status-unhealthy' : 'text-text-primary'}">
            ${peakVal.toFixed(1)} ${config.unit} ${hasBreach ? '🚨 (Breach)' : ''}
        </span>
       </div>`
    : '';
```

---

## 4. Viewport Data Cropping

To prevent ApexCharts from connecting visible viewport points across massive gaps to out-of-viewport points, data series arrays are cropped before rendering.

### Crop Window Equation
The cropping range is defined as the visible axis boundaries plus a buffer of 1 full viewport width (`rangeMs`):

$$\text{rangeMs} = (\text{visiblePoints} + 1) \times \text{intervalMs}$$

$$\text{cropMin} = \text{axisRange.min} - \text{rangeMs}$$

$$\text{cropMax} = \text{axisRange.max} + \text{rangeMs}$$

```javascript
const croppedData = sortedData.filter(pt => pt[0] >= cropMin && pt[0] <= cropMax);
```

*Note: The 1-viewport buffer ensures that as the user drag-scrolls, the line connects smoothly to points just outside the boundary without sudden visual "pop-in" glitches.*

---

## 5. Automated Gap Resolution

Within the cropped dataset, we check the distance between consecutive points `prev` and `curr`:

$$\text{diff} = \text{curr.timestamp} - \text{prev.timestamp}$$

### A. Short Gaps ($\le 5 \times \text{intervalMs}$)
Bridged with flat linear step points to ensure path continuity without Bezier overshoots:

```javascript
let fillTs = prev[0] + step;
while (fillTs < curr[0]) {
    hiddenMarkerIndices.push(finalData.length);
    fakeTs.add(fillTs);
    finalData.push([fillTs, prev[1].value]);
    fillTs += step;
}
```

### B. Massive Gaps ($> 5 \times \text{intervalMs}$)
Broken with null markers so the line path splits cleanly:

```javascript
const nullStart = prev[0] + intervalMs;
const nullEnd = curr[0] - intervalMs;

hiddenMarkerIndices.push(finalData.length);
fakeTs.add(nullStart);
finalData.push([nullStart, null]);

if (nullStart < nullEnd) {
    hiddenMarkerIndices.push(finalData.length);
    fakeTs.add(nullEnd);
    finalData.push([nullEnd, null]);
}
```

---

## 6. Config Override Reference

### Hide Static Boundary Markers
By default, ApexCharts forces markers on the endpoints of lines next to `null` values. We suppress them using:

```javascript
markers: {
    size: chartType === 'line' ? 0.01 : 0, 
    hover: { size: 6 },
    discrete: discreteMarkers,
    showNullDataPoints: false // Hides persistent boundary markers next to nulls
}
```

### Bar Chart Event Safety Checks
When switching chart types, ApexCharts' event handler might trigger `dataPointMouseEnter` without providing a valid `event` parameter. We guard against this to avoid runtime TypeErrors:

```javascript
dataPointMouseEnter: (event, chartContext, config) => {
    if (!config) return;
    const seriesIdx = config.seriesIndex;
    const dataIdx = config.dataPointIndex;
    const series = chartSeries[seriesIdx];
    if (series && series.hiddenMarkerIndices && series.hiddenMarkerIndices.includes(dataIdx)) {
        if (event && event.target) { // Defensive check
            event.target.setAttribute('r', '0');
            event.target.style.opacity = '0';
        }
    }
}
```
