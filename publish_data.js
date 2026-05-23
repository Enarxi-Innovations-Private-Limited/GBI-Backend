require('dotenv').config();
const mqtt = require('mqtt');
const crypto = require('crypto');

// Configuration
// const DEVICE_ID = process.env.MQTT_USERNAME || 'GBIAIR1000';
const DEVICE_ID = 'GBISIM0001';
const TOPIC = `gbi/devices/${DEVICE_ID}/telemetry`;
const INTERVAL = 30000; // 30 seconds

// Check configuration
if (!process.env.MQTT_BROKER_URL) {
  console.error('❌ MQTT_BROKER_URL not found in .env');
  process.exit(1);
}

// MQTT Options
const options = {
  clientId: `sim-${DEVICE_ID}-${Math.random().toString(16).substr(2, 8)}`,
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
  console.log(`🚀 Starting simulation for device: ${DEVICE_ID}`);
  console.log(`📡 Publishing to topic: ${TOPIC}`);
  console.log(`⏱️ Interval: ${INTERVAL / 1000} seconds`);
  console.log('----------------------------------------');

  // Start publishing loop
  setInterval(publishTelemetry, INTERVAL);
  // Publish immediately
  publishTelemetry();
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

client.on('close', () => {
  console.log('⚠️ MQTT Connection closed');
});

function publishTelemetry() {
  // Generate random values within realistic ranges
  const data = {
    messageId: crypto.randomUUID(), // Required for backend idempotency and tracking
    
    // Particulate Matter (µg/m³)
    pm25: randomInt(10, 80),   // Typical indoor range
    pm10: randomInt(20, 120),  
    
    // Gases
    tvoc: randomInt(50, 400),  // ppb
    co2: randomInt(400, 1200), // ppm (400 is baseline outdoor)

    // Environment
    temperature: parseFloat((Math.random() * (32 - 24) + 24).toFixed(1)), // 24.0 - 32.0 °C
    humidity: parseFloat((Math.random() * (70 - 40) + 40).toFixed(1)),    // 40.0 - 70.0 %
    noise: randomInt(35, 65), // dB (ambient office/home noise)

    // Air Quality Index
    aqi: randomInt(30, 150),    
    
    // Timestamp (ISO String)
    timestamp: new Date().toISOString()
  };

  // Convert to JSON
  const payload = JSON.stringify(data);

  // Publish
  client.publish(TOPIC, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Publish failed:', err.message);
    } else {
      console.log(`📤 [${new Date().toLocaleTimeString()}] Sent Telemetry: ${data.messageId}`);
      console.table({
        'PM 2.5': `${data.pm25} µg/m³`,
        'PM 10': `${data.pm10} µg/m³`,
        'CO2': `${data.co2} ppm`,
        'TVOC': `${data.tvoc} ppb`,
        'Temp': `${data.temperature} °C`,
        'Humidity': `${data.humidity} %`,
        'AQI': data.aqi
      });
    }
  });
}

// Helper: Random Integer
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
