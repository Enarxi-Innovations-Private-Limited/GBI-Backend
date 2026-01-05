use the prisma.schema file and then run these commands after setting up the .env file with correct variables:

pnpm prisma format
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm prisma studio
