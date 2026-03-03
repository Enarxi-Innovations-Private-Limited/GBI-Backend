import { Controller, Get, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { GenerateReportDto } from 'src/reports/dto/generate-report.dto';
import { TestReportsService } from './test-reports.service';

@Controller('test-reports')
export class TestReportsController {
  constructor(private readonly reportsService: TestReportsService) {}

  @Get('csv')
  async downloadCsv(
    @Query() dto: GenerateReportDto,
    @Res() reply: FastifyReply,
  ) {
    const csv = await this.reportsService.generateCsv(dto);

    reply
      .header('Content-Type', 'text/csv')
      .header(
        'Content-Disposition',
        `attachment; filename="GBI-Air-Quality-Monitor-test-report.csv"`,
      )
      .send(csv);
  }

  @Get('pdf')
  async downloadPdf(
    @Query() dto: GenerateReportDto,
    @Res() reply: FastifyReply,
  ) {
    const pdfBuffer = await this.reportsService.generatePdf(dto);

    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="GBI-Air-Quality-Monitor-test-report.pdf"`,
      )
      .send(pdfBuffer);
  }
}
