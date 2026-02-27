import { Injectable, OnModuleInit } from '@nestjs/common';
import * as os from 'os';
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
        clientId: `${process.env.MQTT_CLIENT_ID || 'gbi-backend'}-${os.hostname()}-${Math.random().toString(16).substring(2, 8)}`,
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

      console.log(
        `🔄 Initializing MQTT connection to ${process.env.MQTT_BROKER_URL}...`,
      );
      this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

      this.client.on('connect', () => {
        console.log(
          `✅ MQTT connected successfully as client: ${options.clientId}`,
        );

        const consumerGroup = process.env.MQTT_CONSUMER_GROUP || 'gbi_backend';
        const telemetryTopic =
          process.env.MQTT_TELEMETRY_TOPIC || 'gbi/devices/+/telemetry';

        // Construct the shared subscription topic
        const sharedTopic = `$share/${consumerGroup}/${telemetryTopic}`;

        this.client.subscribe(sharedTopic, { qos: 1 }, (err) => {
          if (err) {
            console.error(
              `❌ Failed to subscribe to shared telemetry topic: ${sharedTopic}`,
              err,
            );
          } else {
            console.log(
              `📡 Subscribed to shared telemetry topic: ${sharedTopic} (QoS 1)`,
            );
          }
        });
      });

      this.client.on('reconnect', () => {
        console.warn('⚠️ MQTT attempting to reconnect...');
      });

      this.client.on('close', () => {
        console.warn('🔴 MQTT connection closed.');
      });

      this.client.on('error', (err) => {
        console.error('❌ MQTT error:', err.message);
      });
    } catch (error) {
      console.error('❌ Failed to initialize MQTT:', error.message);
    }
  }

  getClient() {
    return this.client;
  }
}
