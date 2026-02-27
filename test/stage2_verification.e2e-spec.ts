import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module'; // Import real AppModule
import { PrismaService } from '../src/prisma/prisma.service';
import { AlertsService } from '../src/alerts/alerts.service';
import { SseService } from '../src/realtime/sse.service';
import { MqttService } from '../src/mqtt/mqtt.service'; // Fix: Import MqttService
import { JwtService } from '@nestjs/jwt';

describe('Stage 2 Verification (Alerts & SSE)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let alertsService: AlertsService;
  let sseService: SseService;

  const mockSseService = {
    addClient: jest.fn(),
    sendEvent: jest.fn(),
  };

  const mockMqttService = {
    onModuleInit: jest.fn(),
    getClient: jest.fn().mockReturnValue({
      on: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      end: jest.fn(),
    }),
  };

  beforeAll(async () => {
    // We use the REAL AppModule but mock SseService and MqttService
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SseService)
      .useValue(mockSseService)
      .overrideProvider(MqttService) // Fix: Mock MQTT Service
      .useValue(mockMqttService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    alertsService = app.get<AlertsService>(AlertsService);
    sseService = app.get<SseService>(SseService); // This will be the mock

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const generateToken = (userId: string) => {
    return jwtService.sign(
      { sub: userId, email: 'test@example.com' },
      { secret: process.env.JWT_SECRET || 'test-secret' },
    );
  };

  describe('Alert Hierarchy & Hysteresis', () => {
    let deviceId: string;
    let userId: string;
    let groupId: string;
    let token: string;

    beforeEach(async () => {
      jest.clearAllMocks();
      // Cleanup
      await prisma.eventLog.deleteMany();
      await prisma.notification.deleteMany();
      await prisma.alertState.deleteMany();
      await prisma.deviceTelemetry.deleteMany(); // Fix: Delete telemetry first
      await prisma.deviceAssignment.deleteMany();
      await prisma.deviceThreshold.deleteMany(); // Fix: Delete device threshold first
      await prisma.groupThreshold.deleteMany(); // Fix: Delete group threshold first
      await prisma.device.deleteMany();
      await prisma.deviceGroup.deleteMany();
      await prisma.user.deleteMany();

      // Setup Data
      const user = await prisma.user.create({
        data: { email: 'alert-test@example.com', passwordHash: 'hash' },
      });
      userId = user.id;
      token = generateToken(userId);

      const device = await prisma.device.create({
        data: { deviceId: 'TEST-DEV-001', status: 'OFFLINE' },
      });
      deviceId = device.id;

      await prisma.deviceAssignment.create({
        data: { deviceId, userId, assignedAt: new Date() },
      });

      const group = await prisma.deviceGroup.create({
        data: { name: 'Test Group', userId },
      });
      groupId = group.id;
    });

    it('should use Group Threshold if no Device Threshold', async () => {
      // 1. Add device to group
      await prisma.device.update({
        where: { id: deviceId },
        data: { groupId },
      });

      // 2. Set Group Threshold (PM2.5 = 25)
      await prisma.groupThreshold.create({
        data: { groupId, thresholds: { pm25: 25 } },
      });

      // 3. Send Telemetry > 25
      const telemetry = { pm25: 30 };
      await alertsService.evaluate(deviceId, telemetry);

      // 4. Verify Alert Created
      const state = await prisma.alertState.findUnique({
        where: {
          userId_deviceId_parameter: { userId, deviceId, parameter: 'pm25' },
        },
      });
      expect(state?.state).toBe('ALERTING');

      // 5. Verify SSE called
      expect(mockSseService.sendEvent).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          type: 'NOTIFICATION',
          data: expect.objectContaining({
            message: expect.stringContaining('PM25 exceeded limit'),
          }),
        }),
      );
    });

    it('should override Group Threshold with Device Threshold', async () => {
      // 1. Add device to group & Set Group Threshold (PM2.5 = 25)
      await prisma.device.update({
        where: { id: deviceId },
        data: { groupId },
      });
      await prisma.groupThreshold.create({
        data: { groupId, thresholds: { pm25: 25 } },
      });

      // 2. Set Device Threshold (PM2.5 = 50) - HIGHER LIMIT
      await prisma.deviceThreshold.create({
        data: { deviceId, thresholds: { pm25: 50, co2: 6000 } },
      });

      // 3. Send Telemetry = 40 (Breaches Group but NOT Device)
      await alertsService.evaluate(deviceId, { pm25: 40 });

      // 4. Verify NO Alert
      let state = await prisma.alertState.findUnique({
        where: {
          userId_deviceId_parameter: { userId, deviceId, parameter: 'pm25' },
        },
      });
      expect(state).toBeNull(); // Should not exist or be NORMAL

      // 5. Send Telemetry = 55 (Breaches Device)
      await alertsService.evaluate(deviceId, { pm25: 55 });

      // 6. Verify Alert
      state = await prisma.alertState.findUnique({
        where: {
          userId_deviceId_parameter: { userId, deviceId, parameter: 'pm25' },
        },
      });
      expect(state?.state).toBe('ALERTING');
    });

    it('should respect Hysteresis (5%) when resolving', async () => {
      // Threshold = 100. Hysteresis = 5. Resolve Limit = 95.
      await prisma.deviceThreshold.create({
        data: { deviceId, thresholds: { co2: 100 } },
      });

      // 1. Trigger Alert (105 > 100)
      await alertsService.evaluate(deviceId, { co2: 105 });
      let state = await prisma.alertState.findFirst({ where: { deviceId } });
      expect(state?.state).toBe('ALERTING');

      // 2. Value Drops to 98 (Still > 95) -> Should STAY ALERTING
      await alertsService.evaluate(deviceId, { co2: 98 });
      state = await prisma.alertState.findFirst({ where: { deviceId } });
      expect(state?.state).toBe('ALERTING');
      // Should NOT have called sendEvent for resolution
      expect(mockSseService.sendEvent).toHaveBeenCalledTimes(1); // Only the initial trigger

      // 3. Value Drops to 94 (< 95) -> Should RESOLVE
      await alertsService.evaluate(deviceId, { co2: 94 });
      state = await prisma.alertState.findFirst({ where: { deviceId } });
      expect(state?.state).toBe('NORMAL');

      // Verify SSE for resolution
      expect(mockSseService.sendEvent).toHaveBeenLastCalledWith(
        userId,
        expect.objectContaining({
          type: 'NOTIFICATION',
          data: expect.objectContaining({
            message: expect.stringContaining('returned to normal'),
          }),
        }),
      );
    });
  });
});
