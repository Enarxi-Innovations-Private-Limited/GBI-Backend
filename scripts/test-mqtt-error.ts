import * as mqtt from 'mqtt';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const brokerUrl = process.env.MQTT_BROKER_URL;
const options = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'test-error-script-' + Math.random().toString(16).substring(2, 8),
  rejectUnauthorized: true, // Typically true for secure connections, adjust if needed
};

if (!brokerUrl) {
  console.error('❌ MQTT_BROKER_URL not found in .env');
  process.exit(1);
}

console.log(`🔌 Connecting to ${brokerUrl}...`);
const client = mqtt.connect(brokerUrl, options);

client.on('connect', () => {
  console.log('✅ Connected to MQTT Broker');

  const topic = 'gbi/devices/GBIAIR1000/telemetry';
  
  // Invalid payload: pm25 is a string, which should fail IsNumber validation (even with transform if it's not a number string)
  // Actually, "invalid" string will allow us to test the validation error logging.
  const invalidPayload = {
    pm25: "invalid_value_for_testing", 
    pm10: 50,
    tvoc: 400,
    co2: 1000,
    temperature: 25,
    humidity: 50,
    noise: "", // Missing AQI is fine (optional), but adding invalid AQI helps test that too.
    AQI: 500
  };

  console.log(`📤 Publishing invalid payload to ${topic}...`);
  console.log(JSON.stringify(invalidPayload, null, 2));

  client.publish(topic, JSON.stringify(invalidPayload), (err) => {
    if (err) {
      console.error('❌ Publish error:', err);
    } else {
      console.log('✅ Message published successfully');
    }
    
    // Close connection after a short delay to ensure message is sent
    setTimeout(() => {
      client.end();
      console.log('🔌 Disconnected');
    }, 1000);
  });
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err);
  client.end();
});
