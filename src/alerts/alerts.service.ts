import { Injectable, Logger } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';
import { SseService } from '../realtime/sse.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly HYSTERESIS_PERCENT = 0.05; // 5% buffer

  // Global UI fallback thresholds (WHO Standards)
  private readonly DEFAULT_THRESHOLDS: Record<string, number> = {
    pm25: 12,
    pm10: 45,
    tvoc: 250,
    co2: 100,
    temperature: 26,
    humidity: 65,
  };

  constructor(
    private readonly repo: AlertsRepository,
    private readonly sseService: SseService,
  ) {}

  /**
   * Evaluate telemetry against thresholds.
   * Hierarchy: Device Specific -> Group Default -> Global Default.
   */
  async evaluate(deviceId: string, telemetry: any) {
    // 1. Check for Device Specific Threshold
    const deviceThreshold = await this.repo.getDeviceThreshold(deviceId);
    if (deviceThreshold?.thresholds) {
      await this.evaluateWithThresholds(
        deviceId,
        deviceThreshold.thresholds as Record<string, number>,
        telemetry,
      );
      return;
    }

    // 2. Check for Group Default Threshold
    const groupThreshold = await this.repo.getGroupThresholdByDevice(deviceId);
    if (groupThreshold?.thresholds) {
      await this.evaluateWithThresholds(
        deviceId,
        groupThreshold.thresholds as Record<string, number>,
        telemetry,
      );
      return;
    }

    // 3. Fallback to Global Default Thresholds
    await this.evaluateWithThresholds(
      deviceId,
      this.DEFAULT_THRESHOLDS,
      telemetry,
    );
  }

  private async evaluateWithThresholds(
    deviceId: string,
    thresholds: Record<string, number>,
    telemetry: any,
  ) {
    const assignments = await this.repo.getAssignedUsers(deviceId);
    if (!assignments.length) return;

    const userIds = assignments.map((a) => a.userId);
    const params = Object.keys(thresholds);
    
    // Fetch current alert states for continuity (Anti-Flicker)
    const states = await this.repo.getAlertStates(deviceId, userIds, params);
    const stateMap = new Map(
      states.map((s) => [`${s.userId}:${s.parameter}`, s]),
    );

    for (const assignment of assignments) {
      for (const param of params) {
        const threshold = thresholds[param];
        const value = telemetry[param];
        
        if (value == null) continue;

        const key = `${assignment.userId}:${param}`;
        const existingState = stateMap.get(key);
        const currentState = existingState?.state ?? 'NORMAL';

        // Calculate Hysteresis Buffer (Min 1 unit or 5%)
        const hysteresis = Math.max(1, threshold * this.HYSTERESIS_PERCENT);
        const resolveLimit = threshold - hysteresis;

        // LOGIC: NORMAL -> ALERTING
        if (currentState === 'NORMAL' && value > threshold) {
          this.logger.warn(`🚨 Alert: ${param} ${value} > ${threshold} (User: ${assignment.userId})`);
          
          await this.triggerAlert(deviceId, assignment.userId, param, value, threshold);
        }

        // LOGIC: ALERTING -> NORMAL (with Hysteresis)
        else if (currentState === 'ALERTING' && value < resolveLimit) {
          this.logger.log(`✅ Resolve: ${param} ${value} < ${resolveLimit} (User: ${assignment.userId})`);
          
          await this.resolveAlert(deviceId, assignment.userId, param, value);
        }
      }
    }
  }

  private async triggerAlert(deviceId: string, userId: string, param: string, value: number, limit: number) {
    const message = `${param.toUpperCase()} exceeded limit (${value} > ${limit})`;

    // 1. DB: Create Event Log & Notification
    await this.repo.createEventLog({
      deviceId,
      userId,
      parameter: param,
      value,
      eventType: 'ALERT_TRIGGERED', // Explicit Event Type
    });

    const notification = await this.repo.createNotification({
      userId,
      deviceId,
      message,
      thresholdValue: limit,
    });

    // 2. DB: Update State
    await this.repo.upsertAlertState({
      deviceId,
      userId,
      parameter: param,
      state: 'ALERTING',
      lastTriggeredAt: new Date(),
    });

    // 3. Realtime: Emit SSE
    this.sseService.sendEvent(userId, {
      type: 'NOTIFICATION',
      data: notification,
    });
  }

  private async resolveAlert(deviceId: string, userId: string, param: string, value: number) {
    const message = `${param.toUpperCase()} returned to normal (${value})`;

    // 1. DB: Create Event Log & Notification
    await this.repo.createEventLog({
      deviceId,
      userId,
      parameter: param,
      value,
      eventType: 'ALERT_RESOLVED', // Explicit Event Type
    });

    const notification = await this.repo.createNotification({
      userId,
      deviceId,
      message,
    });

    // 2. DB: Update State
    await this.repo.upsertAlertState({
      deviceId,
      userId,
      parameter: param,
      state: 'NORMAL',
      lastTriggeredAt: new Date(),
    });

    // 3. Realtime: Emit SSE
    this.sseService.sendEvent(userId, {
      type: 'NOTIFICATION',
      data: notification,
    });
  }
}
