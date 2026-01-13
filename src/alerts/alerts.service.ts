import { Injectable } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';

const COOLDOWN_MINUTES = 5;

@Injectable()
export class AlertsService {
  constructor(private readonly repo: AlertsRepository) {}

  async evaluate(deviceId: string, telemetry: any) {
    const assignments = await this.repo.getAssignedUsers(deviceId);
    if (!assignments.length) return;

    const userIds = assignments.map((a) => a.userId);

    for (const userId of userIds) {
      const thresholds = await this.repo.getThresholds(userId);

      for (const threshold of thresholds) {
        const param = threshold.parameter;
        const limit = threshold.limitValue;

        const value = telemetry[param];
        if (value === undefined || value === null) continue;

        if (value > limit) {
          const recent = await this.repo.hasRecentAlert(
            deviceId,
            userId,
            param,
            COOLDOWN_MINUTES,
          );
          if (recent) continue;

          await this.repo.createEventLog({
            deviceId,
            userId,
            parameter: param,
            value,
          });

          await this.repo.createNotification({
            userId,
            deviceId,
            message: `${param.toUpperCase()} exceeded limit (${value}) > ${limit}`,
          });
        }
      }
    }
  }
}
