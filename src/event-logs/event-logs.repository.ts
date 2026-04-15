import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EventLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get device events (ONLINE / OFFLINE) for users assigned to devices.
   * Joins UserDevice for friendly name and location.
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
    };

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          device: true,
        },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    // Get device meta for names/locations
    const deviceIds = [...new Set(items.map((i) => i.device.deviceId))];
    const metas = await this.prisma.userDevice.findMany({
      where: { userId, deviceId: { in: deviceIds } },
    });
    const metaMap = new Map(metas.map((m) => [m.deviceId, m]));

    const filtered = search
      ? items.filter((item) => {
          const meta = metaMap.get(item.device.deviceId);
          const name = meta?.name || item.device.deviceId;
          const location = meta?.location || '';
          const q = search.toLowerCase();
          return (
            name.toLowerCase().includes(q) ||
            item.device.deviceId.toLowerCase().includes(q) ||
            location.toLowerCase().includes(q)
          );
        })
      : items;

    return {
      total: search ? filtered.length : total,
      items: filtered.map((item) => {
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
   * Also fetches the matching Notification for thresholdValue.
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
    };

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { device: true },
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    // Get device meta for names
    const deviceIds = [...new Set(items.map((i) => i.device.deviceId))];
    const metas = await this.prisma.userDevice.findMany({
      where: { userId, deviceId: { in: deviceIds } },
    });
    const metaMap = new Map(metas.map((m) => [m.deviceId, m]));

    // For ALERT_TRIGGERED items, find their closest Notification to get thresholdValue
    // Match by userId + deviceId + createdAt proximity (within 5 seconds)
    const triggeredItems = items.filter((i) => i.eventType === 'ALERT_TRIGGERED');
    let notificationMap = new Map<string, number | null>();

    if (triggeredItems.length > 0) {
      const minDate = new Date(
        Math.min(...triggeredItems.map((i) => i.createdAt.getTime())) - 5000,
      );
      const maxDate = new Date(
        Math.max(...triggeredItems.map((i) => i.createdAt.getTime())) + 5000,
      );

      const notifications: Array<{
        deviceId: string | null;
        thresholdValue: number | null;
        createdAt: Date;
      }> = await (this.prisma.notification.findMany as any)({
        where: {
          userId,
          createdAt: { gte: minDate, lte: maxDate },
          thresholdValue: { not: null },
        },
        select: {
          deviceId: true,
          thresholdValue: true,
          createdAt: true,
        },
      });

      // Build a key lookup: itemId → closest thresholdValue for each triggered event
      for (const item of triggeredItems) {
        const key = `${item.id}`;
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
        notificationMap.set(key, match?.thresholdValue ?? null);
      }
    }

    // Parameter → unit mapping
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

    const mapped = items.map((item) => {
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
    });

    const filtered = search
      ? mapped.filter((item) => {
          const q = search.toLowerCase();
          return (
            item.deviceName.toLowerCase().includes(q) ||
            item.deviceId.toLowerCase().includes(q) ||
            item.parameter.toLowerCase().includes(q)
          );
        })
      : mapped;

    return {
      total: search ? filtered.length : total,
      items: filtered,
    };
  }
}
