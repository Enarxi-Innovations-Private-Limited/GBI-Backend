import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsScheduler implements OnModuleInit {
  private readonly logger = new Logger(ReportsScheduler.name);
  private readonly reportsDir = path.join(process.cwd(), 'generated-reports');

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('🚀 Initializing reports cleanup sweep...');
    await this.cleanupExpiredReports();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredReports() {
    this.logger.log('🧹 Running cleanup for expired reports...');

    try {
      // 1. Find all expired reports in one query
      const expiredReports = await this.prisma.generatedReport.findMany({
        where: { expiresAt: { lt: new Date() } },
        select: { id: true, fileKey: true },
      });

      if (expiredReports.length === 0) {
        this.logger.log('✨ No expired reports found.');
        return;
      }

      this.logger.log(`Found ${expiredReports.length} expired reports to delete.`);

      // 2. Delete all files in PARALLEL (Promise.allSettled = never throws on individual failure)
      const fileCleanupResults = await Promise.allSettled(
        expiredReports
          .filter((r) => r.fileKey)
          .map((r) => {
            const absolutePath = path.join(
              this.reportsDir,
              path.basename(r.fileKey!),
            );
            return fs.promises.unlink(absolutePath);
          }),
      );

      // Log individual file errors without aborting the DB cleanup
      fileCleanupResults.forEach((result, i) => {
        if (result.status === 'rejected' && !result.reason?.code?.includes('ENOENT')) {
          this.logger.warn(`File cleanup warning: ${result.reason?.message}`);
        }
      });

      // 3. Delete ALL expired records in ONE batch query (was: N separate DELETEs in a loop)
      const ids = expiredReports.map((r) => r.id);
      const { count } = await this.prisma.generatedReport.deleteMany({
        where: { id: { in: ids } },
      });

      this.logger.log(`✅ Successfully cleaned up ${count} expired reports.`);
    } catch (error) {
      this.logger.error('❌ Error during report cleanup:', error.stack);
    }
  }
}
