import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Keep the OTP store in memory since Redis is not set up
export const otpStore = new Map<string, { code: string; expiresAt: number }>();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prisma Client singleton
export const db = new PrismaClient({ adapter, log: ['error', 'warn'] });
