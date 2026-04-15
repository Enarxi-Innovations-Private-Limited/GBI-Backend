import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { plainToInstance } from 'class-transformer';
import { TelemetryPayloadDto } from './dto/telemetry-payload.dto';
import { validate } from 'class-validator';
import { AlertsService } from 'src/alerts/alerts.service';
import { RealtimeService } from 'src/realtime/realtime.service';
import * as fs from 'fs';
import * as path from 'path';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { DeviceStatus } from '@prisma/client';

/**
 * Service responsible for consuming MQTT messages from the broker.
 * Handles telemetry data and device heartbeat updates.
 */
@Injectable()
export class MqttConsumer implements OnModuleInit, OnModuleDestroy {
  private logFilePath: string;
  private readonly logger = new Logger(MqttConsumer.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly realtimeService: RealtimeService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
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
          payload: payloadString,
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
            error: parseError.message,
          };

          this.logError(errorLog);

          // Log to console
          this.logger.error('❌ Invalid JSON received on topic:', topic);
          this.logger.error('   Device ID:', deviceId);
          this.logger.error('   Full Payload:', payloadString);
          this.logger.error('   Parse Error:', parseError.message);

          return; // Skip this message
        }

        if (topic.includes('telemetry')) {
          await this.handleTelemetry(deviceId, data);
        }
      } catch (error) {
        this.logger.error('MQTT message error:', error.message);

        // Log general errors to file
        this.logError({
          type: 'ERROR',
          message: 'Unhandled MQTT message error',
          error: error.message,
          stack: error.stack,
        });
      }
    });
  }

  onModuleDestroy() {
    this.logger.log(`🛑 [PID: ${process.pid}] MQTT Consumer shutting down...`);
    const client = this.mqttService.getClient();
    if (client) {
      client.end(true, () => {
        this.logger.log(`🛑 [PID: ${process.pid}] MQTT Client disconnected.`);
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
    const istDate = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );

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
    const istDate = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );
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
        timestamp: this.getISTTimestamp(), // Log header in IST
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

    // ─── FIX: Use async fs.appendFile instead of BLOCKING fs.appendFileSync ───
    // appendFileSync blocks Node's event loop on EVERY MQTT message.
    // At 10K devices × 1 msg/sec = 10,000 synchronous disk writes/sec → event loop stall.
    const logEntry =
      JSON.stringify({ timestamp: this.getISTTimestamp(), ...data }) + '\n';
    fs.appendFile(this.logFilePath, logEntry, 'utf8', (err) => {
      if (err) console.error('Failed to write to log file:', err.message);
    });
  }

  private logError(data: any) {
    try {
      const errorLogPath = this.getDailyErrorLogPath();
      const logEntry =
        JSON.stringify({ timestamp: this.getISTTimestamp(), ...data }) + '\n';

      // Non-blocking async writes for both error log and session log
      fs.appendFile(errorLogPath, logEntry, 'utf8', (err) => {
        if (err) console.error('Failed to write to error log:', err.message);
      });
      this.logToFile(data);
    } catch (error) {
      console.error('Failed to write to error log file:', error);
    }
  }

  private extractDeviceId(topic: string): string {
    return topic.split('/')[2];
  }

  private async handleTelemetry(deviceId: string, payload: any) {
    // Normalize uppercase 'AQI' from hardware payload to lowercase 'aqi' expected by DTO
    if (payload && payload.AQI !== undefined && payload.aqi === undefined) {
      payload.aqi = payload.AQI;
    }

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
        deviceId,
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
      const invalidFields = errors.map((err) => {
        // Handle mapped property name for AQI (which comes as 'AQI' in payload but is 'aqi' in DTO)
        const receivedValue = payload[err.property];

        // Determine the error code based on the constraints
        let code = 'UNKNOWN';
        let message = 'Validation failed';

        if (err.constraints) {
          if (
            err.constraints.isNumber ||
            (err.constraints.isNumber && err.value === undefined)
          ) {
            // Check if value was missing/undefined or if it was truly an invalid number
            if (
              receivedValue === undefined ||
              receivedValue === null ||
              receivedValue === ''
            ) {
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
            message =
              'Must be ≤ ' +
              (err.property === 'pm25' || err.property === 'pm10'
                ? '2000'
                : err.property === 'tvoc'
                  ? '60000'
                  : err.property === 'co2'
                    ? '20000'
                    : err.property === 'temperature'
                      ? '100'
                      : err.property === 'humidity'
                        ? '100'
                        : err.property === 'noise'
                          ? '200'
                          : err.property === 'aqi'
                            ? '500'
                            : 'limit');
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
        rawErrors: errors,
      });
      // Do NOT return here, proceed to save valid data
    } else {
      console.log('✅ Validation passed. Saving to database...');
    }

    // 1) Enforce strict messageId presence
    if (!payload.messageId) {
      const msg = 'Missing messageId in payload';
      console.warn('\u274c ' + msg, deviceId);
      this.logError({
        level: 'WARN',
        event: 'telemetry_rejected_missing_messageId',
        deviceId,
        message: msg,
        payload: payload,
      });
      return;
    }

    // 2) Redis-level deduplication — runs BEFORE the expensive DB transaction
    //    Uses SET NX (set if not exists) with a 5-minute TTL.
    //    This replaces the DB-level @@unique([deviceId, messageId]) constraint
    //    which caused B+ tree write overhead on every single insert.
    try {
      const dedupKey = `dedup:${deviceId}:${payload.messageId}`;
      const isNew = await this.redis.set(dedupKey, '1', 'EX', 300, 'NX');
      if (!isNew) {
        this.logger.debug(
          `\u267b️ Duplicate messageId ${payload.messageId} rejected at Redis layer for device ${deviceId}`,
        );
        return; // Drop silently — already processed within last 5 minutes
      }
    } catch (redisErr) {
      // Redis unavailable — fall through to DB unique constraint as safety net
      this.logger.warn(`[MqttConsumer] Redis dedup unavailable: ${redisErr.message}`);
    }

    // Helper to sanitize numeric values (NaN or undefined becomes null)
    const sanitize = (val: number | undefined) =>
      typeof val === 'number' && !isNaN(val) ? val : null;

    const pm25 = sanitize(dto.pm25);
    const pm10 = sanitize(dto.pm10);
    const tvoc = sanitize(dto.tvoc);
    const co2 = sanitize(dto.co2);
    const temperature = sanitize(dto.temperature);
    const humidity = sanitize(dto.humidity);
    const noise = sanitize(dto.noise);
    const aqi = sanitize(dto.aqi);

    // 2) Determine new status dynamically
    const allMetricsPresent =
      pm25 !== null &&
      pm10 !== null &&
      tvoc !== null &&
      co2 !== null &&
      temperature !== null &&
      humidity !== null &&
      noise !== null &&
      aqi !== null;

    const newStatus = allMetricsPresent
      ? DeviceStatus.ONLINE
      : DeviceStatus.WARNING;

    try {
      // 3) Transactional execution protecting the uniqueness constraint
      const { savedTelemetry, updatedDevice } = await this.prisma.$transaction(
        async (tx) => {
          const telemetryInsert = await tx.deviceTelemetry.create({
            data: {
              deviceId: device.id,
              messageId: payload.messageId,
              pm25,
              pm10,
              tvoc,
              co2,
              temperature,
              humidity,
              noise,
              aqi,
            },
          });

          // Only update device state if telemetry insert succeeded
          const deviceUpdate = await tx.device.update({
            where: { id: device.id },
            data: {
              lastHeartbeatAt: new Date(),
              status: newStatus,
            },
          });

          return {
            savedTelemetry: telemetryInsert,
            updatedDevice: deviceUpdate,
          };
        },
      );

      this.logToFile({
        type: 'SUCCESS',
        message: 'Telemetry saved to database',
        deviceId,
        telemetryId: savedTelemetry.id.toString(),
      });

      if (device.status !== newStatus) {
        console.log(
          `✅ Device status updated: ${device.status} -> ${newStatus}`,
        );
      } else {
        console.log('✅ Telemetry data saved successfully!');
      }

      // Emit real-time update
      this.realtimeService.emitTelemetry(device.deviceId, {
        timestamp: savedTelemetry.timestamp,
        pm25: savedTelemetry.pm25,
        pm10: savedTelemetry.pm10,
        tvoc: savedTelemetry.tvoc,
        co2: savedTelemetry.co2,
        temperature: savedTelemetry.temperature,
        humidity: savedTelemetry.humidity,
        noise: savedTelemetry.noise,
        aqi: savedTelemetry.aqi,
      });

      if (device.status !== newStatus) {
        this.realtimeService.emitDeviceStatus(device.deviceId, newStatus);
      }

      // Write ONLINE event log when device recovers from OFFLINE
      if (device.status === DeviceStatus.OFFLINE && newStatus === DeviceStatus.ONLINE) {
        const assignments = await this.prisma.deviceAssignment.findMany({
          where: { deviceId: device.id, unassignedAt: null },
          select: { userId: true },
        });
        for (const a of assignments) {
          await this.prisma.eventLog.create({
            data: {
              deviceId: device.id,
              userId: a.userId,
              eventType: 'ONLINE',
            },
          });
        }
      }

      await this.alertsService.evaluate(device.id, dto);

      // 4) Set latest state in Redis (TTL = 2 * Offline Timeout)
      const offlineTimeoutSeconds =
        (Number(process.env.DEVICE_TELEMETRY_INTERVAL_SECONDS) || 60) *
        (Number(process.env.DEVICE_OFFLINE_THRESHOLD_MISSES) || 5);

      const redisKey = `device:${device.deviceId}:latest`;
      const redisState = {
        messageId: payload.messageId,
        timestamp: savedTelemetry.timestamp.toISOString(),
        status: newStatus,
        lastHeartbeatAt: new Date().toISOString(),
        pm25,
        pm10,
        tvoc,
        co2,
        temperature,
        humidity,
        noise,
        aqi,
      };

      await this.redis.setex(
        redisKey,
        offlineTimeoutSeconds * 2,
        JSON.stringify(redisState),
      );
    } catch (dbError) {
      if (dbError.code === 'P2002') {
        // Idempotent completion: Duplicate messageId detected for this device
        this.logToFile({
          level: 'INFO',
          event: 'duplicate_telemetry_ignored',
          deviceId,
          messageId: payload.messageId,
          message:
            'Telemetry message safely ignored due to duplicate messageId',
        });
        console.log(
          `♻️ Ignored duplicate messageId ${payload.messageId} for device ${deviceId}`,
        );
        return;
      }

      console.error('❌ Database error:', dbError.message);
      this.logError({
        type: 'ERROR',
        message: 'Database save failed',
        deviceId,
        error: dbError.message,
        payload: dto,
      });
    }
  }
}
