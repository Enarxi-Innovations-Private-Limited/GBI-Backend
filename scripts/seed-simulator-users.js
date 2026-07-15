const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const PASSWORD_PLAIN = 'Test@123';

async function seed() {
  console.log('🚀 Seeding/Updating AWS SES Mailbox Simulator users...');

  // Hash the password with 12 rounds (matching backend settings)
  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 12);

  const SIMULATOR_USERS = [
    {
      email: 'bounce@simulator.amazonses.com',
      name: 'AWS SES Bounce Simulator',
      emailVerified: true,
      isRestricted: false,
      passwordHash,
    },
    {
      email: 'complaint@simulator.amazonses.com',
      name: 'AWS SES Complaint Simulator',
      emailVerified: true,
      isRestricted: false,
      passwordHash,
    }
  ];

  for (const userData of SIMULATOR_USERS) {
    // Clean up existing records first to ensure a clean state
    await prisma.user.deleteMany({
      where: { email: userData.email }
    });

    const user = await prisma.user.create({
      data: userData
    });

    console.log(`✅ Seeded user: ${user.email} (emailVerified: ${user.emailVerified}, isRestricted: ${user.isRestricted})`);
  }

  console.log('\n🎉 Simulator users seeded successfully with password "Test@123"!');
  await prisma.$disconnect();
}

seed().catch(async (e) => {
  console.error('❌ Seeding failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
