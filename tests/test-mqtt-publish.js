const mqtt = require('mqtt');

// Configuration - update these if needed
const CONFIG = {
  broker: 'mqtts://x28f127f.ala.asia-southeast1.emqxsl.com:8883',
  username: 'gbi_admin',
  password: 'Admin@123',
  deviceId: 'GBIAIR1000'
};

console.log('🚀 MQTT Test Publisher for GBI Backend\n');
console.log('Configuration:');
console.log(`  Broker: ${CONFIG.broker}`);
console.log(`  Device ID: ${CONFIG.deviceId}\n`);

// Connect to MQTT broker
const client = mqtt.connect(CONFIG.broker, {
  username: CONFIG.username,
  password: CONFIG.password,
  clientId: 'test-publisher-' + Math.random().toString(16).slice(2, 8),
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  rejectUnauthorized: true // Verify SSL certificate
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker successfully!\n');

  // Generate realistic sensor data
  const telemetryData = {
    pm25: parseFloat((Math.random() * 50 + 10).toFixed(2)),      // 10-60 µg/m³
    pm10: parseFloat((Math.random() * 80 + 20).toFixed(2)),      // 20-100 µg/m³
    tvoc: parseFloat((Math.random() * 500 + 100).toFixed(0)),    // 100-600 ppb
    co2: parseFloat((Math.random() * 600 + 400).toFixed(0)),     // 400-1000 ppm
    temperature: parseFloat((Math.random() * 15 + 20).toFixed(1)),// 20-35°C
    humidity: parseFloat((Math.random() * 40 + 40).toFixed(1)),   // 40-80%
    noise: parseFloat((Math.random() * 30 + 40).toFixed(1))       // 40-70 dBA
  };

  const telemetryTopic = `gbi/devices/${CONFIG.deviceId}/telemetry`;
  const heartbeatTopic = `gbi/devices/${CONFIG.deviceId}/heartbeat`;

  console.log('📤 Publishing telemetry data...');
  console.log('Topic:', telemetryTopic);
  console.log('Data:', JSON.stringify(telemetryData, null, 2));

  // Publish telemetry data
  client.publish(telemetryTopic, JSON.stringify(telemetryData), { qos: 1 }, (err) => {
    if (err) {
      console.error('\n❌ Failed to publish telemetry:', err.message);
      client.end();
      return;
    }

    console.log('\n✅ Telemetry data published successfully!');

    // Wait 1 second then send heartbeat
    setTimeout(() => {
      console.log('\n📤 Publishing heartbeat...');
      console.log('Topic:', heartbeatTopic);

      client.publish(heartbeatTopic, '{}', { qos: 1 }, (err) => {
        if (err) {
          console.error('\n❌ Failed to publish heartbeat:', err.message);
        } else {
          console.log('✅ Heartbeat published successfully!');
        }

        console.log('\n✨ Test completed! Disconnecting...\n');
        client.end();
      });
    }, 1000);
  });
});

client.on('error', (err) => {
  console.error('\n❌ MQTT Connection Error:', err.message);
  console.error('\nPossible issues:');
  console.error('  1. Check if MQTT broker URL is correct');
  console.error('  2. Verify username and password');
  console.error('  3. Ensure firewall allows MQTT ports (1883/8883)');
  console.error('  4. Check SSL/TLS certificate if using mqtts://\n');
  process.exit(1);
});

client.on('offline', () => {
  console.log('⚠️  MQTT client is offline');
});

client.on('reconnect', () => {
  console.log('🔄 Attempting to reconnect to MQTT broker...');
});
