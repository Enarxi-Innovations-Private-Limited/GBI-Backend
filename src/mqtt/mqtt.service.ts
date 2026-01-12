import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  onModuleInit() {
    this.client = mqtt.connect(process.env.MQTT_BROKER_URL!, {
      clientId: process.env.MQTT_CLIENT_ID,
      clean: true,
    });

    this.client.on('connect', () => {
      console.log('✅ MQTT connected');

      this.client.subscribe('gbi/devices/+/telemetry');
      this.client.subscribe('gbi/devices/+/heartbeat');
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT error', err);
    });
  }

  getClient() {
    return this.client;
  }
}
