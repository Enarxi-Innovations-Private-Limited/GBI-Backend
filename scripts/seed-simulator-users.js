const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SIMULATOR_USERS = [
  {
    email: 'bounce@simulator.amazonses.com',
    name: 'AWS SES Bounce Simulator',
    emailVerified: true,
    isRestricted: false,
  },
  {
    email: 'complaint@simulator.amazonses.com',
    name: 'AWS SES Complaint Simulator',
    emailVerified: true,
    isRestricted: false,
  }
];

async function seed() {
  console.log('🚀 Seeding AWS SES Mailbox Simulator users into database...');

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

  console.log('\n🎉 Simulator users seeded successfully!');
  console.log('\nHow to test in production/staging:');
  console.log('1. Trigger an email send to: bounce@simulator.amazonses.com');
  console.log('   -> Verifies that the webhook un-verifies the user and suppresses the email in Redis.');
  console.log('2. Trigger an email send to: complaint@simulator.amazonses.com');
  console.log('   -> Verifies that spam complaints also un-verify the user and suppress the email.');

  await prisma.$disconnect();
}

seed().catch(async (e) => {
  console.error('❌ Seeding failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
