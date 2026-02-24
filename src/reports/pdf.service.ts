import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as fs from 'fs';
import { join } from 'path';

export interface PdfReportData {
  deviceIds: string[];
  start: Date;
  end: Date;
  columns: string[];
  rowsByDevice: Record<string, any[]>;
}

const COLUMN_WIDTHS: Record<string, number> = {
  Date: 55,
  Time: 45,
  deviceId: 80,
  pm25: 35,
  temperature: 65,
  humidity: 50,
  pm10: 35,
  co2: 45,
  noise: 45,
  aqi: 40,
};

@Injectable()
export class PdfService {
  async generateReport(data: PdfReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 50, left: 50, right: 50, bottom: 0 },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const margin = 50;
        const usableWidth = doc.page.width - margin * 2;
        const pageBreakThreshold = doc.page.height - margin;
        const footerY = doc.page.height - 30;

        const timestamp = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        });

        let pageNumber = 1;
        let currentY = margin;

        const logoPath = join(
          process.cwd(),
          'src',
          'reports',
          'assets',
          'logo.png',
        );

        // ================= WATERMARK =================
        const drawWatermark = () => {
          if (!fs.existsSync(logoPath)) return;

          const watermarkWidth = 320; // large watermark
          const centerX = (doc.page.width - watermarkWidth) / 2;
          const centerY = (doc.page.height - watermarkWidth) / 2;

          doc.save();
          doc.opacity(0.12); // professional faint watermark
          doc.image(logoPath, centerX, centerY, {
            width: watermarkWidth,
          });
          doc.restore();
        };

        const renderFooter = () => {
          doc.fontSize(8).fillColor('#999999').font('Helvetica');

          doc.text(`Generated on: ${timestamp}`, margin, footerY, {
            width: usableWidth,
            align: 'left',
            lineBreak: false,
          });

          doc.text(`Page ${pageNumber}`, margin, footerY, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });
        };

        // ================= HEADER (NO SMALL LOGO NOW) =================
        const drawDocHeader = () => {
          const headerTop = 40;

          const title = 'GBI Air Quality Monitor - Report';

          doc.font('Helvetica-Bold').fontSize(20).fillColor('black');

          doc.text(title, margin, headerTop, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });

          doc.font('Helvetica').fontSize(10).fillColor('gray');

          const startStr = data.start.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          });

          const endStr = data.end.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
          });

          doc.text(`${startStr} - ${endStr}`, margin, headerTop + 28, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });

          currentY = headerTop + 70;
        };

        const drawTableHeader = (columns: string[], y: number): number => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('black');

          let currentX = margin;
          const headerHeight = 18;

          for (const col of columns) {
            const width = COLUMN_WIDTHS[col] || 45;

            doc
              .rect(currentX, y, width, headerHeight)
              .strokeColor('#dddddd')
              .lineWidth(0.5)
              .stroke();

            doc.text(col, currentX + 3, y + 5, {
              width: width - 6,
              align: 'left',
              lineBreak: false,
              ellipsis: true,
            });

            currentX += width;
          }

          return y + headerHeight;
        };

        // ================= START RENDERING =================

        drawWatermark(); // First page watermark
        drawDocHeader();

        const columns = data.columns;

        for (const deviceId of data.deviceIds) {
          if (currentY + 25 + 18 > pageBreakThreshold) {
            renderFooter();
            doc.addPage();
            pageNumber++;
            drawWatermark(); // Watermark on new page
            currentY = margin;
          }

          doc
            .fontSize(12)
            .fillColor('black')
            .font('Helvetica-Bold')
            .text(`Device: ${deviceId}`, margin, currentY, {
              lineBreak: false,
            });

          currentY += 25;

          currentY = drawTableHeader(columns, currentY);

          const rows = data.rowsByDevice[deviceId] || [];

          if (rows.length === 0) {
            doc
              .font('Helvetica')
              .fontSize(9)
              .fillColor('#777777')
              .text(
                'No data available in this time range.',
                margin,
                currentY + 5,
                { lineBreak: false },
              );

            currentY += 30;
          } else {
            for (const row of rows) {
              let rowHeight = 18;

              const deviceIdVal = row['deviceId'];
              if (deviceIdVal) {
                doc.font('Helvetica').fontSize(9);

                const textWidth = COLUMN_WIDTHS['deviceId'] - 6;

                const computedHeight = doc.heightOfString(
                  String(deviceIdVal),
                  { width: textWidth },
                );

                if (computedHeight + 10 > rowHeight) {
                  rowHeight = computedHeight + 10;
                }
              }

              if (currentY + rowHeight > pageBreakThreshold) {
                renderFooter();
                doc.addPage();
                pageNumber++;
                drawWatermark(); // Watermark again
                currentY = margin;

                doc
                  .fontSize(12)
                  .fillColor('black')
                  .font('Helvetica-Bold')
                  .text(`Device: ${deviceId}`, margin, currentY, {
                    lineBreak: false,
                  });

                currentY += 25;
                currentY = drawTableHeader(columns, currentY);
              }

              doc.font('Helvetica').fontSize(9).fillColor('black');

              let currentX = margin;

              for (const col of columns) {
                const width = COLUMN_WIDTHS[col] || 45;

                let val = row[col];
                if (val === null || val === undefined) val = '-';

                doc
                  .rect(currentX, currentY, width, rowHeight)
                  .strokeColor('#dddddd')
                  .lineWidth(0.5)
                  .stroke();

                const isDeviceId = col === 'deviceId';

                doc.text(String(val), currentX + 3, currentY + 5, {
                  width: width - 6,
                  align: 'left',
                  lineBreak: isDeviceId,
                  ellipsis: !isDeviceId,
                });

                currentX += width;
              }

              currentY += rowHeight;
            }
          }

          currentY += 15;
        }

        renderFooter();
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}