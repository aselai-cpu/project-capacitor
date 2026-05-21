import pino from 'pino';

// Pino logs go to stdout. In Docker, the OTel instrumentation-pino
// bridge automatically exports them as OTel log records via OTLP
// to the collector, which routes them to Loki.
// No direct pino-loki transport needed.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
