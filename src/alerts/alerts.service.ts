import { Injectable } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';

const COOLDOWN_MINUTES = 5;
const BUFFER_PERCENT = 0.02;

@Injectable()
export class AlertsService {
  constructor(private readonly repo: AlertsRepository) {}

  async evaluate(deviceId: string, telemetry: any) {
    const deviceThreshold = await this.repo.getDeviceThreshold(deviceId);

    if (deviceThreshold?.thresholds) {
      return this.evaluateWithThresholds(
        deviceId,
        deviceThreshold.thresholds as Record<string, number>,
        telemetry,
      );
    }

    const groupThreshold = await this.repo.getGroupThresholdByDevice(deviceId);

    if (groupThreshold?.thresholds) {
      return this.evaluateWithThresholds(
        deviceId,
        groupThreshold.thresholds as Record<string, number>,
        telemetry,
      );
    }
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
    if (!params.length) return;

    const states = await this.repo.getAlertStates(deviceId, userIds, params);
    const stateMap = new Map(
      states.map((s) => [`${s.userId}:${s.parameter}`, s]),
    );

    const recentAlerts = await this.repo.getRecentAlerts(
      deviceId,
      userIds,
      params,
      COOLDOWN_MINUTES,
    );

    const recentLookup = new Set(
      recentAlerts.map((r) => `${r.userId}:${r.parameter}`),
    );

    for (const assignment of assignments) {
      for (const param of params) {
        const limit = thresholds[param];
        const value = telemetry[param];
        if (value == null) continue;

        const key = `${assignment.userId}:${param}`;
        const existing = stateMap.get(key);
        const buffer = limit * BUFFER_PERCENT;
        const state = existing?.state ?? 'NORMAL';

        if (state === 'NORMAL' && value > limit) {
          if (recentLookup.has(key)) continue;

          await this.repo.createEventLog({
            deviceId,
            userId: assignment.userId,
            parameter: param,
            value,
          });

          await this.repo.createNotification({
            userId: assignment.userId,
            deviceId,
            message: `${param.toUpperCase()} exceeded (${value} > ${limit})`,
          });

          await this.repo.upsertAlertState({
            deviceId,
            userId: assignment.userId,
            parameter: param,
            state: 'ALERTING',
            lastTriggeredAt: new Date(),
          });
        }

        if (state === 'ALERTING' && value < limit - buffer) {
          await this.repo.createEventLog({
            deviceId,
            userId: assignment.userId,
            parameter: param,
            value,
          });

          await this.repo.createNotification({
            userId: assignment.userId,
            deviceId,
            message: `${param.toUpperCase()} back to normal`,
          });

          await this.repo.upsertAlertState({
            deviceId,
            userId: assignment.userId,
            parameter: param,
            state: 'NORMAL',
          });
        }
      }
    }
  }
}
