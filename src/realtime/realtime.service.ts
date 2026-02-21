import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeService {
  emitTelemetry(deviceId: string, telemetry: any) {
    // Deprecated: Telemetry is now accessed via HTTP Polling on the frontend.
  }

  emitDeviceStatus(deviceId: string, status: 'active' | 'offline') {
    // Deprecated: Device status is accessed via HTTP Polling on the frontend.
  }
}
