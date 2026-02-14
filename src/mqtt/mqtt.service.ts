import { Injectable, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: mqtt.MqttClient;

  onModuleInit() {
    // Skip MQTT if broker URL is not configured
    if (!process.env.MQTT_BROKER_URL) {
      console.warn('⚠️  MQTT_BROKER_URL not set. MQTT features disabled.');
      return;
    }

    try {
      const options: any = {
        clientId: (process.env.MQTT_CLIENT_ID || 'gbi-backend') + '-' + Math.random().toString(16).substr(2, 8),
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      // Add credentials if provided
      if (process.env.MQTT_USERNAME) {
        options.username = process.env.MQTT_USERNAME;
      }
      if (process.env.MQTT_PASSWORD) {
        options.password = process.env.MQTT_PASSWORD;
      }

      // For mqtts:// connections, enable TLS
      if (process.env.MQTT_BROKER_URL?.startsWith('mqtts://')) {
        options.rejectUnauthorized = true; // Verify server certificate
      }

      this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

      this.client.on('connect', () => {
        console.log('✅ MQTT connected');

        this.client.subscribe('gbi/devices/+/telemetry');
        this.client.subscribe('gbi/devices/+/heartbeat');
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT error', err);
      });
    } catch (error) {
      console.error('❌ Failed to initialize MQTT:', error.message);
    }
  }

  getClient() {
    return this.client;
  }
}
