import { GenerateReportDto } from './generate-report.dto';

/**
 * BullMQ Job Data for the 'reports' queue.
 * Job type is the job name (used in switch inside the processor).
 */
export type ReportJobData =
  | { type: 'csv'; userId: string; dto: GenerateReportDto }
  | { type: 'pdf'; userId: string; dto: GenerateReportDto };
