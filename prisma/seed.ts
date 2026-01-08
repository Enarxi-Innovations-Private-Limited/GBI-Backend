import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gbi.com';
  const password = 'Admin@123';

  const exists = await prisma.admin.findUnique({
    where: { email },
  });

  if (exists) {
    console.log('Admin already exists');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.create({
    data: {
      email,
      passwordHash,
    },
  });

  console.log('Admin seeded successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
