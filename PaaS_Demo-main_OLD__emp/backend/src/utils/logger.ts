import winston from 'winston';
import { appConfig } from '../config/app.config.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp: ts, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}]: ${message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: appConfig.isDev ? 'debug' : 'info',
  format: appConfig.isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
  silent: false,
});
