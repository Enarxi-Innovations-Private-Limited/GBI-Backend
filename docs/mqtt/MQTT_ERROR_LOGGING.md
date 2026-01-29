# MQTT Error Logging Implementation

## What Was Added

### File Logging
All MQTT errors are now logged to `mqtt-errors.log` in the project root with full details.

### Error Types Logged

#### 1. **Invalid JSON Errors**
When malformed JSON is received from MQTT:

```json
{
  "timestamp": "2026-01-29T20:40:13.000Z",
  "error": "Invalid JSON",
  "topic": "gbi/devices/GBIAIR1000/telemetry",
  "deviceId": "GBIAIR1000",
  "payload": "{\"pm25\":,\"pm10\":,\"tvoc\":2773,\"co2\":973,...}",
  "parseError": "Unexpected token ','"
}
---
```

#### 2. **General MQTT Errors**
Any other errors during MQTT processing:

```json
{
  "timestamp": "2026-01-29T20:40:13.000Z",
  "error": "Error message here",
  "stack": "Full error stack trace..."
}
---
```

## Console vs File Logging

### Console Logging
- **Purpose**: Quick debugging during development
- **Content**: Summary of errors
- **May be truncated**: Due to console buffer limits

### File Logging (`mqtt-errors.log`)
- **Purpose**: Complete error history and debugging
- **Content**: Full payload, timestamps, stack traces
- **Never truncated**: All data preserved
- **Location**: `gbi-backend/mqtt-errors.log`

## Log File Format

Each error entry includes:
- ✅ **Timestamp**: ISO 8601 format
- ✅ **Error type**: Invalid JSON, validation error, etc.
- ✅ **Topic**: Full MQTT topic path
- ✅ **Device ID**: Extracted from topic
- ✅ **Full payload**: Complete message (not truncated)
- ✅ **Error details**: Parse errors, validation errors, stack traces
- ✅ **Separator**: `---` between entries

## Viewing Logs

### Tail Live Logs (PowerShell)
```powershell
Get-Content mqtt-errors.log -Wait -Tail 50
```

### View Last 20 Errors
```powershell
Get-Content mqtt-errors.log | Select-Object -Last 100
```

### Search for Specific Device
```powershell
Select-String -Path mqtt-errors.log -Pattern "GBIAIR1000"
```

### Clear Old Logs
```powershell
Remove-Item mqtt-errors.log
```

## Common Error Patterns

### 1. **Empty Values in JSON**
```json
{"pm25":,"pm10":,"tvoc":2773}
      ↑      ↑ Missing values
```

**Cause**: Device sending undefined/null values without proper handling

**Solution**: Update device firmware to send valid numbers or omit the field:
```json
// Good
{"tvoc":2773,"co2":973}

// Also good
{"pm25":0,"pm10":0,"tvoc":2773}

// Bad
{"pm25":,"pm10":,"tvoc":2773}
```

### 2. **Trailing Commas**
```json
{"pm25":15,"pm10":30,}
                    ↑ Invalid trailing comma
```

**Cause**: Improper JSON serialization

**Solution**: Use proper JSON.stringify() or library

### 3. **Single Quotes Instead of Double Quotes**
```json
{'pm25':15,'pm10':30}
↑      ↑   Invalid: must use "
```

**Cause**: Language-specific JSON generation

**Solution**: Ensure device uses RFC 8259 compliant JSON

## Log Rotation (Optional Setup)

For production, you may want to rotate logs to prevent file from growing too large.

### Option 1: Manual Script
Create `rotate-logs.ps1`:

```powershell
$logFile = "mqtt-errors.log"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if (Test-Path $logFile) {
    $size = (Get-Item $logFile).Length / 1MB
    if ($size -gt 10) {  # Rotate if > 10MB
        Move-Item $logFile "mqtt-errors-$timestamp.log"
        New-Item $logFile -ItemType File
    }
}
```

### Option 2: Scheduled Task
Run rotation daily at midnight:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\path\to\rotate-logs.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 00:00
Register-ScheduledTask -TaskName "RotateMQTTLogs" -Action $action -Trigger $trigger
```

### Option 3: NestJS Logger (Production)
For production, consider using a proper logging library like Winston or Pino with automatic rotation.

## Debugging Workflow

### When You See Console Errors:

1. **Check the log file** for full details:
   ```powershell
   cat mqtt-errors.log
   ```

2. **Identify the payload**:
   Look for the `"payload":` field in the JSON

3. **Find the source**:
   Check `"topic":` and `"deviceId":` to identify problematic device

4. **Fix the device**:
   Update device firmware to send valid JSON

5. **Test**:
   ```bash
   node test-mqtt-publish.js
   ```

## Example Debug Session

### Error in Console:
```
❌ Invalid JSON received on topic: gbi/devices/GBIAIR1000/telemetry
   Payload preview: {"pm25":,"pm10":,"tvoc":2773,"co2":973,"temperatur...
```

### Check Log File:
```powershell
cat mqtt-errors.log
```

### Find Full Entry:
```json
{
  "timestamp": "2026-01-29T20:40:13.123Z",
  "error": "Invalid JSON",
  "topic": "gbi/devices/GBIAIR1000/telemetry",
  "deviceId": "GBIAIR1000",
  "payload": "{\"pm25\":,\"pm10\":,\"tvoc\":2773,\"co2\":973,\"temperature\":25.5,\"humidity\":60.1,\"noise\":45}",
  "parseError": "Unexpected token ','"
}
```

### Root Cause:
`pm25` and `pm10` are empty - device is not providing values

### Solution:
Update device code to either:
- Send `0` instead of empty: `{"pm25":0,"pm10":0,...}`
- Omit the field entirely: `{"tvoc":2773,...}`

## Production Recommendations

1. **Monitor log file size** - Set up rotation if needed
2. **Alert on errors** - Set up monitoring (e.g., if error count > 100/hour)
3. **Archive old logs** - Keep logs for 30-90 days
4. **Use structured logging** - Consider Winston/Pino for production
5. **Dashboard integration** - Send critical errors to monitoring service

## Security Note

⚠️ **The log file may contain sensitive data!**
- Device IDs
- Sensor values
- Error patterns that reveal system architecture

**Do NOT commit `mqtt-errors.log` to git** (already in .gitignore)

---

**Status**: ✅ File logging implemented and ready to use!
