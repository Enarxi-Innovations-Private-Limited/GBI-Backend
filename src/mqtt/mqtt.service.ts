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

  async publish(
    topic: string,
    message: string,
    options: mqtt.IClientPublishOptions = { qos: 1 },
  ): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT client not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, options, (err) => {
        if (err) {
          this.logger.error(`❌ Failed to publish to ${topic}`, err.stack);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async requestResponse(
    topic: string,
    command: string,
    expectedResponse: string,
    timeoutMs: number,
  ): Promise<boolean> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT client not connected');
    }

    // 1. Subscribe to the topic to listen for the response
    await new Promise<void>((resolve, reject) => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`❌ Failed to subscribe to ${topic}`, err.stack);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return new Promise<boolean>((resolve) => {
      let timeout: NodeJS.Timeout;

      const messageHandler = (incomingTopic: string, payload: Buffer) => {
        if (incomingTopic === topic) {
          const message = payload.toString();
          if (message === expectedResponse) {
            this.logger.log(`📥 Received expected response "${message}" on ${topic}`);
            cleanup(true);
          }
        }
      };

      const cleanup = (result: boolean) => {
        clearTimeout(timeout);
        this.client.removeListener('message', messageHandler);
        this.client.unsubscribe(topic);
        resolve(result);
      };

      // 2. Start listening
      this.client.on('message', messageHandler);

      // 3. Set timeout
      timeout = setTimeout(() => {
        this.logger.warn(`⏳ Timeout waiting for "${expectedResponse}" on ${topic}`);
        cleanup(false);
      }, timeoutMs);

      // 4. Publish the command
      this.publish(topic, command).catch((err) => {
        this.logger.error(`❌ Failed to send command "${command}" to ${topic}`, err.stack);
        cleanup(false);
      });
    });
  }
}
