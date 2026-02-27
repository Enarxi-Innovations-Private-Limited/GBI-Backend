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
      const result = await appController.getHealthReady();
      expect(result).toEqual(expect.objectContaining({ status: 'ready' }));
    });

    it('should throw ServiceUnavailableException when a service is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
      await expect(appController.getHealthReady()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
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
