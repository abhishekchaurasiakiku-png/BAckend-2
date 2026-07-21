import { PrismaClient } from '@prisma/client';
import env from './env.js';

const prisma = new PrismaClient({
  log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
