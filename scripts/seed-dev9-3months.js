/**
 * seed-dev9-3months.js
 * =====================
 * Generates 3 months of 1-minute interval mock telemetry data for the device:
 *   DEV9 (GBIAIR_1780299839197)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Reproducible random generation
function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Generate realistic telemetry point based on time of day
function generateDataPoint(timestamp, baseOffset, seedIdx) {
  const hour = timestamp.getHours(); // Local hour context
  const rand1 = seededRandom(seedIdx * 5 + 1);
  const rand2 = seededRandom(seedIdx * 5 + 2);
  const rand3 = seededRandom(seedIdx * 5 + 3);
  const rand4 = seededRandom(seedIdx * 5 + 4);
  const rand5 = seededRandom(seedIdx * 5 + 5);

  // Diurnal cycle for air quality
  let timeFactor = 1.0;
  if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 21)) {
    timeFactor = 1.6 + rand1 * 0.4;
  } else if (hour >= 0 && hour <= 5) {
    timeFactor = 0.6 + rand1 * 0.2; // Cleanest at night
  } else {
    timeFactor = 1.0 + rand1 * 0.3;
  }

  const basePM25 = 15 + baseOffset;
  const pm25 = Math.round(clamp(basePM25 * timeFactor + (rand2 * 6 - 3), 2, 180));
  const pm10 = Math.round(clamp(pm25 * (1.2 + rand3 * 0.4), pm25, 250));

  // Temperature variation (warmest at 2-4 PM, coolest at 4-6 AM)
  let tempBase = 28;
  if (hour >= 12 && hour <= 16) {
    tempBase = 32 + rand4 * 3;
  } else if (hour >= 3 && hour <= 6) {
    tempBase = 24 + rand4 * 2;
  } else {
    tempBase = 27 + rand4 * 3;
  }
  const temperature = parseFloat(tempBase.toFixed(1));

  // Humidity is inversely proportional to temperature
  const humidity = parseFloat(clamp(100 - (temperature - 20) * 3 + (rand5 * 10 - 5), 30, 95).toFixed(1));

  const co2 = Math.round(clamp(400 + (pm25 * 3) + (rand1 * 100 - 50), 380, 1600));
  const tvoc = Math.round(clamp(80 + (pm25 * 1.5) + (rand2 * 40 - 20), 50, 450));
  const noise = Math.round(clamp(35 + (hour >= 8 && hour <= 22 ? 15 : 0) + rand3 * 15, 30, 85));

  // Compute standard AQI category
  let aqi;
  if (pm25 <= 12) {
    aqi = Math.round((50 / 12) * pm25);
  } else if (pm25 <= 35.4) {
    aqi = Math.round(51 + (49 / 23.4) * (pm25 - 12.1));
  } else if (pm25 <= 55.4) {
    aqi = Math.round(101 + (49 / 19.9) * (pm25 - 35.5));
  } else if (pm25 <= 150.4) {
    aqi = Math.round(151 + (49 / 94.9) * (pm25 - 55.5));
  } else {
    aqi = Math.round(201 + (99 / 99.5) * (pm25 - 150.5));
  }

  return {
    pm25,
    pm10,
    temperature,
    humidity,
    co2,
    tvoc,
    noise,
    aqi
  };
}

async function main() {
  const displayId = 'GBIAIR_1780299839197';
  console.log(`🔍 Finding device ${displayId} in database...`);
  
  const device = await prisma.device.findUnique({
    where: { deviceId: displayId }
  });

  if (!device) {
    console.error(`❌ Device with ID ${displayId} not found in database!`);
    process.exit(1);
  }

  console.log(`✅ Found device in DB. UUID: ${device.id}`);
  
  console.log('🧹 Cleaning existing telemetry records for this device...');
  const deleteCount = await prisma.deviceTelemetry.deleteMany({
    where: {
      deviceId: device.id
    }
  });
  console.log(`✅ Cleared ${deleteCount.count} existing telemetry records.`);

  const endDate = new Date(); // Today
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // 3 months ago

  console.log(`📅 Seeding mock data from: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

  let totalInserted = 0;
  let batchData = [];
  const BATCH_SIZE = 8000;

  const currentDay = new Date(startDate.getTime());
  let dayCounter = 1;

  while (currentDay <= endDate) {
    const dayStr = currentDay.toISOString().split('T')[0];
    console.log(`Generating data for Day ${dayCounter++}: ${dayStr}`);

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute++) {
        const timestamp = new Date(currentDay.getTime());
        timestamp.setHours(hour, minute, 0, 0);

        if (timestamp > endDate) continue;

        const epochMinutes = Math.floor(timestamp.getTime() / 60000);
        // DEV9 offset = 5
        const metrics = generateDataPoint(timestamp, 5, epochMinutes);
        const messageId = `mock_3m_${displayId}_${timestamp.getTime()}`;

        batchData.push({
          deviceId: device.id,
          timestamp,
          pm25: metrics.pm25,
          pm10: metrics.pm10,
          temperature: metrics.temperature,
          humidity: metrics.humidity,
          co2: metrics.co2,
          tvoc: metrics.tvoc,
          noise: metrics.noise,
          aqi: metrics.aqi,
          messageId
        });

        if (batchData.length >= BATCH_SIZE) {
          await prisma.deviceTelemetry.createMany({
            data: batchData,
            skipDuplicates: true
          });
          totalInserted += batchData.length;
          process.stdout.write(`⚡ Inserted ${totalInserted} records...\r`);
          batchData = [];
        }
      }
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  if (batchData.length > 0) {
    await prisma.deviceTelemetry.createMany({
      data: batchData,
      skipDuplicates: true
    });
    totalInserted += batchData.length;
  }

  console.log(`\n🎉 Success! Seeding completed. Total records inserted: ${totalInserted}`);

  console.log('🔄 Setting device status to ONLINE...');
  await prisma.device.update({
    where: {
      id: device.id
    },
    data: {
      status: 'ONLINE',
      lastHeartbeatAt: new Date()
    }
  });
  console.log('✅ Device status is now ONLINE.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
