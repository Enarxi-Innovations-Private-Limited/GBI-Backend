const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      SELECT setval('"EventLog_id_seq"', COALESCE((SELECT MAX(id) FROM "EventLog"), 0) + 1, false);
    `);
    console.log("EventLog sequence synced.");

    await prisma.$executeRawUnsafe(`
      SELECT setval('"DeviceTelemetry_id_seq"', COALESCE((SELECT MAX(id) FROM "DeviceTelemetry"), 0) + 1, false);
    `);
    console.log("DeviceTelemetry sequence synced.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
