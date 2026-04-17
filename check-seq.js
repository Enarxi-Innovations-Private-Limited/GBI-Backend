const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const raw = await prisma.$queryRaw`SELECT last_value FROM "EventLog_id_seq"`;
    console.log('Sequence last_value:', raw);
    
    // Also max id
    const c = await prisma.eventLog.aggregate({
      _max: {
        id: true
      }
    });
    console.log('Max ID in table:', c._max.id);
  } catch(e) { console.error(e); } finally { await prisma.$disconnect(); }
}
main();
