const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const devId = '7570c29b-c644-4798-baae-2d090dadc5f2';
    const stats = await prisma.deviceTelemetry.aggregate({
      where: { deviceId: devId },
      _min: { timestamp: true },
      _max: { timestamp: true },
      _count: { id: true }
    });
    console.log(`--- Telemetry Stats for Ponmudi-Testing (${devId}) ---`);
    console.log('Total Records:', stats._count.id);
    console.log('Oldest Record (UTC):', stats._min.timestamp?.toISOString());
    console.log('Oldest Record (IST):', stats._min.timestamp ? new Date(stats._min.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null);
    console.log('Newest Record (UTC):', stats._max.timestamp?.toISOString());
    console.log('Newest Record (IST):', stats._max.timestamp ? new Date(stats._max.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
