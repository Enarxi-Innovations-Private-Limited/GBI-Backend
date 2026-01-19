import { Injectable } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';

const COOLDOWN_MINUTES = 5;

@Injectable()
export class AlertsService {
  constructor(private readonly repo: AlertsRepository) {}

  async evaluate(deviceId: string, telemetry: any) {
    // 1. Fetch Users + Thresholds in ONE query
    const assignments = await this.repo.getAssignedUsersWithThresholds(deviceId);
    if (!assignments.length) return;

    const potentialAlerts: { userId: string; param: string; value: number; limit: number }[] = [];
    const parametersToCheck = new Set<string>();
    const userIdsToCheck = new Set<string>();

    // 2. Filter in memory (Fast)
    for (const assignment of assignments) {
      const { userId, user } = assignment;
      if (!user || !user.alerts) continue;

      for (const threshold of user.alerts) {
        const param = threshold.parameter;
        const limit = threshold.limitValue;
        const value = telemetry[param];

        if (value !== undefined && value !== null && value > limit) {
          potentialAlerts.push({ userId, param, value, limit });
          parametersToCheck.add(param);
          userIdsToCheck.add(userId);
        }
      }
    }

    if (potentialAlerts.length === 0) return;

    // 3. Batch Check Recent Alerts (One Query)
    const recentAlerts = await this.repo.getRecentAlerts(
      deviceId,
      Array.from(userIdsToCheck),
      Array.from(parametersToCheck),
      COOLDOWN_MINUTES,
    );

    // Create a lookup for fast checking
    const recentLookup = new Set(
      recentAlerts.map((r) => `${r.userId}:${r.parameter}`),
    );

    // 4. Process valid alerts
    for (const alert of potentialAlerts) {
      const key = `${alert.userId}:${alert.param}`;
      
      // If we recently alerted this user about this param, skip
      if (recentLookup.has(key)) continue;

      // Otherwise, log and notify
      await this.repo.createEventLog({
        deviceId,
        userId: alert.userId,
        parameter: alert.param,
        value: alert.value,
      });

      await this.repo.createNotification({
        userId: alert.userId,
        deviceId,
        message: `${alert.param.toUpperCase()} exceeded limit (${alert.value}) > ${alert.limit}`,
      });
    }
  }
}
