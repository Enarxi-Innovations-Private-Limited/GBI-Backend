import { Injectable, OnModuleInit } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { validate } from 'class-validator';
import { AlertsService } from 'src/alerts/alerts.service';

@Injectable()
export class MqttConsumer implements OnModuleInit {
  constructor(
    private readonly mqttService: MqttService,
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
  ) {}

  onModuleInit() {
    const client = this.mqttService.getClient();

    client.on('message', async (topic, payload) => {
      try {
        const deviceId = this.extractDeviceId(topic);
        const payloadString = payload.toString();
        
        // Try to parse JSON first
        let data;
        try {
          data = JSON.parse(payloadString);
        } catch (parseError) {
          const errorLog = {
            timestamp: new Date().toISOString(),
            error: 'Invalid JSON',
            topic: topic,
            deviceId: deviceId,
            payload: payloadString,
            parseError: parseError.message
          };
          
          // Log to console
          console.error('❌ Invalid JSON received on topic:', topic);
          console.error('   Device ID:', deviceId);
          console.error('   Full Payload:', payloadString);
          console.error('   Parse Error:', parseError.message);
          
          // Log to file
          const fs = require('fs');
          fs.appendFileSync(
            'mqtt-errors.log',
            JSON.stringify(errorLog, null, 2) + '\n---\n',
            'utf8'
          );
          
          return; // Skip this message
        }

        if (topic.includes('telemetry')) {
          await this.handleTelemetry(deviceId, data);
        }

        if (topic.includes('heartbeat')) {
          await this.handleHeartbeat(deviceId);
        }
      } catch (error) {
        console.error('MQTT message error:', error.message);
        
        // Log general errors to file
        const fs = require('fs');
        const errorLog = {
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        };
        fs.appendFileSync(
          'mqtt-errors.log',
          JSON.stringify(errorLog, null, 2) + '\n---\n',
          'utf8'
        );
      }
    });
  }

  private extractDeviceId(topic: string): string {
    return topic.split('/')[2];
  }

  private async handleTelemetry(deviceId: string, payload: any) {
    console.log('📥 Received telemetry for deviceId:', deviceId);
    console.log('📦 Payload:', JSON.stringify(payload));

    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      console.error('❌ Device not found:', deviceId);
      return;
    }

    console.log('✅ Device found:', device.id, '- Status:', device.status);

    // Validate payload
    const dto = plainToInstance(TelemetryPayloadDto, payload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      console.warn('❌ Invalid telemetry payload:', JSON.stringify(errors, null, 2));
      return;
    }

    console.log('✅ Validation passed. Saving to database...');

    // Save telemetry data (even if device is inactive)
    await this.prisma.deviceTelemetry.create({
      data: {
        deviceId: device.id,
        pm25: dto.pm25,
        pm10: dto.pm10,
        tvoc: dto.tvoc,
        co2: dto.co2,
        temperature: dto.temperature,
        humidity: dto.humidity,
        noise: dto.noise,
      },
    });

    // Update heartbeat timestamp
    await this.prisma.device.update({
      where: { id: device.id },
      data: { 
        lastHeartbeatAt: new Date(),
        // If device was offline, mark it active again
        ...(device.status === 'inactive' && { status: 'active' }),
      },
    });

    if (device.status === 'inactive') {
      console.log('✅ Device was OFFLINE - marked as ACTIVE and data saved!');
    } else {
      console.log('✅ Telemetry data saved successfully!');
    }

    await this.alertsService.evaluate(device.id, dto);
  }

  private async handleHeartbeat(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) return;

    await this.prisma.device.update({
      where: { deviceId },
      data: { status: 'active', lastHeartbeatAt: new Date() },
    });
  }
}
