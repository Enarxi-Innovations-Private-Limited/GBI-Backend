import 'dotenv/config';
import { MqttService } from '../src/mqtt/mqtt.service';

async function test() {
  const mqttService = new MqttService();
  mqttService.onModuleInit();
  
  // Wait for connection
  await new Promise(r => setTimeout(r, 2000));
  
  const deviceId = 'GBIAIR_1775889859917';
  const topic = `gbi/devices/${deviceId}/restart`;
  
  console.log(`🧪 Testing requestResponse on topic: ${topic}`);
  const success = await mqttService.requestResponse(
    topic,
    'RESTART',
    'OK',
    15000
  );
  
  console.log(`Result: ${success ? '✅ SUCCESS' : '❌ TIMEOUT'}`);
  process.exit(success ? 0 : 1);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
