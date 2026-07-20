/**
 * seed-night-mock-data.js
 * ========================
 * Inserts realistic mock telemetry data into the gap that exists between:
 *   July 2 10:50 PM IST  (last real data point)
 *   July 3 10:53 AM IST  (first real data point today)
 *
 * Mock data is inserted every 60 seconds across the entire gap so that the
 * analytics chart shows a smooth, continuous line instead of a flat bridge.
 *
 * Night-time (10PM-6AM) values simulate cleaner air (lower PM2.5/AQI).
 * Morning (6AM-11AM) values simulate rising pollution as the day starts.
 *
 * Run: node scripts/seed-night-mock-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// ── Device ─────────────────────────────────────────────────────────────────
const DEVICE_ID = '7570c29b-c644-4798-baae-2d090dadc5f2';

// ── Gap window (UTC) ────────────────────────────────────────────────────────
// Last real point: 2026-07-02T17:20:38Z (10:50 PM IST) → start 1 min later
const GAP_START_UTC = new Date('2026-07-02T17:21:00.000Z'); // 10:51 PM IST Jul 2
const GAP_END_UTC   = new Date('2026-07-03T05:23:00.000Z'); // 10:53 AM IST Jul 3

const INTERVAL_MS = 60 * 1000; // 1 reading per minute

// ── Helper: seeded pseudo-random (reproducible) ─────────────────────────────
function seededRandom(seed) {
  // Simple LCG
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ── Helper: clamp ────────────────────────────────────────────────────────────
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ── Generate a realistic reading for a given timestamp ──────────────────────
function generateReading(ts, idx) {
  // Hour in IST
  const istHour = (ts.getUTCHours() + 5.5) % 24;
  const r1 = seededRandom(idx * 7 + 1);
  const r2 = seededRandom(idx * 7 + 2);
  const r3 = seededRandom(idx * 7 + 3);
  const r4 = seededRandom(idx * 7 + 4);
  const r5 = seededRandom(idx * 7 + 5);
  const r6 = seededRandom(idx * 7 + 6);
  const r7 = seededRandom(idx * 7 + 7);

  let pm25Base, pm10Base, tempBase, humBase, tvocBase, co2Base, noiseBase;

  if (istHour >= 22 || istHour < 3) {
    // Deep night: cleanest air, coolest temp
    pm25Base  = 8  + r1 * 6;   // 8-14
    pm10Base  = 12 + r2 * 8;   // 12-20
    tempBase  = 26 + r3 * 2;   // 26-28°C
    humBase   = 68 + r4 * 10;  // 68-78%
    tvocBase  = 80 + r5 * 40;  // 80-120
    co2Base   = 380 + r6 * 40; // 380-420
    noiseBase = 28 + r7 * 8;   // 28-36 dB
  } else if (istHour >= 3 && istHour < 6) {
    // Pre-dawn: slight rise
    pm25Base  = 12 + r1 * 8;   // 12-20
    pm10Base  = 16 + r2 * 10;  // 16-26
    tempBase  = 25 + r3 * 2;   // 25-27°C
    humBase   = 72 + r4 * 10;  // 72-82%
    tvocBase  = 90 + r5 * 50;  // 90-140
    co2Base   = 390 + r6 * 50; // 390-440
    noiseBase = 30 + r7 * 8;   // 30-38 dB
  } else if (istHour >= 6 && istHour < 9) {
    // Early morning: commute pollution rising
    pm25Base  = 18 + r1 * 10;  // 18-28
    pm10Base  = 22 + r2 * 12;  // 22-34
    tempBase  = 27 + r3 * 3;   // 27-30°C
    humBase   = 60 + r4 * 12;  // 60-72%
    tvocBase  = 110 + r5 * 60; // 110-170
    co2Base   = 410 + r6 * 60; // 410-470
    noiseBase = 38 + r7 * 14;  // 38-52 dB
  } else {
    // Morning (9AM+): moderate
    pm25Base  = 14 + r1 * 8;   // 14-22
    pm10Base  = 18 + r2 * 10;  // 18-28
    tempBase  = 29 + r3 * 3;   // 29-32°C
    humBase   = 50 + r4 * 12;  // 50-62%
    tvocBase  = 100 + r5 * 50; // 100-150
    co2Base   = 400 + r6 * 50; // 400-450
    noiseBase = 35 + r7 * 12;  // 35-47 dB
  }

  const pm25 = Math.round(clamp(pm25Base, 1, 150));
  const pm10 = Math.round(clamp(pm10Base, pm25, 200));
  const temp = parseFloat(clamp(tempBase, 20, 45).toFixed(1));
  const hum  = parseFloat(clamp(humBase, 30, 95).toFixed(1));
  const tvoc = Math.round(clamp(tvocBase, 50, 500));
  const co2  = Math.round(clamp(co2Base, 350, 2000));
  const noise = Math.round(clamp(noiseBase, 20, 100));

  // Simple AQI from PM2.5 (US EPA breakpoints simplified)
  let aqi;
  if (pm25 <= 12)       aqi = Math.round((50/12)   * pm25);
  else if (pm25 <= 35.4) aqi = Math.round(51 + (49/23.4)   * (pm25 - 12.1));
  else if (pm25 <= 55.4) aqi = Math.round(101 + (49/19.9)  * (pm25 - 35.5));
  else if (pm25 <= 150.4) aqi = Math.round(151 + (49/94.9) * (pm25 - 55.5));
  else                   aqi = 200;

  return { pm25, pm10, temp, hum, tvoc, co2, noise, aqi };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌙 GBI Night Mock Data Seeder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Device   : ${DEVICE_ID}`);
  console.log(`Gap Start: ${GAP_START_UTC.toISOString()} (${new Date(GAP_START_UTC).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)`);
  console.log(`Gap End  : ${GAP_END_UTC.toISOString()} (${new Date(GAP_END_UTC).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)`);
  console.log();

  // Build all records
  const records = [];
  let cursor = new Date(GAP_START_UTC.getTime());
  let idx = 0;

  while (cursor <= GAP_END_UTC) {
    const { pm25, pm10, temp, hum, tvoc, co2, noise, aqi } = generateReading(cursor, idx);
    const msgId = `mock_night_${cursor.getTime()}_${crypto.randomBytes(4).toString('hex')}`;

    records.push({
      deviceId   : DEVICE_ID,
      timestamp  : new Date(cursor.getTime()),
      pm25,
      pm10,
      temperature: temp,
      humidity   : hum,
      tvoc,
      co2,
      noise,
      aqi,
      messageId  : msgId,
    });

    cursor = new Date(cursor.getTime() + INTERVAL_MS);
    idx++;
  }

  console.log(`📊 Total records to insert: ${records.length}`);
  console.log(`   (covers ~${Math.round(records.length / 60)} hours at 1 reading/min)`);
  console.log();

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    await prisma.deviceTelemetry.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += batch.length;
    process.stdout.write(`\r✅ Inserted ${inserted}/${records.length} records...`);
  }

  console.log('\n');
  console.log('🎉 Done! Night mock data inserted successfully.');
  console.log('   The analytics chart should now show a continuous line through the night.');

  // Verify
  const stats = await prisma.deviceTelemetry.aggregate({
    where: { deviceId: DEVICE_ID },
    _min: { timestamp: true },
    _max: { timestamp: true },
    _count: { timestamp: true }
  });
  console.log('\n📈 Updated DB stats:');
  console.log(`   Total records : ${stats._count.timestamp}`);
  console.log(`   Oldest (IST)  : ${new Date(stats._min.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  console.log(`   Newest (IST)  : ${new Date(stats._max.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
