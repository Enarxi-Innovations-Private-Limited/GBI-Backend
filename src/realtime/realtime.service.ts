import { Injectable } from '@nestjs/common';
import { TelemetryGateway } from './telemetry.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: TelemetryGateway) {}

  emitTelemetry(deviceId: string, telemetry: any) {
    this.gateway.broadcastTelemetry(deviceId, telemetry);
  }

  emitDeviceStatus(deviceId: string, status: 'active' | 'offline') {
    this.gateway.broadcastDeviceStatus(deviceId, status);
  }
}
