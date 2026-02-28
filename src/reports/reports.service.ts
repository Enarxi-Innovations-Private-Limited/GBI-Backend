import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { Parser } from 'json2csv';
import { Prisma } from '@prisma/client';
import { PdfService } from './pdf.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async generateCsv(userId: string, dto: GenerateReportDto): Promise<string> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    // 1) Validate ownership
    const devices = await this.prisma.device.findMany({
      where: { deviceId: { in: dto.deviceIds } },
      select: { id: true, deviceId: true },
    });

    if (devices.length === 0) {
      throw new ForbiddenException('No valid devices found');
    }

    const deviceIdsUuid = devices.map((d) => d.id);

    const assignments = await this.prisma.deviceAssignment.findMany({
      where: {
        userId,
        deviceId: { in: deviceIdsUuid },
        unassignedAt: null,
      },
    });

    if (assignments.length !== deviceIdsUuid.length) {
      throw new ForbiddenException(
        'One or more devices are not assigned to you',
      );
    }

    // 2) Query telemetry using bucketing (raw SQL)
    const rawRows: any[] = await this.queryBucketedTelemetry(
      devices,
      dto.parameters,
      start,
      end,
      interval,
    );

    // 3) Process rows: Date/Time formatting (IST) & Rounding
    const rows = rawRows.map((row) => {
      const processedRow: any = { deviceId: row.deviceId };

      // Convert timestamp to IST and split into Date (DD:MM:YYYY) and Time
      if (row.timestamp) {
        const istDate = new Date(
          new Date(row.timestamp).toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
          }),
        );

        const dd = String(istDate.getDate()).padStart(2, '0');
        const mm = String(istDate.getMonth() + 1).padStart(2, '0'); // January is 0!
        const yyyy = istDate.getFullYear();

        const hours = String(istDate.getHours()).padStart(2, '0');
        const minutes = String(istDate.getMinutes()).padStart(2, '0');
        const seconds = String(istDate.getSeconds()).padStart(2, '0');

        processedRow.Date = `${dd}-${mm}-${yyyy}`;
        processedRow.Time = `${hours}:${minutes}`;
      }

      // Round parameters
      dto.parameters.forEach((param) => {
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
      });

      return processedRow;
    });

    // 4) Build Custom CSV String
    const columns = ['Date', 'Time', 'deviceId', ...dto.parameters];
    const totalCols = columns.length;

    // Helper to center text by padding with commas
    const centerText = (text: string) => {
      const leftCommas = Math.floor((totalCols - 1) / 2);
      const rightCommas = totalCols - 1 - leftCommas;
      return `${','.repeat(leftCommas)}${text}${','.repeat(rightCommas)}`;
    };

    // Format start/end strings for the header manually to avoid commas
    const formatHeaderDate = (d: Date) => {
      const istDate = new Date(
        new Date(d).toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
        }),
      );

      const dd = String(istDate.getDate()).padStart(2, '0');
      const mm = String(istDate.getMonth() + 1).padStart(2, '0');
      const yyyy = istDate.getFullYear();

      let hoursStr = istDate.getHours();
      const ampm = hoursStr >= 12 ? 'PM' : 'AM';
      hoursStr = hoursStr % 12;
      hoursStr = hoursStr ? hoursStr : 12; // the hour '0' should be '12'
      const hours = String(hoursStr).padStart(2, '0');
      const minutes = String(istDate.getMinutes()).padStart(2, '0');

      return `${dd}-${mm}-${yyyy} ${hours}:${minutes} ${ampm}`;
    };
    const dateRangeText = `${formatHeaderDate(start)} - ${formatHeaderDate(end)}`;

    let csvContent = '';

    // Row 1: Main Title
    csvContent += `${centerText('GBI Air Quality Monitor - Report')}\n`;
    // Row 2: Empty
    csvContent += `${','.repeat(totalCols - 1)}\n`;
    // Row 3: Date Range
    csvContent += `${centerText(dateRangeText)}\n`;
    // Row 4: Empty
    csvContent += `${','.repeat(totalCols - 1)}\n`;

    // Group rows by deviceId to add spacing and device headers
    const rowsByDevice: Record<string, any[]> = {};
    for (const row of rows) {
      if (!rowsByDevice[row.deviceId]) {
        rowsByDevice[row.deviceId] = [];
      }
      rowsByDevice[row.deviceId].push(row);
    }

    // Use the exact array of IDs the user provided in the request query to guarantee order
    const deviceIds = dto.deviceIds;

    deviceIds.forEach((deviceId, index) => {
      // Row 5 (or dynamically placed): Device Name Title
      csvContent += `${centerText(`Device - ${deviceId}`)}\n`;
      // Row 6: Empty
      csvContent += `${','.repeat(totalCols - 1)}\n`;
      // Row 7: Column Headers
      csvContent += `${columns.join(',')}\n`;

      // Data Rows
      const deviceRows = rowsByDevice[deviceId] || [];

      if (deviceRows.length === 0) {
        // Print empty row to show column headers but no data
        csvContent += `${','.repeat(totalCols - 1)}\n`;
      } else {
        for (const row of deviceRows) {
          const rowData = columns.map((col) => {
            const val = row[col];
            return val === null || val === undefined ? '' : String(val);
          });
          csvContent += `${rowData.join(',')}\n`;
        }
      }

      // Add two empty rows between devices (if not the last device)
      if (index < deviceIds.length - 1) {
        csvContent += `${','.repeat(totalCols - 1)}\n`;
        csvContent += `${','.repeat(totalCols - 1)}\n`;
      }
    });

    return csvContent;
  }

  async generatePdf(userId: string, dto: GenerateReportDto): Promise<Buffer> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    // 1) Validate ownership
    const devices = await this.prisma.device.findMany({
      where: { deviceId: { in: dto.deviceIds } },
      select: { id: true, deviceId: true },
    });

    if (devices.length === 0) {
      throw new ForbiddenException('No valid devices found');
    }

    const deviceIdsUuid = devices.map((d) => d.id);

    const assignments = await this.prisma.deviceAssignment.findMany({
      where: {
        userId,
        deviceId: { in: deviceIdsUuid },
        unassignedAt: null,
      },
    });

    if (assignments.length !== deviceIdsUuid.length) {
      throw new ForbiddenException(
        'One or more devices are not assigned to you',
      );
    }

    // 2) Query telemetry using bucketing (raw SQL)
    const rawRows: any[] = await this.queryBucketedTelemetry(
      devices,
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
    const rows = rawRows.map((row) => {
      const processedRow: any = { deviceId: row.deviceId };

      if (row.timestamp) {
        const istDate = new Date(
          new Date(row.timestamp).toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
          }),
        );
        const dd = String(istDate.getDate()).padStart(2, '0');
        const mm = String(istDate.getMonth() + 1).padStart(2, '0');
        const yyyy = istDate.getFullYear();
        const hours = String(istDate.getHours()).padStart(2, '0');
        const minutes = String(istDate.getMinutes()).padStart(2, '0');
        const seconds = String(istDate.getSeconds()).padStart(2, '0');

        processedRow.Date = `${dd}-${mm}-${yyyy}`;
        processedRow.Time = `${hours}:${minutes}`;
      }

      // Round using orderedParams (canonical order)
      orderedParams.forEach((param) => {
        if (row[param] !== null && row[param] !== undefined) {
          if (param === 'temperature') {
            processedRow[param] = Math.round(Number(row[param]) * 10) / 10;
          } else {
            processedRow[param] = Math.round(Number(row[param]));
          }
        } else {
          processedRow[param] = null;
        }
      });
      return processedRow;
    });

    // 4) Group rows by deviceId
    const rowsByDevice: Record<string, any[]> = {};
    for (const row of rows) {
      if (!rowsByDevice[row.deviceId]) {
        rowsByDevice[row.deviceId] = [];
      }
      rowsByDevice[row.deviceId].push(row);
    }

    // 5) Fetch device friendly names from UserDevice table.
    //    Old claim code stored device.id (UUID) in UserDevice.deviceId;
    //    new claim code stores device.deviceId (display string).
    //    We query with OR to handle both, then normalise to display ID.
    const uuidToDisplay = new Map(devices.map((d) => [d.id, d.deviceId]));

    const userDevices = await this.prisma.userDevice.findMany({
      where: {
        userId,
        OR: [
          { deviceId: { in: deviceIdsUuid } }, // old data: UUID stored
          { deviceId: { in: dto.deviceIds } }, // new data: display ID stored
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
      deviceIds: dto.deviceIds,
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

    const selectAgg = Prisma.join(
      safeParams.map(
        (param) =>
          Prisma.sql`AVG("${Prisma.raw(param)}") as "${Prisma.raw(param)}"`,
      ),
      ', ',
    );

    const rows: any[] = await this.prisma.$queryRaw(
      Prisma.sql`
      SELECT
        (
          date_trunc('minute', "timestamp")
          - (extract(minute from "timestamp")::int % ${interval})
            * interval '1 minute'
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

    return rows.map((row) => ({
      ...row,
      deviceId: deviceIdMap.get(row.deviceId),
    }));
  }
}
