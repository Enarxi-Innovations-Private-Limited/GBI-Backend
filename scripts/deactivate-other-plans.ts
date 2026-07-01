import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Deactivate starter and enterprise plans
  await prisma.subscriptionPlan.updateMany({
    where: {
      id: { in: ['starter', 'enterprise'] }
    },
    data: {
      isActive: false
    }
  });
  console.log('Successfully deactivated starter and enterprise plans.');

  const activePlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true }
  });
  console.log('Active plans in DB:', activePlans);
}

main().catch(console.error).finally(() => prisma.$disconnect());
