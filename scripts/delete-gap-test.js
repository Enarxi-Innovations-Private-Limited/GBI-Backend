const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devId = '7570c29b-c644-4798-baae-2d090dadc5f2';

  // 4AM IST = UTC+5:30 → 4:00 - 5:30 = 22:30 previous day
  // 8AM IST = UTC+5:30 → 8:00 - 5:30 = 02:30 same UTC day
  const start = new Date('2026-07-02T22:30:00.000Z'); // Jul 3 4:00 AM IST
  const end   = new Date('2026-07-03T02:30:00.000Z'); // Jul 3 8:00 AM IST

  const count = await prisma.deviceTelemetry.count({
    where: { deviceId: devId, timestamp: { gte: start, lte: end } }
  });
  console.log(`Records in 4AM-8AM IST window: ${count}`);

  const result = await prisma.deviceTelemetry.deleteMany({
    where: { deviceId: devId, timestamp: { gte: start, lte: end } }
  });
  console.log(`Deleted: ${result.count} records`);
  console.log('Gap created: July 3, 4:00 AM IST → 8:00 AM IST (4 hours missing)');

  // Show boundary records to confirm
  console.log('\n--- Last record BEFORE 4AM IST ---');
  const before = await prisma.deviceTelemetry.findFirst({
    where: { deviceId: devId, timestamp: { lt: start } },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true, pm25: true, aqi: true }
  });
  if (before) console.log(`  ${before.timestamp.toISOString()} | IST: ${new Date(before.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | pm25=${before.pm25} aqi=${before.aqi}`);

  console.log('\n--- First record AFTER 8AM IST ---');
  const after = await prisma.deviceTelemetry.findFirst({
    where: { deviceId: devId, timestamp: { gt: end } },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, pm25: true, aqi: true }
  });
  if (after) console.log(`  ${after.timestamp.toISOString()} | IST: ${new Date(after.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | pm25=${after.pm25} aqi=${after.aqi}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
