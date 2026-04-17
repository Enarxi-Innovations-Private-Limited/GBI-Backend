import { Injectable, Inject, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { Redis } from 'ioredis';

const ALLOWED_PARAMS = [
  'pm25',
  'pm10',
  'temperature',
  'humidity',
  'co2',
  'tvoc',
  'noise',
  'aqi',
];

export interface BucketedRow {
  timestamp: Date;
  deviceId: string; // display ID e.g. "GBIAIR1000"
  [param: string]: any;
}

export interface FormattedRow {
  deviceId: string;
  Date: string;
  Time: string;
  [param: string]: any;
}

@Injectable()
export class TelemetryQueryService {
  private readonly logger = new Logger(TelemetryQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Compute a sensible default interval based on range length.
   */
  static autoInterval(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= 1) return 1;
    if (diffHours <= 24) return 5;
    if (diffHours <= 24 * 7) return 60;
    return 360;
  }

  /**
   * Run time-bucketed telemetry query across one or more devices.
   * @param devices  Array of { id: UUID, deviceId: display string }
   * @param params   List of metric keys e.g. ['pm25', 'co2']
   * @param start    Start of range
   * @param end      End of range
   * @param interval Bucket size in minutes
   */
  async queryBucketedTelemetry(
    devices: { id: string; deviceId: string }[],
    params: string[],
    start: Date,
    end: Date,
    interval: number,
  ): Promise<BucketedRow[]> {
    if (!devices.length || !params.length) return [];

    const uuidList = devices.map((d) => d.id).sort(); // Sort for consistent cache key
    const safeParams = params
      .filter((p) => ALLOWED_PARAMS.includes(p))
      .sort(); // Sort for consistent cache key

    if (!safeParams.length) return [];

    // --- Cache Lookup ---
    const cacheKey = `telemetry:bucketed:${uuidList.join(',')}:${safeParams.join(',')}:${start.getTime()}:${end.getTime()}:${interval}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis cache lookup failed: ${err.message}`);
    }

    const deviceIdMap = new Map(devices.map((d) => [d.id, d.deviceId]));

    let rows: any[] = [];

    if (interval === 60 || interval === 360) {
      const selectCols = Prisma.join(
        safeParams.map((param) => Prisma.sql`"${Prisma.raw(param)}"`),
        ', ',
      );

      rows = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT DISTINCT ON ("timestamp_bucket", "deviceId")
            to_timestamp(floor(extract(epoch from "timestamp") / (${interval} * 60)) * (${interval} * 60)) as "timestamp_bucket",
            "deviceId",
            "timestamp" as "original_timestamp",
            ${selectCols}
          FROM "DeviceTelemetry"
          WHERE "deviceId" IN (${Prisma.join(uuidList)})
            AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp
          ORDER BY "timestamp_bucket" ASC, "deviceId" ASC, "timestamp" ASC
        `,
      );
    } else if (interval === 1) {
      const selectAgg = Prisma.join(
        safeParams.map(
          (param) =>
            Prisma.sql`AVG("${Prisma.raw(param)}") as "${Prisma.raw(param)}"`,
        ),
        ', ',
      );

      rows = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            date_trunc('minute', "timestamp") as "timestamp",
            "deviceId",
            ${selectAgg}
          FROM "DeviceTelemetry"
          WHERE "deviceId" IN (${Prisma.join(uuidList)})
            AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp
          GROUP BY 1, "deviceId"
          ORDER BY 1 ASC, "deviceId" ASC
        `,
      );
    } else {
      const selectAgg = Prisma.join(
        safeParams.map(
          (param) =>
            Prisma.sql`AVG("${Prisma.raw(param)}") as "${Prisma.raw(param)}"`,
        ),
        ', ',
      );

      rows = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            (
              date_trunc('minute', "timestamp")
              - (extract(minute from "timestamp")::int % ${interval}) * interval '1 minute'
            ) as "timestamp",
            "deviceId",
            ${selectAgg}
          FROM "DeviceTelemetry"
          WHERE "deviceId" IN (${Prisma.join(uuidList)})
            AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp
          GROUP BY 1, "deviceId"
          ORDER BY 1 ASC, "deviceId" ASC
        `,
      );
    }

    // Normalise: resolve UUID → display ID, unify timestamp field
    for (let i = 0; i < rows.length; i++) {
      rows[i].timestamp = rows[i].timestamp_bucket ?? rows[i].timestamp;
      rows[i].deviceId = deviceIdMap.get(rows[i].deviceId) ?? rows[i].deviceId;
    }

    // --- Cache Store ---
    try {
      // Cache for 60 seconds (safe for near-realtime dashboards)
      await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', 60);
    } catch (err) {
      this.logger.warn(`Redis cache store failed: ${err.message}`);
    }

    return rows as BucketedRow[];
  }

  /**
   * Format raw bucketed rows into human-readable Date/Time strings,
   * rounding numeric values appropriately.
   */
  formatTelemetryRows(rawRows: BucketedRow[], orderedParams: string[]): FormattedRow[] {
    return rawRows.map((row) => {
      const processedRow: FormattedRow = { deviceId: row.deviceId, Date: '', Time: '' };

      if (row.timestamp) {
        const ts = new Date(row.timestamp);
        // Use Intl.DateTimeFormat to ensure IST (Asia/Kolkata) in reports
        const formatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const parts = formatter.formatToParts(ts);
        const getPart = (type) => parts.find((p) => p.type === type)?.value || '';

        processedRow.Date = `${getPart('day')}-${getPart('month')}-${getPart('year')}`;
        processedRow.Time = `${getPart('hour')}:${getPart('minute')}`;
      }

      for (const param of orderedParams) {
        const v = row[param];
        if (v !== null && v !== undefined) {
          processedRow[param] =
            param === 'temperature'
              ? Math.round(Number(v) * 10) / 10
              : Math.round(Number(v));
        } else {
          processedRow[param] = null;
        }
      }

      return processedRow;
    });
  }
}
