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
  deviceNames: Record<string, string>; // deviceId → user-defined name
}

const COLUMN_WIDTHS: Record<string, number> = {
  Date: 55,
  Time: 45,
  pm25: 38,
  temperature: 68,
  humidity: 52,
  pm10: 38,
  co2: 40,
  noise: 40,
  aqi: 38,
  tvoc: 38,
};

// Display labels for column headers — name + unit on second line
const COLUMN_LABELS: Record<string, string> = {
  Date: 'Date',
  Time: 'Time',
  aqi: 'AQI',
  pm25: 'PM2.5\n(\u00b5g/m\u00b3)',
  pm10: 'PM10\n(\u00b5g/m\u00b3)',
  tvoc: 'TVOC\n(ppb)',
  co2: 'CO2\n(ppm)',
  temperature: 'Temperature\n(\u00b0C)',
  humidity: 'Humidity\n(%)',
  noise: 'Noise\n(dB)',
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

        // Footer timestamp — HH:MM (no seconds)
        const now = new Date();
        const _ist = new Date(
          now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
        );
        const _footerHH = String(_ist.getHours()).padStart(2, '0');
        const _footerMM = String(_ist.getMinutes()).padStart(2, '0');
        const _footerDD = String(_ist.getDate()).padStart(2, '0');
        const _footerMo = String(_ist.getMonth() + 1).padStart(2, '0');
        const _footerYYYY = _ist.getFullYear();
        const timestamp = `${_footerDD}/${_footerMo}/${_footerYYYY}, ${_footerHH}:${_footerMM}`;

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

        // ================= HEADER =================

        // Format a Date to "DD/MM/YYYY, H:MM am/pm" (no seconds) in IST
        const formatDateHHMM = (d: Date): string => {
          const ist = new Date(
            d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
          );
          const dd2 = String(ist.getDate()).padStart(2, '0');
          const mo2 = String(ist.getMonth() + 1).padStart(2, '0');
          const yy2 = ist.getFullYear();
          let h = ist.getHours();
          const ampm = h >= 12 ? 'pm' : 'am';
          h = h % 12 || 12;
          const hStr = String(h);
          const mStr = String(ist.getMinutes()).padStart(2, '0');
          return `${dd2}/${mo2}/${yy2}, ${hStr}:${mStr} ${ampm}`;
        };

        const drawDocHeader = (isFirstPage: boolean) => {
          const headerTop = 40;
          const title = 'GBI Air Quality Monitor - Report';

          // Show logo on first page only — top-left, vertically centred with the title+date block
          if (isFirstPage && fs.existsSync(logoPath)) {
            const logoSize = 50;
            const logoY = headerTop - 10;
            doc.image(logoPath, margin, logoY, {
              width: logoSize,
              height: logoSize,
            });
          }

          doc.font('Helvetica-Bold').fontSize(20).fillColor('black');
          doc.text(title, margin, headerTop, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });

          // Date range — black, no seconds
          doc.font('Helvetica').fontSize(10).fillColor('black');
          const startStr = formatDateHHMM(data.start);
          const endStr = formatDateHHMM(data.end);
          doc.text(`${startStr} - ${endStr}`, margin, headerTop + 28, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });

          currentY = headerTop + 70;
        };

        const drawTableHeader = (
          columns: string[],
          y: number,
          startX: number,
        ): number => {
          doc.font('Helvetica-Bold').fontSize(8).fillColor('black');

          let currentX = startX;
          const headerHeight = 34;

          for (const col of columns) {
            const width = COLUMN_WIDTHS[col] || 45;

            doc
              .rect(currentX, y, width, headerHeight)
              .strokeColor('#dddddd')
              .lineWidth(0.5)
              .stroke();

            const label =
              COLUMN_LABELS[col] ?? col.charAt(0).toUpperCase() + col.slice(1);

            doc.text(label, currentX + 3, y + 6, {
              width: width - 6,
              align: 'center',
              lineBreak: true,
              ellipsis: false,
            });

            currentX += width;
          }

          return y + headerHeight;
        };

        // ================= START RENDERING =================

        drawWatermark(); // First page watermark
        drawDocHeader(true); // Logo only on first page

        const columns = data.columns;

        // Compute total table width and center it on the page
        const totalTableWidth = columns.reduce(
          (sum, col) => sum + (COLUMN_WIDTHS[col] || 45),
          0,
        );
        const tableStartX = (doc.page.width - totalTableWidth) / 2;

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

          currentY += 16;

          const deviceName = data.deviceNames?.[deviceId];
          if (deviceName) {
            doc
              .fontSize(9)
              .fillColor('#444444')
              .font('Helvetica')
              .text(`Device Name: ${deviceName}`, margin, currentY, {
                lineBreak: false,
              });
            currentY += 14;
          } else {
            currentY += 9;
          }

          currentY = drawTableHeader(columns, currentY, tableStartX);

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
              const rowHeight = 18;

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

                currentY += 16;

                const deviceNameCont = data.deviceNames?.[deviceId];
                if (deviceNameCont) {
                  doc
                    .fontSize(9)
                    .fillColor('#444444')
                    .font('Helvetica')
                    .text(`Device Name: ${deviceNameCont}`, margin, currentY, {
                      lineBreak: false,
                    });
                  currentY += 14;
                } else {
                  currentY += 9;
                }
                currentY = drawTableHeader(columns, currentY, tableStartX);
              }

              doc.font('Helvetica').fontSize(9).fillColor('black');

              let currentX = tableStartX;

              for (const col of columns) {
                const width = COLUMN_WIDTHS[col] || 45;

                let val = row[col];
                if (val === null || val === undefined) val = '-';

                doc
                  .rect(currentX, currentY, width, rowHeight)
                  .strokeColor('#dddddd')
                  .lineWidth(0.5)
                  .stroke();

                // Only Date stays left-aligned; Time and parameter columns are centre-aligned
                const isDate = col === 'Date';

                doc.text(String(val), currentX + 3, currentY + 5, {
                  width: width - 6,
                  align: isDate ? 'left' : 'center',
                  lineBreak: false,
                  ellipsis: true,
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
