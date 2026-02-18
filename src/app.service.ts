import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { Redis } from 'ioredis';
import { MqttService } from './mqtt/mqtt.service';
import * as packageJson from '../package.json';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly mqttService: MqttService,
  ) {}

  getHello(): object {
    return {
      service: 'GBI Air Quality Monitor Backend',
      version: packageJson.version,
      status: 'running',
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  getHealthLive(): object {
    return {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  async getHealthReady(): Promise<any> {
    const dependencies: Record<string, { status: string; responseTimeMs: number; error: string | null }> = {
      database: { status: 'unknown', responseTimeMs: 0, error: null },
      redis: { status: 'unknown', responseTimeMs: 0, error: null },
      mqtt: { status: 'unknown', responseTimeMs: 0, error: null },
    };

    let upCount = 0;
    const totalServices = 3;

    // Check Database
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dependencies.database.status = 'up';
      dependencies.database.responseTimeMs = Date.now() - dbStart;
      upCount++;
    } catch (error) {
      dependencies.database.status = 'down';
      dependencies.database.error = error.message;
      this.logger.error('Database health check failed', error);
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      await this.redis.ping();
      dependencies.redis.status = 'up';
      dependencies.redis.responseTimeMs = Date.now() - redisStart;
      upCount++;
    } catch (error) {
      dependencies.redis.status = 'down';
      dependencies.redis.error = error.message;
      this.logger.error('Redis health check failed', error);
    }

    // Check MQTT
    const mqttStart = Date.now();
    try {
      const client = this.mqttService.getClient();
      if (client && client.connected) {
         dependencies.mqtt.status = 'up';
      } else {
         dependencies.mqtt.status = 'down';
         dependencies.mqtt.error = 'Client not connected';
      }
      dependencies.mqtt.responseTimeMs = Date.now() - mqttStart;
      if (dependencies.mqtt.status === 'up') upCount++;
    } catch (error) {
      dependencies.mqtt.status = 'down';
      dependencies.mqtt.error = error.message;
      this.logger.error('MQTT health check failed', error);
    }

    const overallStatus =
      upCount === totalServices
        ? 'ready'
        : upCount === 0
        ? 'not_ready'
        : 'degraded';

    return {
      status: overallStatus,
      score: upCount / totalServices,
      services: dependencies,
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth(): Promise<object> {
    const readiness = await this.getHealthReady();
    const isReady = readiness.status === 'ready';
    const upCount = Object.values(readiness.services).filter(
      (s: any) => s.status === 'up',
    ).length;

    return {
      status: isReady ? 'ok' : 'degraded',
      ready: isReady,
      servicesUp: upCount,
      servicesDown: 3 - upCount, // Hardcoded for now based on totalServices
      timestamp: new Date().toISOString(),
    };
  }
}
