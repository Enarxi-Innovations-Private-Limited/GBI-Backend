import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get device events (ONLINE / OFFLINE) for users assigned to devices.
   *
   * ─── OPTIMIZED ───
   * Old: search was applied IN APPLICATION LOGIC after DB fetch, causing two bugs:
   *   1. `total` reflected pre-filter DB count but items were post-filter → broken pagination.
   *   2. Forced fetching full pages then discarding unmatched rows in JS.
   * New: search is pushed into the WHERE clause. DB does the filtering.
   *      `total` now always matches the filtered item count — pagination is correct.
   *      Uses new @@index([userId, eventType, createdAt]) for efficient range reads.
   */
  async getDeviceEvents(
    userId: string,
    skip: number,
    take: number,
    search?: string,
  ) {
    const where: any = {
      userId,
      eventType: { in: ['ONLINE', 'OFFLINE'] },
      // Push search into SQL WHERE — remove from application-level filter
      ...(search
        ? {
            device: {
              deviceId: { contains: search, mode: 'insensitive' },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          device: {
            select: { id: true, deviceId: true },
          },
        },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    // Fetch meta for the devices on THIS PAGE ONLY — not the entire user device list
    const deviceIdsOnPage = [...new Set(items.map((i) => i.device.deviceId))];
    const metas =
      deviceIdsOnPage.length > 0
        ? await this.prisma.userDevice.findMany({
            where: { userId, deviceId: { in: deviceIdsOnPage } },
          })
        : [];
    const metaMap = new Map(metas.map((m) => [m.deviceId, m]));

    return {
      total, // Always correct whether search is active or not
      items: items.map((item) => {
        const meta = metaMap.get(item.device.deviceId);
        return {
          id: item.id.toString(),
          createdAt: item.createdAt.toISOString(),
          deviceId: item.device.deviceId,
          deviceName: meta?.name || item.device.deviceId,
          location: meta?.location || null,
          status: item.eventType, // 'ONLINE' | 'OFFLINE'
        };
      }),
    };
  }

  /**
   * Get sensor events (ALERT_TRIGGERED / ALERT_RESOLVED) for the user's devices.
   *
   * ─── OPTIMIZED ───
   * Old: search applied in JS → broken pagination (same issue as getDeviceEvents).
   *      Notification proximity matching done with .filter() + .sort() in JS
   *      after pulling a wide time-window of notifications into memory.
   * New: search pushed into WHERE clause → correct DB-side pagination.
   *      Notification fetch scoped to ONLY the triggered events on the current page
   *      (not a wide global time window), reducing notification rows pulled into Node.
   */
  async getSensorEvents(
    userId: string,
    skip: number,
    take: number,
    search?: string,
  ) {
    const where: any = {
      userId,
      eventType: { in: ['ALERT_TRIGGERED', 'ALERT_RESOLVED'] },
      parameter: { not: null },
      // Push search into SQL WHERE
      ...(search
        ? {
            device: {
              deviceId: { contains: search, mode: 'insensitive' },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          device: {
            select: { id: true, deviceId: true },
          },
        },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    // Fetch meta for the devices on THIS PAGE ONLY
    const deviceIdsOnPage = [...new Set(items.map((i) => i.device.deviceId))];
    const metas =
      deviceIdsOnPage.length > 0
        ? await this.prisma.userDevice.findMany({
            where: { userId, deviceId: { in: deviceIdsOnPage } },
          })
        : [];
    const metaMap = new Map(metas.map((m) => [m.deviceId, m]));

    // Only fetch notifications for ALERT_TRIGGERED items on this page (narrow scope)
    const triggeredItems = items.filter((i) => i.eventType === 'ALERT_TRIGGERED');
    const notificationMap = new Map<string, number | null>();

    if (triggeredItems.length > 0) {
      // Scope notification fetch to a tight 10-second window around items on THIS page
      const minDate = new Date(
        Math.min(...triggeredItems.map((i) => i.createdAt.getTime())) - 5000,
      );
      const maxDate = new Date(
        Math.max(...triggeredItems.map((i) => i.createdAt.getTime())) + 5000,
      );

      const notifications = await this.prisma.notification.findMany({
        where: {
          userId,
          createdAt: { gte: minDate, lte: maxDate },
          thresholdValue: { not: null },
          // Further scope to devices on this page only
          deviceId: { in: triggeredItems.map((i) => i.device.id) },
        },
        select: { deviceId: true, thresholdValue: true, createdAt: true },
      });

      // Build proximity match map keyed by event item id
      for (const item of triggeredItems) {
        const match = notifications
          .filter(
            (n) =>
              n.deviceId === item.device.id &&
              Math.abs(n.createdAt.getTime() - item.createdAt.getTime()) <= 5000,
          )
          .sort(
            (a, b) =>
              Math.abs(a.createdAt.getTime() - item.createdAt.getTime()) -
              Math.abs(b.createdAt.getTime() - item.createdAt.getTime()),
          )[0];
        notificationMap.set(`${item.id}`, match?.thresholdValue ?? null);
      }
    }

    const UNIT_MAP: Record<string, string> = {
      pm25: 'µg/m³',
      pm10: 'µg/m³',
      tvoc: 'ppb',
      co2: 'ppm',
      temperature: '°C',
      humidity: '%',
      noise: 'dB',
      aqi: '',
    };

    const PARAM_LABEL: Record<string, string> = {
      pm25: 'PM2.5',
      pm10: 'PM10',
      tvoc: 'TVOC',
      co2: 'CO2',
      temperature: 'Temp',
      humidity: 'Humidity',
      noise: 'Noise',
      aqi: 'AQI',
    };

    return {
      total, // Always correct whether search is active or not
      items: items.map((item) => {
        const meta = metaMap.get(item.device.deviceId);
        const param = item.parameter || '';
        const unit = UNIT_MAP[param] ?? '';
        const thresholdValue =
          item.eventType === 'ALERT_TRIGGERED'
            ? notificationMap.get(`${item.id}`) ?? null
            : null;

        return {
          id: item.id.toString(),
          createdAt: item.createdAt.toISOString(),
          deviceId: item.device.deviceId,
          deviceName: meta?.name || item.device.deviceId,
          parameter: PARAM_LABEL[param] || param,
          condition: item.eventType === 'ALERT_TRIGGERED' ? 'Above' : 'Resolved',
          value: item.value,
          unit,
          thresholdValue,
        };
      }),
    };
  }
}
