# MQTT Subscribe Helper Script
# This script subscribes to MQTT topics and displays incoming messages

Write-Host "🔍 MQTT Topic Subscriber" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$broker = "x28f127f.ala.asia-southeast1.emqxsl.com"
$port = 8883
$username = "gbi_admin"
$password = "Admin@123"

# Menu
Write-Host "Select topic to subscribe to:" -ForegroundColor Yellow
Write-Host "1. gbi/devices/GBIAIR1000/telemetry (Specific device)" -ForegroundColor White
Write-Host "2. gbi/devices/+/telemetry (All devices - telemetry)" -ForegroundColor White
Write-Host "3. gbi/devices/+/heartbeat (All devices - heartbeat)" -ForegroundColor White
Write-Host "4. gbi/# (All GBI topics)" -ForegroundColor White
Write-Host "5. Custom topic" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-5)"

switch ($choice) {
    1 { $topic = "gbi/devices/GBIAIR1000/telemetry" }
    2 { $topic = "gbi/devices/+/telemetry" }
    3 { $topic = "gbi/devices/+/heartbeat" }
    4 { $topic = "gbi/#" }
    5 { $topic = Read-Host "Enter custom topic" }
    default { 
        Write-Host "Invalid choice. Using default: gbi/devices/GBIAIR1000/telemetry" -ForegroundColor Red
        $topic = "gbi/devices/GBIAIR1000/telemetry"
    }
}

Write-Host ""
Write-Host "📡 Subscribing to: $topic" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Subscribe using mqtt CLI
& mqtt sub `
    -h $broker `
    -p $port `
    -u $username `
    -P $password `
    --protocol mqtts `
    -t $topic `
    -v
