import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding subscription plans...');

  const plans = [
    {
      name: 'Premium Monthly',
      amount: 999,
      currency: 'INR',
      durationDays: 30,
      isActive: true,
    },
    {
      name: 'Premium Yearly',
      amount: 9999,
      currency: 'INR',
      durationDays: 365,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: { amount: plan.amount, durationDays: plan.durationDays },
      create: plan,
    });
    console.log(`  ✅ ${plan.name}: ₹${plan.amount} / ${plan.durationDays} days`);
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
