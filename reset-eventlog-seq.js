const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$executeRawUnsafe(`
      SELECT setval(
        '"EventLog_id_seq"',
        COALESCE((SELECT MAX(id) + 1 FROM "EventLog"), 1),
        false
      );
    `);
    console.log('Sequence reset successfully.', result);
  } catch (error) {
    console.error('Error resetting sequence:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
