import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function main() {
  const devices = [
    { deviceId: 'GBIAIR_1776087596568', type: 'AIR_QUALITY' },
    { deviceId: 'GBIAIR_1775889859917', type: 'AIR_QUALITY' },
  ];

  console.log('Seeding test devices...');

  for (const device of devices) {
    await prisma.device.upsert({
      where: { deviceId: device.deviceId },
      update: {},
      create: {
        deviceId: device.deviceId,
        type: device.type,
        status: 'ONLINE',
      },
    });
    console.log(`✅ Seeded device: ${device.deviceId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
