import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtAuthGuard } from '../auth/guards';
import { PremiumGuard } from '../subscription/subscription.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard, PremiumGuard)
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

  @UseGuards(JwtAuthGuard, PremiumGuard)
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
