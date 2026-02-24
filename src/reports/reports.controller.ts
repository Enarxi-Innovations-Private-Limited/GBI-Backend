import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('csv')
  async downloadCsv(
    @Req() req: any,
    @Query() dto: GenerateReportDto,
    @Res() reply: FastifyReply,
  ) {
    const userId = req.user.id;

    const csv = await this.reportsService.generateCsv(userId, dto);

    reply
      .header('Content-Type', 'text/csv')
      .header(
        'Content-Disposition',
        `attachment; filename="GBI-Air-Quality-Monitor-report.csv"`,
      )
      .send(csv);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('pdf')
  async downloadPdf(
    @Req() req: any,
    @Query() dto: GenerateReportDto,
    @Res() reply: FastifyReply,
  ) {
    const userId = req.user.id;
    const pdfBuffer = await this.reportsService.generatePdf(userId, dto);

    reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `attachment; filename="GBI-Air-Quality-Monitor-report.pdf"`,
      )
      .send(pdfBuffer);
  }
}
