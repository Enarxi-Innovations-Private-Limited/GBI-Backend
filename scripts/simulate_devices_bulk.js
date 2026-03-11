require('dotenv').config();
const mqtt = require('mqtt');
const crypto = require('crypto');

// Configuration
const DEVICES = [
  'GBIAIR1000',
  'GBIAIR1001',
  'GBIAIR1002',
  'GBIAIR1003',
  'GBIAIR1004',
  'GBIAIR1005',
  'GBIAIR1006',
  'GBIAIR1007',
  'GBIAIR1008',
  'GBIAIR1009',
  'GBIAIR1010',
];
const INTERVAL = 30000; // 30 seconds

// Check configuration
if (!process.env.MQTT_BROKER_URL) {
  console.error('❌ MQTT_BROKER_URL not found in .env');
  process.exit(1);
}

// MQTT Options
const options = {
  clientId: `sim-bulk-${Math.random().toString(16).substr(2, 8)}`,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
};

// Enable TLS for mqtts
if (process.env.MQTT_BROKER_URL.startsWith('mqtts://')) {
  options.rejectUnauthorized = true;
}

console.log(`🔌 Connecting to MQTT Broker: ${process.env.MQTT_BROKER_URL}...`);
const client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

client.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');
  console.log(
    `🚀 Starting bulk simulation for ${DEVICES.length} devices every ${INTERVAL / 1000} seconds`,
  );
  console.log('----------------------------------------');

  // Start publishing loop
  setInterval(publishAllTelemetry, INTERVAL);
  // Publish immediately
  publishAllTelemetry();
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

client.on('close', () => {
  console.log('⚠️ MQTT Connection closed');
});

function publishAllTelemetry() {
  DEVICES.forEach((deviceId) => {
    publishTelemetryForDevice(deviceId);
  });
}

function publishTelemetryForDevice(deviceId) {
  const topic = `gbi/devices/${deviceId}/telemetry`;

  // Generate random values within realistic ranges
  const data = {
    messageId: crypto.randomUUID(),

    // Particulate Matter (µg/m³)
    pm25: randomInt(0, 500), // 0-500
    pm10: randomInt(0, 500), // 0-500

    // Gases
    tvoc: randomInt(0, 1000), // ppb
    co2: randomInt(400, 2000), // ppm

    // Environment
    temperature: parseFloat((Math.random() * (35 - 20) + 20).toFixed(1)), // 20.0 - 35.0 °C
    humidity: parseFloat((Math.random() * 100).toFixed(1)), // 0.0 - 100.0 %
    noise: randomInt(30, 100), // dB

    // Air Quality Index
    aqi: randomInt(0, 500), // 0-500

    // Timestamp (ISO String)
    timestamp: new Date().toISOString(),
  };

  // Convert to JSON
  const payload = JSON.stringify(data);

  // Publish
  client.publish(topic, payload, { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ Publish failed for ${deviceId}:`, err.message);
    } else {
      console.log(
        `📤 [${new Date().toLocaleTimeString()}] Sent Telemetry for ${topic}`,
      );
    }
  });
}

// Helper: Random Integer
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
