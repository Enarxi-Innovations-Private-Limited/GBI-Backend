import { Injectable } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';

const COOLDOWN_MINUTES = 5;
const BUFFER_PERCENT = 0.02; // 2% hysteresis

@Injectable()
export class AlertsService {
  constructor(private readonly repo: AlertsRepository) {}

  async evaluate(deviceId: string, telemetry: any) {
    const assignments =
      await this.repo.getAssignedUsersWithThresholds(deviceId);
    if (!assignments.length) return;

    const userIds = new Set<string>();
    const params = new Set<string>();

    // Collect userIds + params
    for (const a of assignments) {
      userIds.add(a.userId);
      for (const t of a.user.alerts ?? []) params.add(t.parameter);
    }

    const userIdList = Array.from(userIds);
    const paramList = Array.from(params);

    if (userIdList.length === 0 || paramList.length === 0) return;

    // Fetch states in batch
    const states = await this.repo.getAlertStates(
      deviceId,
      userIdList,
      paramList,
    );
    const stateMap = new Map(
      states.map((s) => [`${s.userId}:${s.parameter}`, s]),
    );

    // Recent cooldown lookup (optional extra protection)
    const recentAlerts = await this.repo.getRecentAlerts(
      deviceId,
      userIdList,
      paramList,
      COOLDOWN_MINUTES,
    );
    const recentLookup = new Set(
      recentAlerts.map((r) => `${r.userId}:${r.parameter}`),
    );

    for (const assignment of assignments) {
      const { userId, user } = assignment;
      if (!user?.alerts?.length) continue;

      for (const threshold of user.alerts) {
        const param = threshold.parameter;
        const limit = threshold.limitValue;
        const value = telemetry[param];

        if (value === undefined || value === null) continue;

        const key = `${userId}:${param}`;
        const existing: any = stateMap.get(key);

        const buffer = limit * BUFFER_PERCENT;
        const currentState = existing?.state ?? 'NORMAL';

        // NORMAL -> ALERTING (crossing above limit)
        if (currentState === 'NORMAL' && value > limit) {
          // cooldown protection
          if (recentLookup.has(key)) continue;

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

          await this.repo.upsertAlertState({
            deviceId,
            userId,
            parameter: param,
            state: 'ALERTING',
            lastTriggeredAt: new Date(),
          });

          continue;
        }

        // ALERTING -> NORMAL (recovery when goes below limit-buffer)
        if (currentState === 'ALERTING' && value < limit - buffer) {
          await this.repo.createEventLog({
            deviceId,
            userId,
            parameter: param,
            value,
          });

          await this.repo.createNotification({
            userId,
            deviceId,
            message: `${param.toUpperCase()} back to normal (${value}) < ${limit}`,
          });

          await this.repo.upsertAlertState({
            deviceId,
            userId,
            parameter: param,
            state: 'NORMAL',
          });

          continue;
        }
      }
    }
  }
}
