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
   * Industrial best practice for computing aggregation intervals.
   * Targets approximately 20-30 data points per chart to maintain
   * trend clarity and reduce visual noise across any time range.
   */
  static autoInterval(start: Date, end: Date): number {
    const diffMs = Math.abs(end.getTime() - start.getTime());
    const diffMinutes = diffMs / (1000 * 60);

    // If range is extremely small (e.g. 15 mins), show every minute
    if (diffMinutes <= 15) return 1;

    // Target ~50 points for optimal readability and detail density (e.g. 50-60 points in viewport)
    const rawInterval = diffMinutes / 50;

    // Standard industrial buckets (in minutes)
    const buckets = [
      1,
      2,
      3,
      5,
      10,
      15,
      30, // Small ranges
      60,
      120,
      180,
      240,
      360,
      720, // 1h to 12h
      1440,
      2880,
      4320,
      10080,
      43200, // 1d to 1m
    ];

    // Find the closest bucket using nearest-neighbor rounding
    let snapped = buckets[0];
    let minDiff = Math.abs(buckets[0] - rawInterval);
    for (let i = 1; i < buckets.length; i++) {
      const diff = Math.abs(buckets[i] - rawInterval);
      if (diff < minDiff) {
        minDiff = diff;
        snapped = buckets[i];
      }
    }

    return snapped;
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
    const safeParams = params.filter((p) => ALLOWED_PARAMS.includes(p)).sort(); // Sort for consistent cache key

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

    const selectAgg = Prisma.join(
      safeParams.map(
        (param) =>
          Prisma.sql`AVG("${Prisma.raw(param)}") as "${Prisma.raw(param)}", MAX("${Prisma.raw(param)}") as "peak_${Prisma.raw(param)}"`,
      ),
      ', ',
    );

    if (interval === 1) {
      // Optimized for 1-minute high-resolution data
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
      // General epoch-based bucketing for any interval > 1
      // This works for custom durations (e.g. 5m, 30m, 2h, 1d)
      rows = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            to_timestamp(floor(extract(epoch from "timestamp") / (${interval} * 60)) * (${interval} * 60)) as "timestamp",
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
  formatTelemetryRows(
    rawRows: BucketedRow[],
    orderedParams: string[],
  ): FormattedRow[] {
    return rawRows.map((row) => {
      const processedRow: FormattedRow = {
        deviceId: row.deviceId,
        Date: '',
        Time: '',
      };

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
        const getPart = (type) =>
          parts.find((p) => p.type === type)?.value || '';

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
