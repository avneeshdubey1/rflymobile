import { env } from './env.js';

export const appConfig = {
  port: env.PORT,
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  cors: {
    origins: env.CORS_ORIGINS,
    credentials: true,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '7d',
  },
  otp: {
    length: 6,
    ttlSeconds: 300, // 5 minutes
    demoCode: '123456',
  },
} as const;
