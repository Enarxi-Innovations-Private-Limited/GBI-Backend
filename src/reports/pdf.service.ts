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
        }); // Disable native autonomous bottom wrapping
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const margin = 50;
        const pageBreakThreshold = doc.page.height - margin;
        const footerY = doc.page.height - 30;
        const usableWidth = 495; // doc.page.width - 100

        const timestamp = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        });

        let pageNumber = 1;
        const renderFooter = () => {
          doc.fontSize(8).fillColor('#999999').font('Helvetica');
          // Drawn explicitly via absolute coordinates with bounded usableWidth to enforce overlap prevention
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

        let currentY = margin;

        const drawDocHeader = () => {
          const headerTop = 40;
          const logoPath = join(
            process.cwd(),
            'src',
            'reports',
            'assets',
            'logo.png',
          );
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, margin, headerTop, { width: 60 });
          }

          // Exact right alignment bounded perfectly to the edge using shared Y limit
          // The title block is 35px high. Logo is 60px high. Vertical padding is (60 - 35)/2 = 12.5.
          // Centering the text cluster perfectly inside the logo's y bounds.
          const titleY = headerTop + 12;

          doc
            .font('Helvetica-Bold')
            .fontSize(20)
            .fillColor('black')
            .text('GBI Air Quality Monitor - Report', margin, titleY, {
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

          // Vertically spaced tightly below the title
          doc.text(`${startStr} - ${endStr}`, margin, titleY + 25, {
            width: usableWidth,
            align: 'right',
            lineBreak: false,
          });

          // currentY begins below the header block seamlessly
          currentY = 110;
        };

        const drawTableHeader = (columns: string[], y: number): number => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('black');
          let currentX = margin;
          const headerHeight = 18; // strictly fixed, never dynamic

          for (const col of columns) {
            const width = COLUMN_WIDTHS[col] || 45;

            // Draw consistent structured cell border
            doc
              .rect(currentX, y, width, headerHeight)
              .strokeColor('#dddddd')
              .lineWidth(0.5)
              .stroke();

            // Render single-line text safely padded
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

        // Execution strictly begins here
        drawDocHeader();

        const columns = data.columns;

        // Iterating over the requested logical order
        for (const deviceId of data.deviceIds) {
          // Check for page break before starting a new device header
          if (currentY + 25 + 18 > pageBreakThreshold) {
            renderFooter();
            doc.addPage();
            pageNumber++;
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

          // Render strictly sized Headers
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
              // 1. Calculate dynamic row height securely isolating 'deviceId'
              let rowHeight = 18;
              const deviceIdVal = row['deviceId'];
              if (deviceIdVal) {
                // Explicitly match the rendering bound box
                const textWidth = COLUMN_WIDTHS['deviceId'] - 6;
                const computedHeight = doc.heightOfString(String(deviceIdVal), {
                  width: textWidth,
                });
                if (computedHeight + 10 > rowHeight) {
                  rowHeight = computedHeight + 10;
                }
              }

              // 2. Exact explicit mathematical page break taking the new dynamic height into account
              if (currentY + rowHeight > pageBreakThreshold) {
                renderFooter();
                doc.addPage();
                pageNumber++;
                currentY = margin;
                currentY = drawTableHeader(columns, currentY);
              }

              doc.font('Helvetica').fontSize(9).fillColor('black');
              let currentX = margin;

              for (const col of columns) {
                const width = COLUMN_WIDTHS[col] || 45;
                let val = row[col];
                if (val === null || val === undefined) val = '-';

                // Physical grid border locking every element structurally
                doc
                  .rect(currentX, currentY, width, rowHeight)
                  .strokeColor('#dddddd')
                  .lineWidth(0.5)
                  .stroke();

                const isDeviceId = col === 'deviceId';
                doc.text(String(val), currentX + 3, currentY + 5, {
                  width: width - 6,
                  align: 'left',
                  lineBreak: isDeviceId, // Explicit exception exclusively for device ID strings
                  ellipsis: !isDeviceId, // All other cells enforce line strictness safely
                });

                currentX += width;
              }

              currentY += rowHeight;
            }
          }
          currentY += 15; // Structured gap between different devices
        }

        // Final footer manually drawn purely based on absolute math before doc closes
        renderFooter();

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
