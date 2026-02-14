import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { validate } from 'class-validator';
import { AlertsService } from 'src/alerts/alerts.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service responsible for consuming MQTT messages from the broker.
 * Handles telemetry data and device heartbeat updates.
 */
@Injectable()
export class MqttConsumer implements OnModuleInit, OnModuleDestroy {
  private logFilePath: string;

  constructor(
    private readonly mqttService: MqttService,
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly realtimeService: RealtimeService,
  ) {}

  onModuleInit() {
    this.initializeLogger();
    const client = this.mqttService.getClient();

    client.on('message', async (topic, payload) => {
      try {
        const deviceId = this.extractDeviceId(topic);
        const payloadString = payload.toString();
        
        // Log raw message reception
        this.logToFile({
          type: 'INFO',
          message: 'Received MQTT message',
          topic,
          deviceId,
          payload: payloadString
        });

        // Try to parse JSON first
        let data;
        try {
          data = JSON.parse(payloadString);
        } catch (parseError) {
          const errorLog = {
            type: 'ERROR',
            message: 'Invalid JSON',
            topic: topic,
            deviceId: deviceId,
            payload: payloadString,
            error: parseError.message
          };
          
          this.logError(errorLog);
          
          // Log to console
          console.error('❌ Invalid JSON received on topic:', topic);
          console.error('   Device ID:', deviceId);
          console.error('   Full Payload:', payloadString);
          console.error('   Parse Error:', parseError.message);
          
          return; // Skip this message
        }

        if (topic.includes('telemetry')) {
          await this.handleTelemetry(deviceId, data);
        }

        if (topic.includes('heartbeat')) {
          await this.handleHeartbeat(deviceId);
        }
      } catch (error) {
        console.error('MQTT message error:', error.message);
        
        // Log general errors to file
        this.logError({
          type: 'ERROR',
          message: 'Unhandled MQTT message error',
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  onModuleDestroy() {
    console.log(`🛑 [PID: ${process.pid}] MQTT Consumer shutting down...`);
    const client = this.mqttService.getClient();
    if (client) {
      client.end(true, () => {
        console.log(`🛑 [PID: ${process.pid}] MQTT Client disconnected.`);
      });
    }
  }

  private getISTTimestamp(): string {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private getISTFilenameTimestamp(): string {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Manual formatting to ensure yyyy-mm-dd-hh-mm-ss format
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    const hh = String(istDate.getHours()).padStart(2, '0');
    const min = String(istDate.getMinutes()).padStart(2, '0');
    const ss = String(istDate.getSeconds()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}T${hh}-${min}-${ss}`;
  }

  private getDailyErrorLogPath(): string {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const yyyy = istDate.getFullYear();
    const mm = String(istDate.getMonth() + 1).padStart(2, '0');
    const dd = String(istDate.getDate()).padStart(2, '0');
    
    const logDir = path.join(process.cwd(), 'logs', 'mqtt-errors');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    return path.join(logDir, `error-${yyyy}-${mm}-${dd}.log`);
  }

  private initializeLogger() {
    try {
      const logDir = path.join(process.cwd(), 'logs', 'mqtt-consumption');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = this.getISTFilenameTimestamp();
      const filename = `session-${timestamp}.log`;
      this.logFilePath = path.join(logDir, filename);

      this.logToFile({
        type: 'INFO',
        message: 'MQTT Consumer Session Started',
        timestamp: this.getISTTimestamp() // Log header in IST
      });
      console.log(`📝 MQTT logging initialized: ${this.logFilePath}`);
      
      // Also ensure error log directory exists
      this.getDailyErrorLogPath();
      
    } catch (error) {
      console.error('Failed to initialize MQTT logger:', error);
    }
  }

  private logToFile(data: any) {
    if (!this.logFilePath) return;

    try {
      const logEntry = {
        timestamp: this.getISTTimestamp(),
        ...data
      };
      
      fs.appendFileSync(
        this.logFilePath,
        JSON.stringify(logEntry) + '\n',
        'utf8'
      );
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private logError(data: any) {
    try {
      const errorLogPath = this.getDailyErrorLogPath();
      const logEntry = {
        timestamp: this.getISTTimestamp(),
        ...data
      };
      
      fs.appendFileSync(
        errorLogPath,
        JSON.stringify(logEntry) + '\n',
        'utf8'
      );
      
      // Also write to session log for continuity
      this.logToFile(data);
      
    } catch (error) {
      console.error('Failed to write to error log file:', error);
    }
  }

  private extractDeviceId(topic: string): string {
    return topic.split('/')[2];
  }

  private async handleTelemetry(deviceId: string, payload: any) {
    console.log('📥 Received telemetry for deviceId:', deviceId);
    console.log('📦 Payload:', JSON.stringify(payload));

    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device || device.isDeleted) {
      const msg = !device ? 'Device not found' : 'Device is deleted';
      if (!device) console.error('❌ ' + msg, deviceId);
      
      this.logError({
        type: 'WARN',
        message: msg,
        deviceId
      });
      return;
    }

    console.log('✅ Device found:', device.id, '- Status:', device.status);

    // Validate payload
    const dto = plainToInstance(TelemetryPayloadDto, payload);
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMsg = 'telemetry_validation_failed';
      console.warn('❌ ' + errorMsg, JSON.stringify(errors, null, 2));

      // Retrieve strict validation invalid fields
      const invalidFields = errors.map(err => {
        // Handle mapped property name for AQI (which comes as 'AQI' in payload but is 'aqi' in DTO)
        const receivedValue = payload[err.property];

        // Determine the error code based on the constraints
        let code = 'UNKNOWN';
        let message = 'Validation failed';
        
        if (err.constraints) {
            if (err.constraints.isNumber || (err.constraints.isNumber && err.value === undefined)) {
                // Check if value was missing/undefined or if it was truly an invalid number
                if (receivedValue === undefined || receivedValue === null || receivedValue === '') {
                   code = 'REQUIRED';
                   message = 'Field is required';
                } else {
                   code = 'NOT_A_NUMBER';
                   message = 'Must be a number';
                }
            } else if (err.constraints.min) {
                code = 'BELOW_MIN';
                message = 'Must be ≥ 0';
                if (err.property === 'temperature') message = 'Must be ≥ -50';
            } else if (err.constraints.max) {
                 code = 'ABOVE_MAX';
                 message = 'Must be ≤ ' + (
                    err.property === 'pm25' || err.property === 'pm10' ? '2000' :
                    err.property === 'tvoc' ? '60000' :
                    err.property === 'co2' ? '20000' :
                    err.property === 'temperature' ? '100' :
                    err.property === 'humidity' ? '100' :
                    err.property === 'noise' ? '200' :
                    err.property === 'aqi' ? '500' : 'limit'
                 );
            }
        }
        
        return {
          field: err.property,
          received: receivedValue,
          code: code,
          message: message,
          // debug: err.constraints // Optional: keep for debugging if needed
        };
      });
      
      this.logError({
        level: 'WARN',
        event: 'telemetry_partial_validation_failed', // Updated event name
        deviceId,
        message: 'Saving valid fields, invalid fields set to null',
        invalidFields,
        rawErrors: errors
      });
      // Do NOT return here, proceed to save valid data
    } else {
      console.log('✅ Validation passed. Saving to database...');
    }

    // Helper to sanitize numeric values (NaN or undefined becomes null)
    const sanitize = (val: number | undefined) => (typeof val === 'number' && !isNaN(val)) ? val : null;

    try {
      // Save telemetry data (even if device is inactive)
      const saved = await this.prisma.deviceTelemetry.create({
        data: {
          deviceId: device.id,
          pm25: sanitize(dto.pm25),
          pm10: sanitize(dto.pm10),
          tvoc: sanitize(dto.tvoc),
          co2: sanitize(dto.co2),
          temperature: sanitize(dto.temperature),
          humidity: sanitize(dto.humidity),
          noise: sanitize(dto.noise),
          aqi: sanitize(dto.aqi), // Added AQI field
        },
      });

      this.logToFile({
        type: 'SUCCESS',
        message: 'Telemetry saved to database',
        deviceId,
        telemetryId: saved.id.toString()
      });

      // Update heartbeat timestamp
      await this.prisma.device.update({
        where: { id: device.id },
        data: { 
          lastHeartbeatAt: new Date(),
          // If device was offline, mark it active again
          ...(device.status === 'inactive' && { status: 'active' }),
        },
      });

      if (device.status === 'inactive') {
        console.log('✅ Device was OFFLINE - marked as ACTIVE and data saved!');
      } else {
        console.log('✅ Telemetry data saved successfully!');
      }

      // Emit real-time update
      this.realtimeService.emitTelemetry(device.deviceId, {
        timestamp: saved.timestamp,
        pm25: saved.pm25,
        pm10: saved.pm10,
        tvoc: saved.tvoc,
        co2: saved.co2,
        temperature: saved.temperature,
        humidity: saved.humidity,
        noise: saved.noise,
        aqi: saved.aqi, // Include AQI in realtime update
      });
      await this.alertsService.evaluate(device.id, dto);
      
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      this.logError({
        type: 'ERROR',
        message: 'Database save failed',
        deviceId,
        error: dbError.message,
        payload: dto
      });
    }
  }

  private async handleHeartbeat(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device || device.isDeleted) return;

    const wasInactive = device.status !== 'active';

    await this.prisma.device.update({
      where: { deviceId },
      data: { status: 'active', lastHeartbeatAt: new Date() },
    });

    if (wasInactive) {
      this.realtimeService.emitDeviceStatus(device.deviceId, 'active');
    }
    
    this.logToFile({
      type: 'INFO',
      message: 'Heartbeat received',
      deviceId
    });
  }
}
