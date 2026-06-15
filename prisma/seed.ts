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
      id: 'pro',
      name: 'Pro',
      amount: 4999,
      currency: 'INR',
      durationDays: 30,
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

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        amount: plan.amount,
        currency: plan.currency,
        durationDays: plan.durationDays,
        isActive: plan.isActive,
        features: plan.features ?? undefined,
        updatedAt: plan.updatedAt,
      },
      create: plan,
    });
    console.log(`✅ Synced Plan: ${plan.name} (Active: ${plan.isActive}, ₹${plan.amount})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
