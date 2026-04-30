require('dotenv').config();
const mqtt = require('mqtt');

// Configuration
const DEVICE_PREFIX = 'GBISIM';
const DEVICE_COUNT = 100;
const TOTAL_RPS = 500; // Aiming for 500 messages per second total
const BROKER_URL = process.env.MQTT_BROKER_URL;

if (!BROKER_URL) {
  console.error('❌ MQTT_BROKER_URL not found in .env');
  process.exit(1);
}

const options = {
  clientId: `master-sim-${Math.random().toString(16).substr(2, 8)}`,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
};

// Enable TLS if needed
if (BROKER_URL.startsWith('mqtts://')) {
  options.rejectUnauthorized = false; // Set to true if you have valid certs
}

console.log(`🔌 Connecting to MQTT Broker: ${BROKER_URL}...`);
const client = mqtt.connect(BROKER_URL, options);

let messageCount = 0;
const startTime = Date.now();

client.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');
  console.log(`🚀 Starting master simulation for ${DEVICE_COUNT} devices...`);
  console.log(`📊 Target Rate: ${TOTAL_RPS} messages/sec`);
  console.log('----------------------------------------');

  // Calculate interval for the whole batch
  // To get 500 msgs/sec, we send a message every 2ms.
  const intervalMs = 1000 / TOTAL_RPS;

  setInterval(() => {
    publishRandomTelemetry();
  }, intervalMs);
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

function publishRandomTelemetry() {
  // Select a random device from our 100
  const deviceNum = Math.floor(Math.random() * DEVICE_COUNT) + 1;
  const deviceId = `${DEVICE_PREFIX}${deviceNum.toString().padStart(4, '0')}`;
  const topic = `gbi/devices/${deviceId}/telemetry`;

  const data = {
    messageId: Math.random().toString(36).substring(2, 15), // REQUIRED BY BACKEND
    pm25: randomInt(0, 500),
    pm10: randomInt(0, 500),
    tvoc: randomInt(0, 1000),
    co2: randomInt(400, 2000),
    temperature: parseFloat((Math.random() * (35 - 20) + 20).toFixed(1)),
    humidity: parseFloat((Math.random() * 100).toFixed(1)),
    noise: randomInt(30, 100),
    aqi: randomInt(0, 500),
    timestamp: new Date().toISOString()
  };

  client.publish(topic, JSON.stringify(data), { qos: 0 }, (err) => {
    if (err) {
      console.error(`❌ Publish failed for ${deviceId}:`, err.message);
    } else {
      messageCount++;
      if (messageCount % 500 === 0) {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const currentRps = (messageCount / elapsedSec).toFixed(2);
        console.log(`📤 Total Published: ${messageCount} | Avg Rate: ${currentRps} msgs/sec`);
      }
    }
  });
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
