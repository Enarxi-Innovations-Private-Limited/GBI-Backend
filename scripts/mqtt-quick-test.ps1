# MQTT Quick Test Script
# Interactive menu for common MQTT operations

param(
    [string]$Action = "",
    [string]$DeviceId = "GBIAIR1000"
)

# Configuration
$MQTT_HOST = "x28f127f.ala.asia-southeast1.emqxsl.com"
$MQTT_PORT = "8883"
$MQTT_USER = "gbi_admin"
$MQTT_PASS = "Admin@123"

function Show-Menu {
    Clear-Host
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "         MQTT Quick Test Menu" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "SUBSCRIBE OPTIONS:" -ForegroundColor Yellow
    Write-Host "  1. Subscribe to specific device (telemetry)" -ForegroundColor White
    Write-Host "  2. Subscribe to specific device (all topics)" -ForegroundColor White
    Write-Host "  3. Subscribe to all devices (telemetry)" -ForegroundColor White
    Write-Host "  4. Subscribe to all devices (heartbeat)" -ForegroundColor White
    Write-Host "  5. Subscribe to ALL GBI topics" -ForegroundColor White
    Write-Host ""
    Write-Host "PUBLISH OPTIONS:" -ForegroundColor Yellow
    Write-Host "  6. Publish telemetry (one time)" -ForegroundColor White
    Write-Host "  7. Publish heartbeat (one time)" -ForegroundColor White
    Write-Host "  8. Publish telemetry (continuous every 5sec)" -ForegroundColor White
    Write-Host "  9. Publish random test data" -ForegroundColor White
    Write-Host ""
    Write-Host "TESTING:" -ForegroundColor Yellow
    Write-Host " 10. Test data type conversion (string inputs)" -ForegroundColor White
    Write-Host " 11. Test data type conversion (float inputs)" -ForegroundColor White
    Write-Host " 12. Test offline detection (publish then stop)" -ForegroundColor White
    Write-Host ""
    Write-Host "OTHER:" -ForegroundColor Yellow
    Write-Host " 13. Test connection" -ForegroundColor White
    Write-Host " 14. View saved messages log" -ForegroundColor White
    Write-Host "  0. Exit" -ForegroundColor Red
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Get-RandomTelemetry {
    return @{
        pm25 = Get-Random -Minimum 0 -Maximum 100
        pm10 = Get-Random -Minimum 0 -Maximum 200
        tvoc = Get-Random -Minimum 0 -Maximum 1000
        co2 = Get-Random -Minimum 400 -Maximum 2000
        temperature = [math]::Round((Get-Random -Minimum 15.0 -Maximum 35.0), 1)
        humidity = [math]::Round((Get-Random -Minimum 20.0 -Maximum 80.0), 1)
        noise = Get-Random -Minimum 30 -Maximum 90
    } | ConvertTo-Json -Compress
}

function Subscribe-Topic {
    param([string]$Topic)
    
    Write-Host "Subscribing to: $Topic" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop..." -ForegroundColor Yellow
    Write-Host ""
    
    mqtt sub `
        -h $MQTT_HOST `
        -p $MQTT_PORT `
        -u $MQTT_USER `
        -P $MQTT_PASS `
        --protocol mqtts `
        -t $Topic `
        -v
}

function Publish-Message {
    param(
        [string]$Topic,
        [string]$Message
    )
    
    mqtt pub `
        -h $MQTT_HOST `
        -p $MQTT_PORT `
        -u $MQTT_USER `
        -P $MQTT_PASS `
        --protocol mqtts `
        -t $Topic `
        -m $Message
}

# Main menu loop
while ($true) {
    Show-Menu
    
    if ($Action -eq "") {
        $choice = Read-Host "Enter your choice (0-14)"
    } else {
        $choice = $Action
        $Action = "" # Reset for next iteration
    }
    
    switch ($choice) {
        "1" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            Subscribe-Topic "gbi/devices/$device/telemetry"
        }
        "2" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            Subscribe-Topic "gbi/devices/$device/#"
        }
        "3" {
            Subscribe-Topic "gbi/devices/+/telemetry"
        }
        "4" {
            Subscribe-Topic "gbi/devices/+/heartbeat"
        }
        "5" {
            Subscribe-Topic "gbi/#"
        }
        "6" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            $payload = Get-RandomTelemetry
            Write-Host "Publishing telemetry to $device..." -ForegroundColor Green
            Write-Host "Payload: $payload" -ForegroundColor Cyan
            
            Publish-Message "gbi/devices/$device/telemetry" $payload
            
            Write-Host "Published successfully!" -ForegroundColor Green
            Read-Host "Press Enter to continue"
        }
        "7" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            $heartbeat = '{"status":"online"}' | ConvertTo-Json -Compress
            Write-Host "Publishing heartbeat to $device..." -ForegroundColor Green
            
            Publish-Message "gbi/devices/$device/heartbeat" $heartbeat
            
            Write-Host "Published successfully!" -ForegroundColor Green
            Read-Host "Press Enter to continue"
        }
        "8" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            Write-Host "Publishing telemetry every 5 seconds..." -ForegroundColor Green
            Write-Host "Press Ctrl+C to stop..." -ForegroundColor Yellow
            Write-Host ""
            
            $count = 1
            while ($true) {
                $payload = Get-RandomTelemetry
                Publish-Message "gbi/devices/$device/telemetry" $payload
                
                Write-Host "[$count] $(Get-Date -Format 'HH:mm:ss') - Published: $payload" -ForegroundColor Cyan
                $count++
                Start-Sleep -Seconds 5
            }
        }
        "9" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            $count = Read-Host "How many random messages? (default: 10)"
            if ($count -eq "") { $count = 10 }
            
            Write-Host "Publishing $count random messages..." -ForegroundColor Green
            
            for ($i = 1; $i -le $count; $i++) {
                $payload = Get-RandomTelemetry
                Publish-Message "gbi/devices/$device/telemetry" $payload
                Write-Host "[$i/$count] Published" -ForegroundColor Cyan
                Start-Sleep -Milliseconds 500
            }
            
            Write-Host "Done!" -ForegroundColor Green
            Read-Host "Press Enter to continue"
        }
        "10" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            Write-Host "Testing string input conversion..." -ForegroundColor Green
            $payload = '{"pm25":"15.7","pm10":"30.3","tvoc":"120","co2":"450","temperature":"25.678","humidity":"60.234","noise":"45.6"}'
            Write-Host "Payload: $payload" -ForegroundColor Cyan
            
            Publish-Message "gbi/devices/$device/telemetry" $payload
            
            Write-Host "Published! Check database - integers should be rounded, floats with 1 decimal" -ForegroundColor Green
            Read-Host "Press Enter to continue"
        }
        "11" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            Write-Host "Testing float input conversion..." -ForegroundColor Green
            $payload = '{"pm25":15.9,"pm10":30.2,"tvoc":120.7,"co2":450.5,"temperature":25.678,"humidity":60.234,"noise":45.8}'
            Write-Host "Payload: $payload" -ForegroundColor Cyan
            
            Publish-Message "gbi/devices/$device/telemetry" $payload
            
            Write-Host "Published! Check database - integers should be rounded, floats with 1 decimal" -ForegroundColor Green
            Read-Host "Press Enter to continue"
        }
        "12" {
            $device = Read-Host "Enter Device ID (default: $DeviceId)"
            if ($device -eq "") { $device = $DeviceId }
            
            Write-Host "Testing offline detection..." -ForegroundColor Green
            Write-Host "Step 1: Publishing data for 30 seconds (every 5 sec)..." -ForegroundColor Yellow
            
            for ($i = 1; $i -le 6; $i++) {
                $payload = Get-RandomTelemetry
                Publish-Message "gbi/devices/$device/telemetry" $payload
                Write-Host "[$i/6] Published at $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
                Start-Sleep -Seconds 5
            }
            
            Write-Host ""
            Write-Host "Step 2: Stopping... Device should go offline in 25 seconds" -ForegroundColor Yellow
            Write-Host "Check backend logs for: '⚠️ Device $device went OFFLINE'" -ForegroundColor Red
            Write-Host ""
            Write-Host "Waiting 30 seconds..." -ForegroundColor Yellow
            
            Start-Sleep -Seconds 30
            
            Write-Host ""
            Write-Host "Step 3: Sending one message to test auto-recovery..." -ForegroundColor Yellow
            $payload = Get-RandomTelemetry
            Publish-Message "gbi/devices/$device/telemetry" $payload
            Write-Host "Published! Check backend logs for: '✅ Device $device is back ONLINE'" -ForegroundColor Green
            
            Read-Host "Press Enter to continue"
        }
        "13" {
            Write-Host "Testing MQTT connection..." -ForegroundColor Green
            
            try {
                Publish-Message "test/connection" "hello from PowerShell at $(Get-Date)"
                Write-Host "✅ Connection successful!" -ForegroundColor Green
            } catch {
                Write-Host "❌ Connection failed: $_" -ForegroundColor Red
            }
            
            Read-Host "Press Enter to continue"
        }
        "14" {
            if (Test-Path "mqtt-messages.log") {
                Write-Host "Last 20 messages:" -ForegroundColor Green
                Get-Content "mqtt-messages.log" | Select-Object -Last 20
            } else {
                Write-Host "No log file found. Subscribe with option 5 to create one." -ForegroundColor Yellow
            }
            Read-Host "Press Enter to continue"
        }
        "0" {
            Write-Host "Goodbye!" -ForegroundColor Cyan
            exit
        }
        default {
            Write-Host "Invalid choice. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
}
