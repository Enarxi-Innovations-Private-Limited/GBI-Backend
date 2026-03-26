import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { AuthGuard } from '@nestjs/passport';
import { PremiumGuard } from 'src/auth/guards/premium.guard';
import { RequiresPremium } from 'src/auth/decorators/premium.decorator';
import { createReadStream, existsSync } from 'fs';
import * as path from 'path';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), PremiumGuard)
@RequiresPremium()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('csv')
  async enqueueCsv(@Req() req: any, @Query() dto: GenerateReportDto) {
    const userId = req.user.id;
    return this.reportsService.enqueueReport(userId, 'csv', dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('pdf')
  async enqueuePdf(@Req() req: any, @Query() dto: GenerateReportDto) {
    const userId = req.user.id;
    return this.reportsService.enqueueReport(userId, 'pdf', dto);
  }

  @SkipThrottle()
  @Get('status/:jobId')
  async getStatus(@Req() req: any, @Param('jobId') jobId: string) {
    const userId = req.user.id;
    return this.reportsService.getReportStatus(userId, jobId);
  }

  @Get('download/:jobId')
  async downloadReport(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const userId = req.user.id;

    // 1. Verify status and grab fileKey
    const { status, fileKey, error } =
      await this.reportsService.getReportStatus(userId, jobId);

    if (status !== 'completed' || !fileKey) {
      throw new BadRequestException(
        error || 'Report is not ready for download yet.',
      );
    }

    // 2. Resolve logical fileKey to absolute path (Phase 1 storage)
    const absolutePath = path.join(
      process.cwd(),
      'generated-reports',
      path.basename(fileKey),
    );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException(
        'Report file not found on server or expired.',
      );
    }

    // 3. Set headers and stream
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const extension = fileKey.endsWith('.pdf') ? '.pdf' : '.csv';
    const filename = `GBI-Air-Quality-Monitor-Report-${dateStr}${extension}`;
    const contentType = fileKey.endsWith('.pdf')
      ? 'application/pdf'
      : 'text/csv';

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);

    const file = createReadStream(absolutePath);
    return reply.send(file);
  }

  @Get()
  async listUserReports(@Req() req: any) {
    return this.reportsService.getUserReports(req.user.id);
  }
}
