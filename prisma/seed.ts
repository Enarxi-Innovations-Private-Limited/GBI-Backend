import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ─── Admins ───────────────────────────────────────────────────────────────
  const admins = [
    { email: 'roop@gbiair.in', password: 'Roop@123' },
    { email: 'Master@gbiair.in', password: 'Master@123' },
    { email: 'Sanjana@gbiair.in', password: 'Sanjana@123' },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: { passwordHash },
      create: { email: admin.email, passwordHash },
    });
    console.log(`✅ Synced Admin: ${admin.email}`);
  }

  // ─── Subscription Plans ───────────────────────────────────────────────────
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
      durationDays: 36500, // ~100 years → effectively lifetime
      isActive: true,
      updatedAt: new Date(),
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        amount: plan.amount,
        currency: plan.currency,
        durationDays: plan.durationDays,
        isActive: plan.isActive,
        updatedAt: plan.updatedAt,
      },
      create: plan,
    });
    console.log(`✅ Synced Plan: ${plan.name} (₹${plan.amount})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
