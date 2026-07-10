/**
 * mock-dev9-daemon.js
 * =====================
 * Daemon simulator script that runs continuously and inserts mock telemetry 
 * data for DEV9 (GBIAIR_1780299839197) every 60 seconds.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to generate realistic data based on time of day
function generateDataPoint(timestamp, baseOffset, seedIdx) {
  const hour = timestamp.getHours();
  const rand1 = Math.random();
  const rand2 = Math.random();
  const rand3 = Math.random();
  const rand4 = Math.random();
  const rand5 = Math.random();

  let timeFactor = 1.0;
  if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 21)) {
    timeFactor = 1.6 + rand1 * 0.4;
  } else if (hour >= 0 && hour <= 5) {
    timeFactor = 0.6 + rand1 * 0.2;
  } else {
    timeFactor = 1.0 + rand1 * 0.3;
  }

  const basePM25 = 15 + baseOffset;
  const pm25 = Math.round(Math.max(2, Math.min(180, basePM25 * timeFactor + (rand2 * 6 - 3))));
  const pm10 = Math.round(Math.max(pm25, Math.min(250, pm25 * (1.2 + rand3 * 0.4))));

  let tempBase = 28;
  if (hour >= 12 && hour <= 16) {
    tempBase = 32 + rand4 * 3;
  } else if (hour >= 3 && hour <= 6) {
    tempBase = 24 + rand4 * 2;
  } else {
    tempBase = 27 + rand4 * 3;
  }
  const temperature = parseFloat(tempBase.toFixed(1));
  const humidity = parseFloat(Math.max(30, Math.min(95, 100 - (temperature - 20) * 3 + (rand5 * 10 - 5))).toFixed(1));

  const co2 = Math.round(Math.max(380, Math.min(1600, 400 + (pm25 * 3) + (rand1 * 100 - 50))));
  const tvoc = Math.round(Math.max(50, Math.min(450, 80 + (pm25 * 1.5) + (rand2 * 40 - 20))));
  const noise = Math.round(Math.max(30, Math.min(85, 35 + (hour >= 8 && hour <= 22 ? 15 : 0) + rand3 * 15)));

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

  return { pm25, pm10, temperature, humidity, co2, tvoc, noise, aqi };
}

async function insertTelemetry(device, displayId) {
  const timestamp = new Date();
  // Clean seconds & ms to keep clean 1-minute bucket alignment
  timestamp.setSeconds(0, 0);

  const metrics = generateDataPoint(timestamp, 5, Math.floor(timestamp.getTime() / 60000));
  const messageId = `live_mock_${displayId}_${timestamp.getTime()}`;

  try {
    const newRecord = await prisma.deviceTelemetry.create({
      data: {
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
      }
    });

    console.log(`[${new Date().toLocaleTimeString()}] Live point created: PM2.5=${newRecord.pm25}, Temp=${newRecord.temperature}, AQI=${newRecord.aqi}`);

    // Update heartbeat
    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'ONLINE',
        lastHeartbeatAt: new Date()
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      console.warn(`[${new Date().toLocaleTimeString()}] Skipping duplicate (data for this minute already seeded).`);
    } else {
      console.error(`[${new Date().toLocaleTimeString()}] Telemetry write failed:`, error);
    }
  }
}

async function main() {
  const displayId = 'GBIAIR_1780299839197';
  console.log(`🔍 Finding device ${displayId}...`);
  const device = await prisma.device.findUnique({
    where: { deviceId: displayId }
  });

  if (!device) {
    console.error(`❌ Device with ID ${displayId} not found in database!`);
    process.exit(1);
  }

  console.log(`✅ Found device. Starting live telemetry daemon...`);

  // Insert initial point immediately
  await insertTelemetry(device, displayId);

  // Set interval to repeat every 60 seconds
  const intervalId = setInterval(async () => {
    await insertTelemetry(device, displayId);
  }, 60000);

  const shutdown = async () => {
    console.log('\nStopping simulator daemon...');
    clearInterval(intervalId);
    await prisma.$disconnect();
    console.log('Disconnected. Bye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
