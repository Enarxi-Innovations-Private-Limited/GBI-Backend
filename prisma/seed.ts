import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const admins = [
    { email: 'roop@gbiair.in', password: 'Roop@123' },
    { email: 'Master@gbiair.in', password: 'Master@123' },
    { email: 'Sanjana@gbiair.in', password: 'Sanjana@123' },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password, 12);
    
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: { passwordHash }, // This forces the password to be reset
      create: { email: admin.email, passwordHash },
    });
    console.log(`✅ Synced Admin: ${admin.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

