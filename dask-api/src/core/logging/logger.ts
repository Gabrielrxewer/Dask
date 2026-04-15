import crypto from 'crypto';
import pino, { type Logger, type LoggerOptions } from 'pino';
import { env } from '@/core/config/env';

const LOGGER_NAME = 'dask-api';
const PRETTY_DATE_FORMAT = 'yyyy-mm-dd HH:MM:ss.l';

function shouldUsePrettyLogs(): boolean {
  if (env.LOG_PRETTY === 'always') {
    return true;
  }
  if (env.LOG_PRETTY === 'never') {
    return false;
  }
  return env.NODE_ENV !== 'production' && process.stdout.isTTY;
}

const baseLoggerOptions: LoggerOptions = {
  name: LOGGER_NAME,
  level: env.LOG_LEVEL,
  base: {
    env: env.NODE_ENV,
    service: LOGGER_NAME
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  serializers: {
    err: pino.stdSerializers.err
  }
};

const transport = shouldUsePrettyLogs()
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: PRETTY_DATE_FORMAT,
        singleLine: false,
        levelFirst: true,
        ignore: 'pid,hostname',
        messageFormat: '{msg}'
      }
    })
  : undefined;

export const logger = pino(baseLoggerOptions, transport);

const scopedLoggers = new Map<string, Logger>();

export function getLogger(scope: string): Logger {
  const normalizedScope = scope.trim().toLowerCase();
  if (!normalizedScope) {
    return logger;
  }

  const cached = scopedLoggers.get(normalizedScope);
  if (cached) {
    return cached;
  }

  const scoped = logger.child({ scope: normalizedScope });
  scopedLoggers.set(normalizedScope, scoped);
  return scoped;
}

const enabledDebugChannels = new Set(env.LOG_DEBUG_CHANNELS);

function isDebugChannelEnabled(channel: string): boolean {
  if (enabledDebugChannels.has('*')) {
    return true;
  }

  const normalizedChannel = channel.trim().toLowerCase();
  if (!normalizedChannel) {
    return false;
  }

  if (enabledDebugChannels.has(normalizedChannel)) {
    return true;
  }

  const [namespace] = normalizedChannel.split('.');
  return Boolean(namespace && enabledDebugChannels.has(namespace));
}

export type DebugLogger = {
  enabled(): boolean;
  log(payload: Record<string, unknown>, message: string): void;
};

export function createDebugLogger(channel: string, bindings?: Record<string, unknown>): DebugLogger {
  const normalizedChannel = channel.trim().toLowerCase();
  const channelLogger = getLogger('debug').child({ debugChannel: normalizedChannel, ...bindings });
  const isEnabled = () =>
    channelLogger.isLevelEnabled('debug') && isDebugChannelEnabled(normalizedChannel);

  return {
    enabled() {
      return isEnabled();
    },
    log(payload, message) {
      if (!isEnabled()) {
        return;
      }
      channelLogger.debug(payload, message);
    }
  };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
