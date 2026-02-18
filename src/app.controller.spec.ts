import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { MqttService } from './mqtt/mqtt.service';
import { HttpStatus } from '@nestjs/common';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockRedis = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  const mockMqttService = {
    getClient: jest.fn().mockReturnValue({ connected: true }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: MqttService, useValue: mockMqttService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return metadata object', () => {
      const result = appController.getHello();
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('status', 'running');
    });
  });

  describe('health/live', () => {
    it('should return alive status', () => {
      const result = appController.getHealthLive() as any;
      expect(result.status).toBe('alive');
      expect(result).toHaveProperty('uptime');
    });
  });

  describe('healthready', () => {
    it('should return ready status (200) when all services are up', async () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      await appController.getHealthReady(res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ready' }),
      );
    });

    it('should return service unavailable (503) when a service is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
      await appController.getHealthReady(res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'degraded' }),
      );
    });
  });

  describe('health', () => {
    it('should return summary status', async () => {
      const result = await appController.getHealth();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('servicesUp');
    });
  });
});
