import { PrismaClient } from '@prisma/client';

async function main() {
  const prodUrl = process.env.PROD_DATABASE_URL;
  const devUrl = process.env.DATABASE_URL;

  if (!prodUrl) {
    throw new Error(
      'CRITICAL: PROD_DATABASE_URL environment variable is required!',
    );
  }
  if (!devUrl) {
    throw new Error('CRITICAL: DATABASE_URL environment variable is required!');
  }

  // SAFETY CHECKS: Ensure we never perform writes on the prod database URL
  if (devUrl.toLowerCase().includes('defaultdb')) {
    throw new Error(
      'CRITICAL SAFETY BLOCK: Target database URL contains "defaultdb" (Production)! Aborting.',
    );
  }

  console.log('🔗 Connecting to databases...');
  const prodPrisma = new PrismaClient({
    datasources: { db: { url: prodUrl } },
  });

  const devPrisma = new PrismaClient({
    datasources: { db: { url: devUrl } },
  });

  try {
    console.log(
      '🔄 Cleaning up any existing records in dev database (gbi_dev) to prevent unique key violations...',
    );
    // Delete in correct dependency order
    await devPrisma.premiumHistory.deleteMany();
    await devPrisma.premiumSubscription.deleteMany();
    await devPrisma.generatedReport.deleteMany();
    await devPrisma.subscription.deleteMany();
    await devPrisma.subscriptionPlan.deleteMany();
    await devPrisma.refreshToken.deleteMany();
    await devPrisma.notification.deleteMany();
    await devPrisma.eventLog.deleteMany();
    await devPrisma.alertState.deleteMany();
    await devPrisma.deviceTelemetry.deleteMany();
    await devPrisma.deviceThreshold.deleteMany();
    await devPrisma.groupThreshold.deleteMany();
    await devPrisma.deviceAssignment.deleteMany();
    await devPrisma.device.deleteMany();
    await devPrisma.deviceGroup.deleteMany();
    await devPrisma.user.deleteMany();
    await devPrisma.userDevice.deleteMany();
    console.log('✅ Dev database (gbi_dev) cleaned.');

    console.log('📡 Fetching data from prod database (defaultdb)...');

    const users = await prodPrisma.user.findMany();
    const userDevices = await prodPrisma.userDevice.findMany();
    const subscriptionPlans = await prodPrisma.subscriptionPlan.findMany();
    const deviceGroups = await prodPrisma.deviceGroup.findMany();
    const devices = await prodPrisma.device.findMany();
    const subscriptions = await prodPrisma.subscription.findMany();
    const premiumSubscriptions =
      await prodPrisma.premiumSubscription.findMany();
    const premiumHistories = await prodPrisma.premiumHistory.findMany();
    const generatedReports = await prodPrisma.generatedReport.findMany();
    const refreshTokens = await prodPrisma.refreshToken.findMany();
    const notifications = await prodPrisma.notification.findMany();
    const eventLogs = await prodPrisma.eventLog.findMany();
    const alertStates = await prodPrisma.alertState.findMany();
    const deviceThresholds = await prodPrisma.deviceThreshold.findMany();
    const groupThresholds = await prodPrisma.groupThreshold.findMany();
    const deviceAssignments = await prodPrisma.deviceAssignment.findMany();

    console.log('✅ Data fetched successfully.');
    console.log(`📊 Stats:
      Users: ${users.length}
      Devices: ${devices.length}
    `);

    console.log(
      '🚀 Cloning data into dev database (gbi_dev) in correct relational order...',
    );

    // 1. User & UserDevice
    if (users.length > 0) {
      await devPrisma.user.createMany({ data: users });
    }
    if (userDevices.length > 0) {
      await devPrisma.userDevice.createMany({ data: userDevices });
    }

    // 2. SubscriptionPlan
    if (subscriptionPlans.length > 0) {
      const subPlansData = subscriptionPlans.map((sp) => ({
        ...sp,
        features: sp.features as any,
      }));
      await devPrisma.subscriptionPlan.createMany({ data: subPlansData });
    }

    // 3. DeviceGroup
    if (deviceGroups.length > 0) {
      await devPrisma.deviceGroup.createMany({ data: deviceGroups });
    }

    // 4. Device
    if (devices.length > 0) {
      // Omit relations if they are fetched implicitly, map data exactly
      const deviceData = devices.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        status: d.status,
        addedAt: d.addedAt,
        type: d.type,
        lastHeartbeatAt: d.lastHeartbeatAt,
        deletedAt: d.deletedAt,
        isDeleted: d.isDeleted,
        groupId: d.groupId,
      }));
      await devPrisma.device.createMany({ data: deviceData });
    }

    // 5. Subscriptions, Premium, Reports, Tokens
    if (subscriptions.length > 0) {
      await devPrisma.subscription.createMany({ data: subscriptions });
    }
    if (premiumSubscriptions.length > 0) {
      await devPrisma.premiumSubscription.createMany({
        data: premiumSubscriptions,
      });
    }
    if (premiumHistories.length > 0) {
      await devPrisma.premiumHistory.createMany({ data: premiumHistories });
    }
    if (generatedReports.length > 0) {
      await devPrisma.generatedReport.createMany({ data: generatedReports });
    }
    if (refreshTokens.length > 0) {
      await devPrisma.refreshToken.createMany({ data: refreshTokens });
    }

    // 6. Notifications, Events, AlertStates
    if (notifications.length > 0) {
      await devPrisma.notification.createMany({ data: notifications });
    }
    if (eventLogs.length > 0) {
      // Map BigInt specifically
      const eventLogData = eventLogs.map((e) => ({
        id: e.id,
        deviceId: e.deviceId,
        userId: e.userId,
        eventType: e.eventType,
        parameter: e.parameter,
        value: e.value,
        createdAt: e.createdAt,
      }));
      await devPrisma.eventLog.createMany({ data: eventLogData });
    }
    if (alertStates.length > 0) {
      await devPrisma.alertState.createMany({ data: alertStates });
    }

    // 7. Thresholds & Assignments
    if (deviceThresholds.length > 0) {
      const deviceThresholdData = deviceThresholds.map((dt) => ({
        ...dt,
        thresholds: dt.thresholds as any,
      }));
      await devPrisma.deviceThreshold.createMany({ data: deviceThresholdData });
    }
    if (groupThresholds.length > 0) {
      const groupThresholdData = groupThresholds.map((gt) => ({
        ...gt,
        thresholds: gt.thresholds as any,
      }));
      await devPrisma.groupThreshold.createMany({ data: groupThresholdData });
    }
    if (deviceAssignments.length > 0) {
      await devPrisma.deviceAssignment.createMany({ data: deviceAssignments });
    }

    // 8. Telemetry Data (Skipped for performance — 780k+ records)

    console.log(
      '🔄 Resetting sequence counters in PostgreSQL for dev autoincrementing columns...',
    );
    // Reset sequences so new writes do not conflict with cloned IDs
    await devPrisma.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('"EventLog"', 'id'), coalesce(max(id), 1)) FROM "EventLog";
    `);
    await devPrisma.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('"DeviceTelemetry"', 'id'), coalesce(max(id), 1)) FROM "DeviceTelemetry";
    `);

    console.log(
      '🎉 Data successfully copied and sequences reset! gbi_dev is now restored.',
    );
  } finally {
    await prodPrisma.$disconnect();
    await devPrisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
