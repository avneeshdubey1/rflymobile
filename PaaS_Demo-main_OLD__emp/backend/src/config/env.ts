import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

export const env = {
  PORT: Number(process.env.PORT) || 8787,
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production',
  JWT_SECRET: process.env.JWT_SECRET ?? 'daas-dev-secret-key',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
} as const;
