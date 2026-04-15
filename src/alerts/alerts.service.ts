import { Injectable, Logger } from '@nestjs/common';
import { AlertsRepository } from './alerts.repository';
import { SseService } from '../realtime/sse.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly HYSTERESIS_PERCENT = 0.05; // 5% buffer

  constructor(
    private readonly repo: AlertsRepository,
    private readonly sseService: SseService,
  ) {}

  /**
   * Evaluate telemetry against thresholds.
   * Hierarchy: Device Specific -> Group Default.
   *
   * ─── OPTIMIZED ───
   * Old: Sequential fetches — getDeviceThreshold → getAssignedUsers → getGroupThreshold (if needed)
   * New: Parallel fetch of deviceThreshold + assignments simultaneously.
   *      Group threshold only fetched if device threshold is absent (preserves cascade logic).
   *      Result: 1 saved sequential round-trip per MQTT message.
   */
  async evaluate(deviceId: string, telemetry: any) {
    // Parallel fetch: device threshold and assignments are always needed regardless of outcome
    const [deviceThreshold, assignments] = await Promise.all([
      this.repo.getDeviceThreshold(deviceId),
      this.repo.getAssignedUsers(deviceId),
    ]);

    // Short-circuit: no users assigned → nothing to alert
    if (!assignments.length) return;

    // Resolve effective thresholds — device-level wins over group-level
    const thresholds =
      (deviceThreshold?.thresholds as Record<string, number>) ??
      ((await this.repo.getGroupThresholdByDevice(deviceId))
        ?.thresholds as Record<string, number>);

    if (!thresholds) return;

    await this.evaluateWithThresholds(deviceId, thresholds, telemetry, assignments);
  }

  /**
   * Evaluate all user×param combinations and batch all DB writes.
   *
   * ─── OPTIMIZED ───
   * Old: For each (user, param) pair that triggers → 3 sequential DB calls (eventLog, notification, alertState upsert).
   *      At 5 users × 8 params = up to 120 DB writes per MQTT message, all sequential.
   * New: Two-pass approach:
   *   Pass 1 — Pure CPU: determine which transitions (NORMAL→ALERTING, ALERTING→NORMAL) fired.
   *   Pass 2 — Batch all DB writes in parallel:
   *              • eventLog.createMany (1 INSERT for all triggers+resolves)
   *              • notification.create × N (parallel, not sequential)
   *              • alertState.upsert × N (parallel, not sequential)
   *      Result: O(3) DB round-trips instead of O(N×M×3).
   */
  private async evaluateWithThresholds(
    deviceId: string,
    thresholds: Record<string, number>,
    telemetry: any,
    assignments: { userId: string }[],
  ) {
    const userIds = assignments.map((a) => a.userId);
    const params = Object.keys(thresholds);

    // Single query to fetch all current alert states for this device across all users + params
    const states = await this.repo.getAlertStates(deviceId, userIds, params);
    const stateMap = new Map(
      states.map((s) => [`${s.userId}:${s.parameter}`, s]),
    );

    // ─── Pass 1: Determine all transitions (pure CPU, no DB calls) ───
    const triggers: { userId: string; param: string; value: number; threshold: number }[] = [];
    const resolves: { userId: string; param: string; value: number }[] = [];

    for (const { userId } of assignments) {
      for (const param of params) {
        const threshold = thresholds[param];
        const value = telemetry[param];
        if (value == null) continue;

        const currentState = stateMap.get(`${userId}:${param}`)?.state ?? 'NORMAL';
        const hysteresis = Math.max(1, threshold * this.HYSTERESIS_PERCENT);
        const resolveLimit = threshold - hysteresis;

        if (currentState === 'NORMAL' && value > threshold) {
          triggers.push({ userId, param, value, threshold });
        } else if (currentState === 'ALERTING' && value < resolveLimit) {
          resolves.push({ userId, param, value });
        }
      }
    }

    // Short-circuit: nothing to write
    if (triggers.length === 0 && resolves.length === 0) return;

    // Log before writes (non-blocking)
    triggers.forEach((t) =>
      this.logger.warn(`🚨 Alert: ${t.param} ${t.value} > ${t.threshold} (User: ${t.userId})`),
    );
    resolves.forEach((r) =>
      this.logger.log(`✅ Resolve: ${r.param} ${r.value} (User: ${r.userId})`),
    );

    // ─── Pass 2: Batch all writes in parallel ───
    const [, notificationResults] = await Promise.all([
      // 1. Single createMany for ALL event logs (triggers + resolves combined)
      this.repo.batchCreateEventLogs([
        ...triggers.map((t) => ({
          deviceId,
          userId: t.userId,
          parameter: t.param,
          value: t.value,
          eventType: 'ALERT_TRIGGERED',
        })),
        ...resolves.map((r) => ({
          deviceId,
          userId: r.userId,
          parameter: r.param,
          value: r.value,
          eventType: 'ALERT_RESOLVED',
        })),
      ]),

      // 2. Create all notifications in parallel, tag each with userId for SSE dispatch
      Promise.all([
        ...triggers.map((t) =>
          this.repo
            .createNotification({
              userId: t.userId,
              deviceId,
              message: `${t.param.toUpperCase()} exceeded limit (${t.value} > ${t.threshold})`,
              thresholdValue: t.threshold,
            })
            .then((n) => ({ userId: t.userId, notification: n })),
        ),
        ...resolves.map((r) =>
          this.repo
            .createNotification({
              userId: r.userId,
              deviceId,
              message: `${r.param.toUpperCase()} returned to normal (${r.value})`,
            })
            .then((n) => ({ userId: r.userId, notification: n })),
        ),
      ]),

      // 3. Upsert all alert states in parallel
      Promise.all([
        ...triggers.map((t) =>
          this.repo.upsertAlertState({
            deviceId,
            userId: t.userId,
            parameter: t.param,
            state: 'ALERTING',
            lastTriggeredAt: new Date(),
          }),
        ),
        ...resolves.map((r) =>
          this.repo.upsertAlertState({
            deviceId,
            userId: r.userId,
            parameter: r.param,
            state: 'NORMAL',
            lastTriggeredAt: new Date(),
          }),
        ),
      ]),
    ]);

    // Emit SSE after all writes are confirmed
    for (const { userId, notification } of notificationResults) {
      this.sseService.sendEvent(userId, { type: 'NOTIFICATION', data: notification });
    }
  }
}
