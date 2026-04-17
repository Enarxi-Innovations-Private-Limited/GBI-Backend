const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      amount: 499,
      currency: 'INR',
      durationDays: 30,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: 'professional',
      name: 'Professional',
      amount: 4999,
      currency: 'INR',
      durationDays: 365,
      isActive: true,
      updatedAt: new Date(),
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      amount: 9999,
      currency: 'INR',
      durationDays: 10000, // Effectively lifetime
      isActive: true,
      updatedAt: new Date(),
    },
  ];

  console.log('Seeding subscription plans...');

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
    console.log(`- Upserted ${plan.name} plan`);
  }

  console.log('Finished seeding plans.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
