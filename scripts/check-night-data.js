const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const devId = '7570c29b-c644-4798-baae-2d090dadc5f2';
    
    // Check data from July 2 2PM IST to July 3 2AM IST
    // IST = UTC+5:30, so:
    // July 2 2PM IST = July 2 08:30 UTC
    // July 3 2AM IST = July 2 20:30 UTC
    const windowStart = new Date('2026-07-02T08:30:00.000Z');
    const windowEnd   = new Date('2026-07-02T20:30:00.000Z');

    const count = await prisma.deviceTelemetry.count({
      where: {
        deviceId: devId,
        timestamp: { gte: windowStart, lte: windowEnd }
      }
    });

    const sample = await prisma.deviceTelemetry.findMany({
      where: {
        deviceId: devId,
        timestamp: { gte: windowStart, lte: windowEnd }
      },
      orderBy: { timestamp: 'asc' },
      take: 5,
      select: { timestamp: true, pm25: true, pm10: true, aqi: true, temperature: true, humidity: true }
    });

    console.log(`Records in night window (July 2 2PM IST -> July 3 2AM IST): ${count}`);
    console.log('Sample records:');
    sample.forEach(r => {
      console.log(`  ${new Date(r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | pm25=${r.pm25} pm10=${r.pm10} aqi=${r.aqi} temp=${r.temperature} hum=${r.humidity}`);
    });
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
