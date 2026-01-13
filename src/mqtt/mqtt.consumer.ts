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
        const data = JSON.parse(payload.toString());

        if (topic.includes('telemetry')) {
          await this.handleTelemetry(deviceId, data);
        }

        if (topic.includes('heartbeat')) {
          await this.handleHeartbeat(deviceId);
        }
      } catch (error) {
        console.error('MQTT message error:', error.message);
      }
    });
  }

  private extractDeviceId(topic: string): string {
    return topic.split('/')[2];
  }

  private async handleTelemetry(deviceId: string, payload: any) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device || device.status !== 'active') {
      return;
    }

    const dto = plainToInstance(TelemetryPayloadDto, payload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      console.warn('Invalid telemetry payload:', errors);
      return;
    }

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

    await this.alertsService.evaluate(device.id, dto);
  }

  private async handleHeartbeat(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) return;

    await this.prisma.device.update({
      where: { deviceId },
      data: { status: 'active' },
    });
  }
}
