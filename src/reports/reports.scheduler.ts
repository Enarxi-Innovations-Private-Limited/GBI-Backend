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
      // 1. Find all expired reports
      const expiredReports = await this.prisma.generatedReport.findMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (expiredReports.length === 0) {
        this.logger.log('✨ No expired reports found.');
        return;
      }

      this.logger.log(
        `Found ${expiredReports.length} expired reports to delete.`,
      );

      // 2. Delete files from disk and records from DB
      let deletedCount = 0;

      for (const report of expiredReports) {
        if (report.fileKey) {
          const absolutePath = path.join(
            this.reportsDir,
            path.basename(report.fileKey),
          );

          try {
            if (fs.existsSync(absolutePath)) {
              await fs.promises.unlink(absolutePath);
            }

            // 3. Delete from DB only if file is confirmed gone (or was never there)
            await this.prisma.generatedReport.delete({
              where: { id: report.id },
            });
            deletedCount++;
          } catch (fileErr) {
            this.logger.error(
              `Failed to cleanup report ${report.id}: ${fileErr.message}`,
            );
          }
        } else {
          // If no fileKey, just clear the record
          await this.prisma.generatedReport.delete({
            where: { id: report.id },
          });
          deletedCount++;
        }
      }

      this.logger.log(
        `✅ Successfully cleaned up ${deletedCount} expired reports.`,
      );
    } catch (error) {
      this.logger.error('❌ Error during report cleanup:', error.stack);
    }
  }
}
