const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const EMAIL = 'asyedabdulrahman3@gmail.com';
  
  // 1. Find the user
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
  });

  if (!user) {
    console.error(`❌ User not found with email: ${EMAIL}`);
    process.exit(1);
  }

  console.log(`👤 Found User: ${user.name} (${user.id})`);

  // 2. Create 100 Devices and Assignments
  console.log('🚀 Creating 100 simulated devices...');
  
  for (let i = 1; i <= 100; i++) {
    const deviceIdStr = `GBISIM${i.toString().padStart(4, '0')}`; // GBISIM0001, etc.
    
    // Create or find device
    const device = await prisma.device.upsert({
      where: { deviceId: deviceIdStr },
      update: { isDeleted: false },
      create: {
        deviceId: deviceIdStr,
        type: 'Simulated Air Quality Monitor',
        status: 'ONLINE',
      },
    });

    // Check if already assigned
    const existingAssignment = await prisma.deviceAssignment.findFirst({
      where: {
        deviceId: device.id,
        userId: user.id,
        unassignedAt: null,
      },
    });

    if (!existingAssignment) {
      await prisma.deviceAssignment.create({
        data: {
          deviceId: device.id,
          userId: user.id,
        },
      });
      process.stdout.write('.');
    } else {
      process.stdout.write('s'); // skip
    }
  }

  console.log('\n✅ Successfully created and assigned 100 devices.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
