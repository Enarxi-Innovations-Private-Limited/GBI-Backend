# GBI Sensor Chart: Implementation & Architecture Guide

This document records the architectural decisions, math logic, custom data pipelines, and rendering workarounds implemented for the **Sensor Analysis Chart** in [src/app/dashboard/analytics/page.js](../../GBI/src/app/dashboard/analytics/page.js).

It is designed to eliminate cognitive debt and explain **what** was implemented, **why** it was implemented, and **how** the features work.

---

## 1. The Core Problems & "Cognitive Debt" Solved

When plotting real-time historical air quality telemetry (which has natural offline periods, device shutdowns, and multi-day gaps), standard charting engines like ApexCharts experience severe rendering bugs. We implemented custom mathematical pipelines to overcome these limitations.

### A. The Bezier Spline U-Turn Bug
* **The Symptom:** When switching to smooth curves (`monotoneCubic` or `smooth`), the chart lines occasionally took sudden U-turns, drew backwards, or looped in on themselves.
* **The Root Cause:** In a datetime chart, when two data points are adjacent in the series array but separated by a long duration in time (e.g. device went offline for 10 hours), the spline mathematical solver gets warped. The horizontal control points are computed based on array adjacency, shooting massive Bezier curves backwards.
* **The Solution:** We implemented **Automated Gap Management**. Any gap larger than 2 intervals is detected. Short gaps (<= 5 intervals) are filled with synthetic linear "bridge" points to guide the spline safely. Massive gaps (> 5 intervals) are broken with `null` values, splitting the SVG path.

### B. The Viewport Line Continuation Bug
* **The Symptom:** When panning back to older data (e.g. July 8), a flat horizontal line at the last recorded value would stretch all the way across the right side of the screen.
* **The Root Cause:** When you scroll, Next.js fetches older data and appends it to `historicalData`. The series array passed to ApexCharts contains both the old data (July 8) and newer data (July 10). When ApexCharts encounters a null gap bridging across the right edge of your viewport, its area/line path generator ignores the `null` break and draws a straight line connecting the July 8 endpoints to the July 10 points out-of-sight.
* **The Solution:** We implemented **Viewport-Based Data Cropping**. We calculate the active viewport boundaries (`axisRange`) and filter the series array to only include data points within the visible window (plus a 1-viewport padding on both sides to avoid pop-in). Because future points are filtered out, ApexCharts has nothing to connect to, causing the line to terminate cleanly.

### C. The Ghost Marker Step Artifacts
* **The Symptom:** Inserting boundary "ghost points" to clamp Bezier curves created visible flat horizontal steps at the ends of segments, especially on wider presets (12 Hours, 1 Week).
* **The Root Cause:** With large intervals (e.g., 2 hours), helper points placed at `± 0.5 * intervalMs` created plateaus that were 1 hour wide, showing up as horizontal steps. Additionally, because the start ghost points were pushed before the gap-filling logic finished, the array was slightly out of chronological order, causing line glitches.
* **The Solution:** We swapped the series builder execution sequence to enforce **100% chronological sorting** and removed the ghost points entirely. Because our gap-filling and null boundaries are robust, the `'smooth'` curve runs naturally through the real database points without overshooting.

### D. The Persistent Boundary Dots
* **The Symptom:** White marker dots remained permanently visible on the line endpoints next to every gap, even when the cursor was not hovering over the chart.
* **The Root Cause:** ApexCharts forces visible markers on line boundaries before a `null` gap to ensure single points are visible, overriding `markers.size: 0`.
* **The Solution:** We set `markers: { showNullDataPoints: false }` inside the chart configuration. The dots are completely hidden during static views and appear only on hover.

---

## 2. Key Features of the Chart

### 1. Viewport Data Cropping & Unified Boundaries (`axisRange`)
To prevent duplicate boundary math, a unified `axisRange` hook calculates the current visible window. 
* The series array is cropped to `[axisRange.min - viewportWidth, axisRange.max + viewportWidth]`.
* This crops out distant data, optimizes rendering performance, and stops line continuation.

### 2. High-Performance Drag-to-Scroll (60fps)
* Users can drag the chart horizontally to backtrack into history.
* To prevent React re-renders from lagging the drag animation, the scroll position (`xaxis.min` / `xaxis.max`) updates in ApexCharts' canvas directly.
* We intercept the pan/scroll events and perform **direct DOM updates** on the date badge (`#chart-viewport-date-badge`) to show the date changing in real-time at 60fps.
* The React state updates are debounced by `100ms` and fire only when the user stops dragging.

### 3. Trackpad & Wheel Zooming
* Standard scroll wheel actions translate to timeline shifting (backwards/forwards).
* Trackpad swipe gestures scale down to smaller, smooth offsets, while physical mouse notches are clamped to prevent high-speed scrolls from flying out of bounds.

### 4. Smart Y-Axis Headroom
* The Y-axis maximum is calculated dynamically by scanning the highest value currently visible inside the viewport window.
* It multiplies the visible peak by `1.25` (25% headroom) so the curve never clips against the top ceiling.
* It factors in the alarm threshold line: if the threshold is near the visible peak, the ceiling is raised to `threshold * 1.1` to ensure the threshold label remains clearly visible.

---

## 3. Data Pipeline & Logic Reference

The following sequence runs inside the unified series builder:

1. **Bucket Rounding:** Raw telemetry points are rounded to the nearest `intervalMs` boundary. This eliminates duplicate or near-identical timestamps.
2. **Cropping:** Data points outside `[cropMin, cropMax]` are discarded.
3. **Gap Bridge Check (`i > 0`):**
   * If `curr.timestamp - prev.timestamp > 2 * intervalMs`:
     * **Short Gap (Bridge):** Synthetic points are generated at the boundary value and registered in `hiddenMarkerIndices` to hide their dots.
     * **Massive Gap (Null):** `[nullStart, null]` and `[nullEnd, null]` are pushed to split the line.
4. **Chronological Insertion:** Real points are appended, ensuring the array remains strictly ordered.

---

## 4. Configuration Reference

```javascript
stroke: {
    curve: 'smooth',        // Natural, curvy spline aesthetics
    width: 3,               // Clean, visible stroke
    connectNulls: false     // Enforce breaking the line on nulls
},
markers: {
    size: 0.01,             // Virtually invisible, preserves DOM nodes for tooltips
    hover: { size: 6 },     // Expands dot size on hover
    showNullDataPoints: false // Hides boundary dots near gaps
}
```
