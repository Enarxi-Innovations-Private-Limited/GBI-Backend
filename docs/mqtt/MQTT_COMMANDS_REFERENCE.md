# MQTT Commands Reference Guide

Complete guide for publishing and subscribing to MQTT topics using PowerShell.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Subscribe Commands](#subscribe-commands)
4. [Publish Commands](#publish-commands)
5. [Testing Scenarios](#testing-scenarios)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

## Prerequisites

### Install MQTT CLI

```powershell
npm install -g mqtt
```

### Verify Installation

```powershell
mqtt --help
```

---

## Configuration

### Current MQTT Broker

```
Broker: mqtts://x28f127f.ala.asia-southeast1.emqxsl.com:8883
Username: gbi_admin
Password: Admin@123
Protocol: MQTT over TLS/SSL
```

### Environment Variables (Optional)

```powershell
# Set for easier command usage
$env:MQTT_BROKER = "x28f127f.ala.asia-southeast1.emqxsl.com"
$env:MQTT_PORT = "8883"
$env:MQTT_USER = "gbi_admin"
$env:MQTT_PASS = "Admin@123"
```

---

## Subscribe Commands

### 1. Subscribe to Specific Device Telemetry

**Single Device:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -v
```

**With Verbose Output:**
```powershell
mqtt sub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -t 'gbi/devices/GBIAIR1000/telemetry' `
  -v
```

### 2. Subscribe to Specific Device Heartbeat

```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/heartbeat' -v
```

### 3. Subscribe to All Devices - Telemetry Only

**Using + wildcard (single level):**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/+/telemetry' -v
```

### 4. Subscribe to All Devices - Heartbeat Only

```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/+/heartbeat' -v
```

### 5. Subscribe to All Topics for Specific Device

**Using # wildcard (multi-level):**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/#' -v
```

### 6. Subscribe to ALL GBI Topics

**Monitor everything:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -v
```

### 7. Subscribe to Multiple Specific Topics

```powershell
mqtt sub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -t 'gbi/devices/GBIAIR1000/telemetry' `
  -t 'gbi/devices/GBIAIR1000/heartbeat' `
  -t 'gbi/devices/GBIAIR2000/telemetry' `
  -v
```

### 8. Subscribe with Quality of Service (QoS)

```powershell
# QoS 0 - At most once (default)
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -q 0 -v

# QoS 1 - At least once
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -q 1 -v

# QoS 2 - Exactly once
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -q 2 -v
```

### 9. Subscribe and Save to File

```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -v | Tee-Object -FilePath "mqtt-messages.log"
```

### 10. Subscribe with Client ID

```powershell
mqtt sub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -i "gbi-subscriber-1" `
  -t 'gbi/#' `
  -v
```

---

## Publish Commands

### 1. Publish Telemetry to Specific Device

**Basic Telemetry:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":15,"pm10":30,"tvoc":120,"co2":450,"temperature":25.5,"humidity":60.2,"noise":45}'
```

**With Pretty Formatting:**
```powershell
$payload = @{
    pm25 = 15
    pm10 = 30
    tvoc = 120
    co2 = 450
    temperature = 25.5
    humidity = 60.2
    noise = 45
} | ConvertTo-Json -Compress

mqtt pub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -t 'gbi/devices/GBIAIR1000/telemetry' `
  -m $payload
```

### 2. Publish Heartbeat

```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/heartbeat' -m '{"status":"online"}'
```

### 3. Publish to Multiple Devices

```powershell
# Device 1
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":15,"pm10":30,"tvoc":120,"co2":450,"temperature":25.5,"humidity":60.2,"noise":45}'

# Device 2
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR2000/telemetry' -m '{"pm25":20,"pm10":35,"tvoc":150,"co2":500,"temperature":26.0,"humidity":55.0,"noise":50}'
```

### 4. Publish with Retain Flag

**Retained messages are stored by broker and sent to new subscribers:**
```powershell
mqtt pub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -t 'gbi/devices/GBIAIR1000/status' `
  -m '{"online":true}' `
  -r
```

### 5. Publish with QoS

```powershell
# QoS 1 - Guaranteed delivery
mqtt pub `
  -h x28f127f.ala.asia-southeast1.emqxsl.com `
  -p 8883 `
  -u gbi_admin `
  -P Admin@123 `
  --protocol mqtts `
  -t 'gbi/devices/GBIAIR1000/telemetry' `
  -m '{"pm25":15,"pm10":30,"tvoc":120,"co2":450,"temperature":25.5,"humidity":60.2,"noise":45}' `
  -q 1
```

### 6. Publish from File

```powershell
# Create payload file
@"
{
  "pm25": 15,
  "pm10": 30,
  "tvoc": 120,
  "co2": 450,
  "temperature": 25.5,
  "humidity": 60.2,
  "noise": 45
}
"@ | Out-File -FilePath "telemetry-payload.json" -Encoding UTF8

# Publish from file
$payload = Get-Content -Path "telemetry-payload.json" -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m $payload
```

### 7. Publish Random Test Data

```powershell
$random = @{
    pm25 = Get-Random -Minimum 0 -Maximum 100
    pm10 = Get-Random -Minimum 0 -Maximum 200
    tvoc = Get-Random -Minimum 0 -Maximum 1000
    co2 = Get-Random -Minimum 400 -Maximum 2000
    temperature = [math]::Round((Get-Random -Minimum 15.0 -Maximum 35.0), 1)
    humidity = [math]::Round((Get-Random -Minimum 20.0 -Maximum 80.0), 1)
    noise = Get-Random -Minimum 30 -Maximum 90
} | ConvertTo-Json -Compress

mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m $random
Write-Host "Published: $random" -ForegroundColor Green
```

### 8. Continuous Publishing (Loop)

```powershell
# Publish every 5 seconds
while ($true) {
    $payload = @{
        pm25 = Get-Random -Minimum 0 -Maximum 100
        pm10 = Get-Random -Minimum 0 -Maximum 200
        tvoc = Get-Random -Minimum 0 -Maximum 1000
        co2 = Get-Random -Minimum 400 -Maximum 2000
        temperature = [math]::Round((Get-Random -Minimum 15.0 -Maximum 35.0), 1)
        humidity = [math]::Round((Get-Random -Minimum 20.0 -Maximum 80.0), 1)
        noise = Get-Random -Minimum 30 -Maximum 90
    } | ConvertTo-Json -Compress
    
    mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m $payload
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Published: $payload" -ForegroundColor Cyan
    Start-Sleep -Seconds 5
}
```

---

## Testing Scenarios

### Scenario 1: Test Single Device End-to-End

**Terminal 1 - Subscribe:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/#' -v
```

**Terminal 2 - Publish Telemetry:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":15,"pm10":30,"tvoc":120,"co2":450,"temperature":25.5,"humidity":60.2,"noise":45}'
```

**Terminal 2 - Publish Heartbeat:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/heartbeat' -m '{"status":"online"}'
```

### Scenario 2: Monitor All Devices

**Terminal 1 - Monitor:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/+/telemetry' -v
```

**Terminal 2 - Simulate Multiple Devices:**
```powershell
# Device 1
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":15,"pm10":30,"tvoc":120,"co2":450,"temperature":25.5,"humidity":60.2,"noise":45}'

Start-Sleep -Seconds 1

# Device 2
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR2000/telemetry' -m '{"pm25":20,"pm10":35,"tvoc":150,"co2":500,"temperature":26.0,"humidity":55.0,"noise":50}'

Start-Sleep -Seconds 1

# Device 3
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR3000/telemetry' -m '{"pm25":10,"pm10":25,"tvoc":100,"co2":400,"temperature":24.0,"humidity":65.0,"noise":40}'
```

### Scenario 3: Test Data Type Conversion

**Test String Values:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":"15","pm10":"30","tvoc":"120","co2":"450","temperature":"25.5","humidity":"60.2","noise":"45"}'
```

**Test Float Values:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":15.7,"pm10":30.3,"tvoc":120.9,"co2":450.1,"temperature":25.678,"humidity":60.234,"noise":45.6}'
```

**Test Mixed Values:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m '{"pm25":"15.7","pm10":30,"tvoc":"120","co2":450.5,"temperature":"25.678","humidity":60.1,"noise":"45"}'
```

### Scenario 4: Test Offline Detection

**1. Subscribe to monitor:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -v
```

**2. Publish data every 5 seconds:**
```powershell
# Run for 30 seconds
for ($i = 1; $i -le 6; $i++) {
    $payload = @{pm25=15; pm10=30; tvoc=120; co2=450; temperature=25.5; humidity=60.2; noise=45} | ConvertTo-Json -Compress
    mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/GBIAIR1000/telemetry' -m $payload
    Write-Host "[$i/6] Published at $(Get-Date -Format 'HH:mm:ss')"
    Start-Sleep -Seconds 5
}
```

**3. Stop publishing and wait 25+ seconds:**
```powershell
Write-Host "Stopping... device should go offline in 25 seconds" -ForegroundColor Yellow
# Wait and check backend logs for offline detection
```

---

## Troubleshooting

### Connection Issues

**Test Basic Connection:**
```powershell
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'test/connection' -m 'hello' -d
```

**Check with Debug Mode:**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -v -d
```

### Authentication Issues

**Test with Wrong Password:**
```powershell
# Should fail
mqtt pub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P WrongPassword --protocol mqtts -t 'test' -m 'test'
```

### Topic Issues

**List All Topics (if broker allows):**
```powershell
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t '#' -v -C 10
```

### Message Not Receiving

**Check Wildcard Syntax:**
```powershell
# Correct - single level
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/devices/+/telemetry' -v

# Correct - multi level
mqtt sub -h x28f127f.ala.asia-southeast1.emqxsl.com -p 8883 -u gbi_admin -P Admin@123 --protocol mqtts -t 'gbi/#' -v

# Incorrect - wrong wildcard
# mqtt sub ... -t 'gbi/devices/*/telemetry'  # Wrong! Use + not *
```

---

## Quick Reference

### Command Structure

**Subscribe:**
```
mqtt sub -h <host> -p <port> -u <username> -P <password> --protocol mqtts -t '<topic>' -v
```

**Publish:**
```
mqtt pub -h <host> -p <port> -u <username> -P <password> --protocol mqtts -t '<topic>' -m '<message>'
```

### Common Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-h` | Broker hostname | `-h x28f127f.ala.asia-southeast1.emqxsl.com` |
| `-p` | Port | `-p 8883` |
| `-u` | Username | `-u gbi_admin` |
| `-P` | Password | `-P Admin@123` |
| `--protocol` | Protocol | `--protocol mqtts` |
| `-t` | Topic | `-t 'gbi/devices/+/telemetry'` |
| `-m` | Message (publish only) | `-m '{"pm25":15}'` |
| `-v` | Verbose (subscribe only) | `-v` |
| `-d` | Debug mode | `-d` |
| `-q` | QoS level (0, 1, 2) | `-q 1` |
| `-r` | Retain message | `-r` |
| `-i` | Client ID | `-i "my-client"` |
| `-C` | Count (subscribe X messages then exit) | `-C 10` |

### Topic Patterns

| Pattern | Matches | Example |
|---------|---------|---------|
| `gbi/devices/GBIAIR1000/telemetry` | Exact topic | Single device telemetry |
| `gbi/devices/+/telemetry` | Single level wildcard | All devices telemetry |
| `gbi/devices/GBIAIR1000/#` | Multi-level wildcard | All topics for one device |
| `gbi/#` | Everything under gbi | All GBI topics |
| `#` | Everything | All topics (use carefully!) |

### Payload Examples

**Valid Telemetry:**
```json
{
  "pm25": 15,
  "pm10": 30,
  "tvoc": 120,
  "co2": 450,
  "temperature": 25.5,
  "humidity": 60.2,
  "noise": 45
}
```

**Invalid Telemetry (missing values):**
```json
{
  "pm25": ,
  "pm10": ,
  "tvoc": 120
}
```

---

## Saved Scripts

All saved PowerShell scripts are in the `scripts/` folder:

- **`mqtt-subscribe.ps1`** - Interactive menu for subscribing to topics
- **`test-mqtt-publish.js`** - Node.js script for automated testing
- **`test-data-conversion.js`** - Node.js script for testing type conversion

---

## Environment-Specific Commands

### Development (Current)

```powershell
$MQTT_HOST = "x28f127f.ala.asia-southeast1.emqxsl.com"
$MQTT_PORT = "8883"
$MQTT_USER = "gbi_admin"
$MQTT_PASS = "Admin@123"
```

### Production (Update when ready)

```powershell
$MQTT_HOST = "your-production-broker.com"
$MQTT_PORT = "8883"
$MQTT_USER = "prod_user"
$MQTT_PASS = "ProdPassword123"
```

---

## Additional Resources

- **MQTT CLI Documentation:** https://github.com/mqttjs/MQTT.js
- **MQTT Protocol:**  https://mqtt.org/
- **EMQX Documentation:** https://www.emqx.io/docs/
- **Topic Naming Best Practices:** https://www.hivemq.com/blog/mqtt-essentials-part-5-mqtt-topics-best-practices/

---

**Last Updated:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')  
**Broker:** EMQX Cloud (Development)  
**Protocol:** MQTT over TLS (mqtts://)
