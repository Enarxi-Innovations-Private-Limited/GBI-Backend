const mqtt = require('mqtt');

// Configuration
const CONFIG = {
  broker: 'mqtts://x28f127f.ala.asia-southeast1.emqxsl.com:8883',
  username: 'gbi_admin',
  password: 'Admin@123',
  deviceId: 'GBIAIR1000'
};

console.log('🧪 MQTT Data Type Conversion Test\n');
console.log('This will test string, float, and integer inputs\n');

const testPayloads = [
  {
    name: 'Test 1: String inputs',
    data: {
      pm25: "15.7",
      pm10: "30.2",
      tvoc: "120.5",
      co2: "450.8",
      temperature: "25.67",
      humidity: "60.12",
      noise: "45.8"
    }
  },
  {
    name: 'Test 2: Float inputs',
    data: {
      pm25: 15.7,
      pm10: 30.2,
      tvoc: 120.5,
      co2: 450.8,
      temperature: 25.67,
      humidity: 60.12,
      noise: 45.8
    }
  },
  {
    name: 'Test 3: Integer inputs',
    data: {
      pm25: 15,
      pm10: 30,
      tvoc: 120,
      co2: 450,
      temperature: 25,
      humidity: 60,
      noise: 45
    }
  },
  {
    name: 'Test 4: Mixed types',
    data: {
      pm25: "15",
      pm10: 30.5,
      tvoc: 120,
      co2: "450.2",
      temperature: "25.123",
      humidity: 60.987,
      noise: "45"
    }
  }
];

const client = mqtt.connect(CONFIG.broker, {
  username: CONFIG.username,
  password: CONFIG.password,
  clientId: 'test-conversion-' + Math.random().toString(16).slice(2, 8),
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  rejectUnauthorized: true
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');
  console.log('Expected Conversions:');
  console.log('  - PM2.5, PM10, TVOC, CO2, Noise → Integers (rounded)');
  console.log('  - Temperature, Humidity → Float with 1 decimal place\n');
  console.log('─'.repeat(60));

  let currentTest = 0;

  function sendNextTest() {
    if (currentTest >= testPayloads.length) {
      console.log('\n' + '─'.repeat(60));
      console.log('\n✅ All tests completed!');
      console.log('\n📊 Check database with:');
      console.log('   SELECT * FROM "DeviceTelemetry"');
      console.log('   ORDER BY timestamp DESC LIMIT 10;\n');
      
      setTimeout(() => client.end(), 1000);
      return;
    }

    const test = testPayloads[currentTest];
    const topic = `gbi/devices/${CONFIG.deviceId}/telemetry`;

    console.log(`\n📤 ${test.name}`);
    console.log('Input:');
    console.log(JSON.stringify(test.data, null, 2));

    client.publish(topic, JSON.stringify(test.data), { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ Publish failed:', err.message);
      } else {
        console.log('✅ Published successfully');
      }
      
      currentTest++;
      setTimeout(sendNextTest, 2000);
    });
  }

  sendNextTest();
});

client.on('error', (err) => {
  console.error('\n❌ MQTT Error:', err.message);
  process.exit(1);
});
