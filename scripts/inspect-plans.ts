import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.subscriptionPlan.findMany();
  console.log('Subscription Plans in Database:');
  console.log(JSON.stringify(plans, null, 2));

  const subs = await prisma.subscription.findMany({
    take: 5,
  });
  console.log('Sample Subscriptions:');
  console.log(JSON.stringify(subs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
