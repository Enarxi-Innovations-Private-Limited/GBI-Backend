import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DeviceStatusLoggerService implements OnModuleInit {
  private logDir: string;
  private sessionTimestamp: string;

  onModuleInit() {
    this.logDir = path.join(process.cwd(), 'logs', 'device_status');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const now = new Date();
    const istDate = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const hh = String(istDate.getHours()).padStart(2, '0');
    const min = String(istDate.getMinutes()).padStart(2, '0');
    const ss = String(istDate.getSeconds()).padStart(2, '0');

    this.sessionTimestamp = `${yyyy}-${mm}-${dd}T${hh}-${min}-${ss}`;
  }

  logStatus(deviceLabel: string, deviceId: string, message: string) {
    const sanitizedLabel = deviceLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `${sanitizedLabel}_${this.sessionTimestamp}.log`;
    const filePath = path.join(this.logDir, filename);

    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });

    const logLine = `[${timestamp}] [ID: ${deviceId}] ${message}\n`;
    fs.appendFileSync(filePath, logLine, 'utf8');
  }
}
