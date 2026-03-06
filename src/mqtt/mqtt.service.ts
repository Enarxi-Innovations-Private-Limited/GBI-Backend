import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as os from 'os';
import * as url from 'url';
import * as mqtt from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: mqtt.MqttClient;
  private readonly logger = new Logger(MqttService.name);

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
        const parsedUrl = new url.URL(process.env.MQTT_BROKER_URL);
        options.rejectUnauthorized = false; // Accept self-signed / missing root CA for testing Serverless broker
        // Crucial for Serverless brokers (EMQX, HiveMQ) using SNI (Server Name Indication)
        options.servername = parsedUrl.hostname;
      }

      this.logger.log(
        `🔄 Initializing MQTT connection to ${process.env.MQTT_BROKER_URL}...`,
      );
      this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

      this.client.on('connect', () => {
        this.logger.log(
          `✅ MQTT connected successfully as client: ${options.clientId}`,
        );

        const consumerGroup = process.env.MQTT_CONSUMER_GROUP || 'gbi_backend';
        const telemetryTopic =
          process.env.MQTT_TELEMETRY_TOPIC || 'gbi/devices/+/telemetry';

        // Construct the shared subscription topic
        const sharedTopic = `$share/${consumerGroup}/${telemetryTopic}`;

        this.client.subscribe(sharedTopic, { qos: 1 }, (err) => {
          if (err) {
            this.logger.error(
              `❌ Failed to subscribe to shared telemetry topic: ${sharedTopic}`,
              err.stack,
            );
          } else {
            this.logger.log(
              `📡 Subscribed to shared telemetry topic: ${sharedTopic} (QoS 1)`,
            );
          }
        });
      });

      this.client.on('reconnect', () => {
        this.logger.warn('⚠️ MQTT attempting to reconnect...');
      });

      this.client.on('close', () => {
        this.logger.warn('🔴 MQTT connection closed.');
      });

      this.client.on('error', (err: any) => {
        this.logger.error('❌ MQTT error:', err?.message || err);
        // Do not throw the error here to prevent the entire NextJS/NestJS process from crashing
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize MQTT:', error.message);
    }
  }

  getClient() {
    return this.client;
  }
}
