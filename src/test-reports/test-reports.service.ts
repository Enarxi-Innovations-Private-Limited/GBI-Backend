import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateReportDto } from 'src/reports/dto/generate-report.dto';
import { PdfService } from 'src/reports/pdf.service';
import { Prisma } from '@prisma/client';

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
export class TestReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async generateCsv(dto: GenerateReportDto): Promise<string> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    const rawRows: any[] = await this.queryBucketedTelemetry(
      dto.deviceId,
      dto.parameters,
      start,
      end,
      interval,
    );

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

        processedRow.Date = `${dd}-${mm}-${yyyy}`;
        processedRow.Time = `${hours}:${minutes}`;
      }

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

    const columns = ['Date', 'Time', 'deviceId', ...orderedParams];
    const totalCols = columns.length;

    const centerText = (text: string) => {
      const leftCommas = Math.floor((totalCols - 1) / 2);
      const rightCommas = totalCols - 1 - leftCommas;
      return `${','.repeat(leftCommas)}${text}${','.repeat(rightCommas)}`;
    };

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
      hoursStr = hoursStr ? hoursStr : 12;
      const hours = String(hoursStr).padStart(2, '0');
      const minutes = String(istDate.getMinutes()).padStart(2, '0');

      return `${dd}-${mm}-${yyyy} ${hours}:${minutes} ${ampm}`;
    };

    const dateRangeText = `${formatHeaderDate(start)} - ${formatHeaderDate(end)}`;

    let csvContent = '';
    csvContent += `${centerText('GBI Air Quality Monitor - Report (TESTING)')}\n`;
    csvContent += `${','.repeat(totalCols - 1)}\n`;
    csvContent += `${centerText(dateRangeText)}\n`;
    csvContent += `${','.repeat(totalCols - 1)}\n`;

    const deviceId = dto.deviceId;
    csvContent += `${centerText(`Device - ${deviceId}`)}\n`;
    csvContent += `${','.repeat(totalCols - 1)}\n`;
    const headerRow = columns.map((col) => CSV_COLUMN_LABELS[col] ?? col);
    csvContent += `${headerRow.join(',')}\n`;

    if (rows.length === 0) {
      csvContent += `${','.repeat(totalCols - 1)}\n`;
    } else {
      for (const row of rows) {
        const rowData = columns.map((col) => {
          const val = row[col];
          return val === null || val === undefined ? '' : String(val);
        });
        csvContent += `${rowData.join(',')}\n`;
      }
    }

    return '\ufeff' + csvContent;
  }

  async generatePdf(dto: GenerateReportDto): Promise<Buffer> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date((dto.start || '').trim());
    const end = new Date((dto.end || '').trim());

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end timestamp format');
    }

    const rawRows: any[] = await this.queryBucketedTelemetry(
      dto.deviceId,
      dto.parameters,
      start,
      end,
      interval,
    );

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

        processedRow.Date = `${dd}-${mm}-${yyyy}`;
        processedRow.Time = `${hours}:${minutes}`;
      }

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

    const rowsByDevice: Record<string, any[]> = {
      [dto.deviceId]: rows,
    };

    const deviceNames: Record<string, string> = {
      [dto.deviceId]: `Test Device ${dto.deviceId}`,
    };

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
    deviceId: string,
    params: string[],
    start: Date,
    end: Date,
    interval: number,
  ) {
    if (!deviceId || !params.length) return [];

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
          to_timestamp(floor(extract(epoch from "timestamp") / (${interval} * 60)) * (${interval} * 60)) AT TIME ZONE 'UTC' as "timestamp_bucket",
          "deviceId",
          "timestamp" as "original_timestamp",
          ${selectCols}
        FROM "DummyDeviceTelemetry"
        WHERE "deviceId" = ${deviceId}
        AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp
        ORDER BY
          "timestamp_bucket" ASC,
          "deviceId" ASC,
          "timestamp" ASC
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
          ) as "timestamp",

          "deviceId",

          ${selectAgg}

        FROM "DummyDeviceTelemetry"

        WHERE "deviceId" = ${deviceId}
        AND "timestamp" BETWEEN ${start.toISOString()}::timestamp AND ${end.toISOString()}::timestamp

        GROUP BY 1, "deviceId"

        ORDER BY 1 ASC, "deviceId" ASC
      `,
      );
    }

    return rows.map((row) => ({
      ...row,
      timestamp: row.timestamp_bucket || row.timestamp,
    }));
  }
}
