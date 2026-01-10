# Telemetry Data Schema

This document defines the standard schema for telemetry data sent by Air Quality Monitoring devices to the GBI Backend.

## 1. Parameters & Units

| Parameter | Type | Unit | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| `pm25` | Float | µg/m³ | 0.0 - 1000.0 | Particulate Matter < 2.5µm |
| `pm10` | Float | µg/m³ | 0.0 - 1000.0 | Particulate Matter < 10µm |
| `tvoc` | Float | ppb | 0 - 60000 | Total Volatile Organic Compounds |
| `co2` | Float | ppm | 400 - 10000 | Carbon Dioxide |
| `temperature` | Float | °C | -40.0 - 85.0 | Ambient Temperature |
| `humidity` | Float | % RH | 0.0 - 100.0 | Relative Humidity |
| `noise` | Float | dBA | 30.0 - 130.0 | Noise Level |

## 2. JSON Payload Format

Devices **must** publish a JSON object to their specific MQTT topic:
`gbi/aqm/{deviceId}/telemetry`

### Example Payload
```json
{
  "pm25": 12.5,
  "pm10": 25.0,
  "tvoc": 120,
  "co2": 450,
  "temperature": 26.5,
  "humidity": 45.0,
  "noise": 55.2
}
```

## 3. Data Rules
1.  **Partial Data**: Devices may send a subset of fields if a sensor is offline. The backend treats missing fields as `null`.
2.  **Validation**:
    *   **Non-Negative**: `pm25`, `pm10`, `tvoc`, `co2`, `humidity`, `noise` must be >= 0.
    *   **Temperature**: Can be negative (-40°C min).
3.  **Timestamps**: The backend adds the timestamp upon receipt. Devices do *not* need to send their own timestamp.
