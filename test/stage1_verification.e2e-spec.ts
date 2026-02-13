import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { GroupsModule } from '../src/groups/groups.module';
import { DevicesModule } from '../src/module/devices/devices.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

describe('Stage 1 Verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let ownerToken: string;
  let otherUserToken: string;
  let deviceId: string;
  let groupId: string;
  let ownerId: string;
  let otherUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        PrismaModule,
        GroupsModule,
        DevicesModule,
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : null),
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateUser: async (id: string) => ({ id }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    await app.init();

    // --- SETUP DATA ---
    // 1. Create Owner User
    const owner = await prisma.user.create({
      data: {
        email: `owner_${Date.now()}@test.com`,
        name: 'Owner',
        emailVerified: true,
      },
    });
    ownerId = owner.id;
    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email });

    // 2. Create Other User (Attacker)
    const other = await prisma.user.create({
      data: {
        email: `attacker_${Date.now()}@test.com`,
        name: 'Attacker',
        emailVerified: true,
      },
    });
    otherUserId = other.id;
    otherUserToken = jwtService.sign({ sub: other.id, email: other.email });

    // 3. Create Device
    const device = await prisma.device.create({
      data: {
        deviceId: `DEV_${Date.now()}`,
        status: 'ONLINE',
        type: 'Air Quality Monitor',
      },
    });
    deviceId = device.id; // Internal UUID

    // 4. Assign Device to Owner
    await prisma.deviceAssignment.create({
      data: {
        userId: owner.id,
        deviceId: device.id,
      },
    });

    // 5. Create Group for Owner
    const group = await prisma.deviceGroup.create({
      data: {
        name: 'Owner Group',
        userId: owner.id,
      },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    // Cleanup
    if (groupId) await prisma.deviceGroup.delete({ where: { id: groupId } }).catch(() => {});
    if (deviceId) await prisma.device.delete({ where: { id: deviceId } }).catch(() => {});
    if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    await app.close();
  });

  // --- TEST CASES ---

  it('1. Security Test: Attacker cannot add Owner device to their group', async () => {
    // Attacker creates their own group
    const attackerGroup = await prisma.deviceGroup.create({
      data: { name: 'Attacker Group', userId: otherUserId },
    });

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error('Device not found');
    
    await request(app.getHttpServer())
      .post(`/groups/${attackerGroup.id}/devices`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ deviceId: device.deviceId })
      .expect(403); // ForbiddenException

     // Cleanup
     await prisma.deviceGroup.delete({ where: { id: attackerGroup.id } });
  });

  it('2. Mutex Test A: Cannot add device with Individual Threshold to a Group', async () => {
    // 1. Set Individual Threshold
    await prisma.deviceThreshold.create({
      data: {
        deviceId: deviceId,
        thresholds: { pm25: 50 },
      },
    });

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
     if (!device) throw new Error('Device not found');

    await request(app.getHttpServer())
      .post(`/groups/${groupId}/devices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: device.deviceId })
      .expect(400); // BadRequestException (must remove individual threshold first)

    // Cleanup: Remove individual threshold
    await prisma.deviceThreshold.delete({ where: { deviceId } });
  });

  it('3. Mutex Test B: Cannot set Individual Threshold if device is in a Group', async () => {
    // 1. Add device to Group (Success case first)
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
     if (!device) throw new Error('Device not found');

    await request(app.getHttpServer())
      .post(`/groups/${groupId}/devices`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deviceId: device.deviceId })
      .expect(201); // Created/OK (Assuming POST returns 201)

    // 2. Attempt to set Individual Threshold
    // Assuming endpoint POST /devices/:id/threshold 
    // Wait, typical NestJS POST returns 201.
    
    await request(app.getHttpServer())
      .post(`/devices/${device.deviceId}/threshold`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ thresholds: { pm25: 100 } })
      .expect(409); // ConflictException

     // Cleanup: Remove from group (by updating device.groupId = null ? No, device is linked via Group.devices)
     // To remove device from group, we probably need an endpoint or direct DB manipulation.
     // Since GroupsService.addDeviceToGroup calls connect, we can disconnect via DB.
     await prisma.device.update({
         where: { id: deviceId },
         data: { groupId: null }
     });
  });

  it('4. Cleanup Verification: AlertThreshold model is gone', async () => {
    const prismaClient: any = prisma;
    expect(prismaClient.alertThreshold).toBeUndefined();
  });
});
