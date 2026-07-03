const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const devId = '7570c29b-c644-4798-baae-2d090dadc5f2';
    
    // IST to UTC: subtract 5h30m
    // July 3 12AM IST = July 2 18:30 UTC
    // July 3 2AM IST  = July 2 20:30 UTC
    // July 3 4AM IST  = July 2 22:30 UTC
    // July 3 6AM IST  = July 3 00:30 UTC
    
    const segments = [
      { label: 'Jul 2 10:58PM IST -> Jul 3 12AM IST', start: 'July2 17:28 UTC', startUTC: '2026-07-02T17:28:00Z', endUTC: '2026-07-02T18:30:00Z' },
      { label: 'Jul 3 12AM IST -> Jul 3 2AM IST',    startUTC: '2026-07-02T18:30:00Z', endUTC: '2026-07-02T20:30:00Z' },
      { label: 'Jul 3 2AM IST -> Jul 3 4AM IST',     startUTC: '2026-07-02T20:30:00Z', endUTC: '2026-07-02T22:30:00Z' },
      { label: 'Jul 3 4AM IST -> Jul 3 6AM IST',     startUTC: '2026-07-02T22:30:00Z', endUTC: '2026-07-03T00:30:00Z' },
      { label: 'Jul 3 6AM IST -> Jul 3 8AM IST',     startUTC: '2026-07-03T00:30:00Z', endUTC: '2026-07-03T02:30:00Z' },
      { label: 'Jul 3 8AM IST -> Jul 3 10AM IST',    startUTC: '2026-07-03T02:30:00Z', endUTC: '2026-07-03T04:30:00Z' },
      { label: 'Jul 3 10AM IST -> Jul 3 12PM IST',   startUTC: '2026-07-03T04:30:00Z', endUTC: '2026-07-03T06:30:00Z' },
    ];

    for (const seg of segments) {
      const count = await prisma.deviceTelemetry.count({
        where: {
          deviceId: devId,
          timestamp: { gte: new Date(seg.startUTC), lte: new Date(seg.endUTC) }
        }
      });
      console.log(`${seg.label}: ${count} records`);
    }

    // Also show last records before any gap
    console.log('\n--- Last 5 records before July 3 6AM IST (2026-07-03T00:30:00Z UTC) ---');
    const lastBefore = await prisma.deviceTelemetry.findMany({
      where: { deviceId: devId, timestamp: { lte: new Date('2026-07-03T00:30:00Z') } },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: { timestamp: true, pm25: true, aqi: true }
    });
    lastBefore.forEach(r => {
      console.log(`  UTC: ${r.timestamp.toISOString()} | IST: ${new Date(r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | pm25=${r.pm25} aqi=${r.aqi}`);
    });

    console.log('\n--- First 5 records after July 3 6AM IST (2026-07-03T00:30:00Z UTC) ---');
    const firstAfter = await prisma.deviceTelemetry.findMany({
      where: { deviceId: devId, timestamp: { gte: new Date('2026-07-03T00:30:00Z') } },
      orderBy: { timestamp: 'asc' },
      take: 5,
      select: { timestamp: true, pm25: true, aqi: true }
    });
    firstAfter.forEach(r => {
      console.log(`  UTC: ${r.timestamp.toISOString()} | IST: ${new Date(r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | pm25=${r.pm25} aqi=${r.aqi}`);
    });

  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
