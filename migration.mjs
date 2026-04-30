import { PrismaClient } from "@prisma/client";

const oldPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.OLD_DB_UR }
  }
});

const newPrisma = new PrismaClient({
  datasources: {
    db: { url:  process.env.NEW_DB_UR }
  }
});

// ⚠️ ORDER MATTERS (parent → child)
const tables = [
  "user",
  "admin",
  "device",
  "deviceGroup",
  "deviceAssignment",
  "deviceTelemetry",
  "deviceThreshold",
  "alertState",
  "eventLog",
  "notification",
  "subscriptionPlan",
  "subscription",
  "premiumSubscription",
  "premiumHistory",
  "refreshToken",
  "userDevice"
];

async function migrateTable(table) {
  try {
    console.log(`🚀 Migrating ${table}...`);

    const oldData = await oldPrisma[table].findMany();

    console.log(`Found ${oldData.length} records`);

    for (const row of oldData) {
      try {
        await newPrisma[table].create({
          data: row
        });
      } catch (err) {
        console.log(`⚠️ Skipping duplicate in ${table}`);
      }
    }

    console.log(`✅ ${table} done`);
  } catch (err) {
    console.error(`❌ Error in ${table}:`, err);
  }
}

async function migrateAll() {
  try {
    for (const table of tables) {
      await migrateTable(table);
    }

    console.log("🎉 FULL DATABASE MIGRATION COMPLETE");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

migrateAll();