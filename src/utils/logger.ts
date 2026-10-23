import winston from 'winston';
import { config } from '@/config/config';

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${rest}`;
  }),
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console({ silent: config.isTest })],
});
