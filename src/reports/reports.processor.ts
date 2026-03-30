import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportJobData } from './dto/report-job.dto';
import * as fs from 'fs';
import * as path from 'path';

@Processor('reports', {
  concurrency: 2, // PDF rendering is CPU heavy, keep concurrency low to prevent starvation

  // --- Upstash Redis request-limit protection ---
  // By default BullMQ polls every ~5ms when the queue may have jobs.
  // With Upstash's 500k request/day limit that burns the allowance in hours.
  // drainDelay: wait 10 s before re-polling after the queue is found empty.
  drainDelay: 10000,

  // Check for stalled jobs every 60 s instead of the 30 s default.
  // Each check is a Redis round-trip; halving it halves that cost.
  stalledInterval: 60000,

  // Hold the job lock for 30 s (default 30 s). Explicit here so future
  // changes don't accidentally shorten it and cause extra renewal calls.
  lockDuration: 30000,
})
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);
  private readonly reportsDir = path.join(process.cwd(), 'generated-reports');

  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {
    super();
    // Ensure the output directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async process(job: Job<ReportJobData, any, string>): Promise<any> {
    this.logger.log(
      `[Job ${job.id}] Starting generation for ${job.name} report...`,
    );

    try {
      let fileBuffer: Buffer | string;
      const fileExt = job.name === 'csv' ? 'csv' : 'pdf';
      const fileKey = `reports/${job.id}.${fileExt}`;
      const absolutePath = path.join(this.reportsDir, `${job.id}.${fileExt}`);

      // 1. Generate the report payload
      if (job.name === 'csv') {
        if (job.data.type !== 'csv') throw new Error('Job data mismatch');
        fileBuffer = await this.reportsService.generateCsv(
          job.data.userId,
          job.data.dto,
        );
      } else if (job.name === 'pdf') {
        if (job.data.type !== 'pdf') throw new Error('Job data mismatch');
        fileBuffer = await this.reportsService.generatePdf(
          job.data.userId,
          job.data.dto,
        );
      } else {
        throw new Error(`Unknown job name: ${job.name}`);
      }

      // 2. Write to local disk (Phase 1 storage)
      // Note: In Phase 2, this would be `s3.upload({ Key: fileKey, Body: fileBuffer })`
      await fs.promises.writeFile(absolutePath, fileBuffer);
      this.logger.log(
        `[Job ${job.id}] Saved report to local disk at ${absolutePath}`,
      );

      // 3. Update the Prisma record with the logical fileKey
      await this.prisma.generatedReport.update({
        where: { id: job.id },
        data: { fileKey },
      });

      this.logger.log(
        `[Job ${job.id}] Successfully completed ${job.name} report.`,
      );
      return { fileKey };
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] Failed to generate report: ${error.message}`,
        error.stack,
      );
      throw error; // Let BullMQ handle retries natively
    }
  }
}
