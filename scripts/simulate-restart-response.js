const mqtt = require('mqtt');

// Configuration from .env
const CONFIG = {
  broker: 'mqtt://31.97.236.192:1883',
  username: 'GBIAIR1000',
  password: 'GBISTRONG123!',
  deviceId: 'GBIAIR_1775889859917' // From screenshot
};

console.log('🚀 Device Restart Simulator Starting...');
console.log(`📡 Connecting to ${CONFIG.broker}`);

const client = mqtt.connect(CONFIG.broker, {
  username: CONFIG.username,
  password: CONFIG.password,
  clientId: 'sim-device-' + Math.random().toString(16).slice(2, 8),
});

client.on('connect', () => {
  const topic = `gbi/devices/${CONFIG.deviceId}/restart`;
  console.log(`✅ Connected! Subscribing to: ${topic}`);
  
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('❌ Subscription error:', err);
      process.exit(1);
    }
    console.log('📡 Ready. Waiting for RESTART command...');
  });
});

client.on('message', (topic, payload) => {
  const message = payload.toString();
  console.log(`📥 Received on ${topic}: "${message}"`);
  
  if (message === 'RESTART') {
    console.log('🔄 "RESTART" command received. Sending "OK" back in 2 seconds...');
    
    setTimeout(() => {
      client.publish(topic, 'OK', { qos: 1 }, (err) => {
        if (err) {
          console.error('❌ Failed to send OK:', err);
        } else {
          console.log('📤 "OK" response sent successfully!');
        }
      });
    }, 2000);
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
});
