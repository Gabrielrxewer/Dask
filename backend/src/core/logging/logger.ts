import pino from 'pino';
import { env } from '@/core/config/env';

export const logger = pino({
  level: env.LOG_LEVEL
});
