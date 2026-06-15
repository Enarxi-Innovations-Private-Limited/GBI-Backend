const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      id: 'pro',
      name: 'Pro',
      amount: 4999,
      currency: 'INR',
      durationDays: 365,
      isActive: true,
      features: [
        { id: 1, name: "PDF & CSV Reports Download", included: true },
        { id: 2, name: "Custom Threshold Limits", included: true },
        { id: 3, name: "Detailed Event Logs & History", included: true },
        { id: 4, name: "Advanced Analytics & Comparison", included: true }
      ],
      updatedAt: new Date(),
    },
    {
      id: 'starter',
      name: 'Starter',
      amount: 499,
      currency: 'INR',
      durationDays: 30,
      isActive: false,
      features: null,
      updatedAt: new Date(),
    },
    {
      id: 'professional',
      name: 'Professional',
      amount: 4999,
      currency: 'INR',
      durationDays: 365,
      isActive: false,
      features: null,
      updatedAt: new Date(),
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      amount: 9999,
      currency: 'INR',
      durationDays: 36500,
      isActive: false,
      features: null,
      updatedAt: new Date(),
    },
  ];

  console.log('Seeding subscription plans...');

  // Deactivate all plans that are not 'pro'
  await prisma.subscriptionPlan.updateMany({
    where: {
      id: { not: 'pro' }
    },
    data: {
      isActive: false
    }
  });

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        amount: plan.amount,
        currency: plan.currency,
        durationDays: plan.durationDays,
        isActive: plan.isActive,
        features: plan.features ?? null,
        updatedAt: plan.updatedAt,
      },
      create: plan,
    });
    console.log(`- Upserted ${plan.name} plan (Active: ${plan.isActive})`);
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
