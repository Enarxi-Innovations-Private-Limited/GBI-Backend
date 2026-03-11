import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { Prisma, ReportType } from '@prisma/client';
import { PdfService } from './pdf.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const CSV_COLUMN_LABELS: Record<string, string> = {
  Date: 'Date',
  Time: 'Time',
  aqi: 'AQI',
  pm25: 'PM2.5 (\u00b5g/m\u00b3)',
  pm10: 'PM10 (\u00b5g/m\u00b3)',
  tvoc: 'TVOC (ppb)',
  co2: 'CO2 (ppm)',
  temperature: 'Temperature (\u00b0C)',
  humidity: 'Humidity (%)',
  noise: 'Noise (dB)',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    @InjectQueue('reports') private readonly reportsQueue: Queue,
  ) {}

  // --- Async Report Flow ---

  async enqueueReport(
    userId: string,
    type: 'csv' | 'pdf',
    dto: GenerateReportDto,
  ) {
    // 1) Validate ownership before enqueueing
    await this.validateAndGetDevice(userId, dto.deviceId);

    // 2) Add job to BullMQ
    const job = await this.reportsQueue.add(
      type,
      { type, userId, dto },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true, // we track completion in Prisma
        removeOnFail: false, // useful for debugging failed jobs
      },
    );

    // 3) Create Prisma metadata record using BullMQ's generated job.id
    if (!job.id) {
      throw new BadRequestException('Failed to generate report job ID');
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24h

    await this.prisma.generatedReport.create({
      data: {
        id: job.id,
        userId,
        type: type === 'csv' ? ReportType.CSV : ReportType.PDF,
        expiresAt,
      },
    });

    return { jobId: job.id };
  }

  async getReportStatus(userId: string, jobId: string) {
    // 1) Verify ownership
    const reportMetadata = await this.prisma.generatedReport.findUnique({
      where: { id: jobId },
    });

    if (!reportMetadata) {
      throw new BadRequestException('Report job not found');
    }

    if (reportMetadata.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // 2) Source of Truth: BullMQ
    const job = await this.reportsQueue.getJob(jobId);

    if (!job) {
      // If job isn't in BullMQ, it's either completed (and removed) or expired.
      if (reportMetadata.fileKey) {
        return { status: 'completed', fileKey: reportMetadata.fileKey };
      }
      return { status: 'failed', error: 'Job disappeared before completion' };
    }

    const state = await job.getState();

    if (state === 'completed') {
      // It might take a millisec for Prisma to update after completion
      if (reportMetadata.fileKey) {
        return { status: 'completed', fileKey: reportMetadata.fileKey };
      }
      return { status: 'processing' };
    }

    if (state === 'failed') {
      return { status: 'failed', error: job.failedReason };
    }

    // waiting, active, delayed, etc.
    return { status: 'processing', rawState: state };
  }

  async getUserReports(userId: string) {
    return this.prisma.generatedReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        createdAt: true,
        expiresAt: true,
        fileKey: true,
      },
    });
  }

  // --- Internal Generation Methods (Called by Processor) ---

  async generateCsv(userId: string, dto: GenerateReportDto): Promise<string> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    // 1) Validate ownership
    const device = await this.validateAndGetDevice(userId, dto.deviceId);

    // 2) Query telemetry using bucketing (raw SQL)
    const rawRows: any[] = await this.queryBucketedTelemetry(
      [device],
      dto.parameters,
      start,
      end,
      interval,
    );

    // Canonical column order — always render in this sequence regardless of request order
    const CANONICAL_ORDER = [
      'aqi',
      'pm25',
      'pm10',
      'tvoc',
      'co2',
      'temperature',
      'humidity',
      'noise',
    ];
    const orderedParams = CANONICAL_ORDER.filter((p) =>
      dto.parameters.includes(p),
    );

    // 3) Process rows: Date/Time formatting (IST) & Rounding
    const rows = this.formatTelemetryRows(rawRows, orderedParams);

    // 4) Build Custom CSV String
    const columns = ['Date', 'Time', 'deviceId', ...orderedParams];
    const totalCols = columns.length;

    // Helper to center text by padding with commas
    const centerText = (text: string) => {
      const leftCommas = Math.floor((totalCols - 1) / 2);
      const rightCommas = totalCols - 1 - leftCommas;
      return `${','.repeat(leftCommas)}${text}${','.repeat(rightCommas)}`;
    };

    // Format start/end strings for the header manually to avoid commas
    const formatHeaderDate = (d: Date) => {
      const ts = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);

      const dd = String(ts.getUTCDate()).padStart(2, '0');
      const mm = String(ts.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = ts.getUTCFullYear();

      let hoursStr = ts.getUTCHours();
      const ampm = hoursStr >= 12 ? 'PM' : 'AM';
      hoursStr = hoursStr % 12 || 12;
      const hours = String(hoursStr).padStart(2, '0');
      const minutes = String(ts.getUTCMinutes()).padStart(2, '0');

      return `${dd}-${mm}-${yyyy} ${hours}:${minutes} ${ampm}`;
    };
    const dateRangeText = `${formatHeaderDate(start)} - ${formatHeaderDate(end)}`;

    const lines: string[] = [];

    // Row 1: Main Title
    lines.push(centerText('GBI Air Quality Monitor - Report'));
    // Row 2: Empty
    lines.push(','.repeat(totalCols - 1));
    // Row 3: Date Range
    lines.push(centerText(dateRangeText));
    // Row 4: Empty
    lines.push(','.repeat(totalCols - 1));

    // Group rows by deviceId to add spacing and device headers
    const rowsByDevice: Record<string, any[]> = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!rowsByDevice[row.deviceId]) {
        rowsByDevice[row.deviceId] = [];
      }
      rowsByDevice[row.deviceId].push(row);
    }

    // Use the exact device ID the user provided in the request query
    const deviceId = dto.deviceId;

    // Row 5 (or dynamically placed): Device Name Title
    lines.push(centerText(`Device - ${deviceId}`));
    // Row 6: Empty
    lines.push(','.repeat(totalCols - 1));
    // Row 7: Column Headers
    const headerRow = new Array(columns.length);
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      headerRow[i] = CSV_COLUMN_LABELS[col] ?? col;
    }
    lines.push(headerRow.join(','));

    // Data Rows
    const deviceRows = rowsByDevice[deviceId] || [];

    if (deviceRows.length === 0) {
      // Print empty row to show column headers but no data
      lines.push(','.repeat(totalCols - 1));
    } else {
      for (let i = 0; i < deviceRows.length; i++) {
        const row = deviceRows[i];
        const rowData = new Array(columns.length);
        for (let j = 0; j < columns.length; j++) {
          const col = columns[j];
          const val = row[col];
          rowData[j] = val === null || val === undefined ? '' : String(val);
        }
        lines.push(rowData.join(','));
      }
    }

    return '\ufeff' + lines.join('\n');
  }

  async generatePdf(userId: string, dto: GenerateReportDto): Promise<Buffer> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    // 1) Validate ownership
    const device = await this.validateAndGetDevice(userId, dto.deviceId);

    // 2) Query telemetry using bucketing (raw SQL)
    const rawRows: any[] = await this.queryBucketedTelemetry(
      [device],
      dto.parameters,
      start,
      end,
      interval,
    );

    // Canonical column order — always render in this sequence regardless of request order
    const CANONICAL_ORDER = [
      'aqi',
      'pm25',
      'pm10',
      'tvoc',
      'co2',
      'temperature',
      'humidity',
      'noise',
    ];

    // Only keep params that were requested, in canonical order (drop anything missing)
    const orderedParams = CANONICAL_ORDER.filter((p) =>
      dto.parameters.includes(p),
    );

    // 3) Process rows: Date/Time formatting (IST) & Rounding
    const rows = this.formatTelemetryRows(rawRows, orderedParams);

    // 4) Group rows by deviceId
    const rowsByDevice: Record<string, any[]> = {};
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!rowsByDevice[row.deviceId]) {
        rowsByDevice[row.deviceId] = [];
      }
      rowsByDevice[row.deviceId].push(row);
    }

    // 5) Fetch device friendly names from UserDevice table.
    //    Old claim code stored device.id (UUID) in UserDevice.deviceId;
    //    new claim code stores device.deviceId (display string).
    //    We query with OR to handle both, then normalise to display ID.
    const uuidToDisplay = new Map([[device.id, device.deviceId]]);

    const userDevices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        OR: [
          { deviceId: device.id }, // old data: UUID stored
          { deviceId: dto.deviceId }, // new data: display ID stored
        ],
      },
      select: { deviceId: true, name: true },
    });

    const deviceNames: Record<string, string> = {};
    for (const ud of userDevices) {
      if (!ud.name) continue;
      // If deviceId is a UUID key, map it to the display ID
      const displayId = uuidToDisplay.get(ud.deviceId) ?? ud.deviceId;
      deviceNames[displayId] = ud.name;
    }

    return this.pdfService.generateReport({
      deviceId: dto.deviceId,
      start,
      end,
      columns: ['Date', 'Time', ...orderedParams],
      rowsByDevice,
      deviceNames,
    });
  }

  private async queryBucketedTelemetry(
    devices: { id: string; deviceId: string }[],
    params: string[],
    start: Date,
    end: Date,
    interval: number,
  ) {
    if (!devices.length || !params.length) return [];

    const uuidList = devices.map((d) => d.id);

    const deviceIdMap = new Map(devices.map((d) => [d.id, d.deviceId]));

    const allowedParams = [
      'pm25',
      'pm10',
      'temperature',
      'humidity',
      'co2',
      'tvoc',
      'noise',
      'aqi',
    ];

    const safeParams = params.filter((p) => allowedParams.includes(p));

    if (!safeParams.length) return [];

    let rows: any[] = [];

    if (interval === 60 || interval === 360) {
      const selectCols = Prisma.join(
        safeParams.map((param) => Prisma.sql`"${Prisma.raw(param)}"`),
        ', ',
      );

      rows = await this.prisma.$queryRaw(
        Prisma.sql`
        SELECT DISTINCT ON ("timestamp_bucket", "deviceId")
          to_timestamp(floor(extract(epoch from "timestamp") / (${interval} * 60)) * (${interval} * 60)) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as "timestamp_bucket",
          "deviceId",
          "timestamp" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as "original_timestamp",
          ${selectCols}
        FROM "DeviceTelemetry"
        WHERE "deviceId" IN (${Prisma.join(uuidList)})
        AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp
        ORDER BY
          "timestamp_bucket" ASC,
          "deviceId" ASC,
          "timestamp" ASC
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
          date_trunc('minute', "timestamp") AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as "timestamp",

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
            - (extract(minute from "timestamp")::int % ${interval})
              * interval '1 minute'
          ) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' as "timestamp",

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

    for (let i = 0; i < rows.length; i++) {
      rows[i].timestamp = rows[i].timestamp_bucket || rows[i].timestamp;
      rows[i].deviceId = deviceIdMap.get(rows[i].deviceId);
    }
    return rows;
  }

  // --- Shared Private Helpers ---

  private async validateAndGetDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
      select: { id: true, deviceId: true },
    });

    if (!device) {
      throw new ForbiddenException('No valid device found');
    }

    const assignment = await this.prisma.deviceAssignment.findFirst({
      where: {
        userId,
        deviceId: device.id,
        unassignedAt: null,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('This device is not assigned to you');
    }

    return device;
  }

  private formatTelemetryRows(rawRows: any[], orderedParams: string[]): any[] {
    const rows = new Array(rawRows.length);
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const processedRow: any = { deviceId: row.deviceId };

      if (row.timestamp) {
        const ts = new Date(row.timestamp);

        const dd = String(ts.getUTCDate()).padStart(2, '0');
        const mm = String(ts.getUTCMonth() + 1).padStart(2, '0'); // January is 0!
        const yyyy = ts.getUTCFullYear();

        const hours = String(ts.getUTCHours()).padStart(2, '0');
        const minutes = String(ts.getUTCMinutes()).padStart(2, '0');

        processedRow.Date = `${dd}-${mm}-${yyyy}`;
        processedRow.Time = `${hours}:${minutes}`;
      }

      for (let j = 0; j < orderedParams.length; j++) {
        const param = orderedParams[j];
        if (row[param] !== null && row[param] !== undefined) {
          if (param === 'temperature') {
            // Keep 1 decimal place for temperature
            processedRow[param] = Math.round(Number(row[param]) * 10) / 10;
          } else {
            // Drop to 0 decimal places for all others
            processedRow[param] = Math.round(Number(row[param]));
          }
        } else {
          processedRow[param] = null;
        }
      }

      rows[i] = processedRow;
    }
    return rows;
  }
}
