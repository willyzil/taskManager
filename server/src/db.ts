import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connect() {
  try {
    await prisma.$connect();
    console.log('Connected to database');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
}