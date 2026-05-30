import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Fetching the 100 most recently read notifications...');
  
  const recentlyRead = await prisma.notification.findMany({
    where: { isRead: true },
    orderBy: { readAt: 'desc' },
    take: 100,
  });

  if (recentlyRead.length === 0) {
    console.log('ℹ️ No recently read notifications found to recover.');
    return;
  }

  console.log(`found ${recentlyRead.length} recently read notifications.`);
  console.log('🔄 Marking them back to UNREAD...');

  const ids = recentlyRead.map((n) => n.id);

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      isRead: false,
      readAt: null,
    },
  });

  console.log(`✅ Successfully recovered ${result.count} notifications back to UNREAD state!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
