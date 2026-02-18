import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { Parser } from 'json2csv';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateCsv(userId: string, dto: GenerateReportDto): Promise<string> {
    const interval = Number(dto.intervalMinutes ?? 5);
    const start = new Date(dto.start);
    const end = new Date(dto.end);

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
    const rows: any[] = await this.queryBucketedTelemetry(
      devices,
      dto.parameters,
      start,
      end,
      interval,
    );

    // 3) Convert to CSV
    const fields = ['timestamp', 'deviceId', ...dto.parameters];
    const parser = new Parser({ fields });

    return parser.parse(rows);
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
      AND "timestamp" BETWEEN ${start} AND ${end}

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
