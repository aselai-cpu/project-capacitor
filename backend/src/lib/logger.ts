import pino from 'pino';

const lokiHost = process.env.LOKI_HOST || 'http://localhost:3100';
const useLoki = !!process.env.LOKI_HOST;
const isDev = process.env.NODE_ENV !== 'production';

function buildTransport() {
  const targets: pino.TransportTargetOptions[] = [];

  // Pretty console output in dev
  if (isDev && !useLoki) {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'info',
    });
  }

  // Ship logs to Loki when LOKI_HOST is set (e.g., in Docker)
  if (useLoki) {
    targets.push({
      target: 'pino-loki',
      options: {
        host: lokiHost,
        batching: true,
        interval: 2,
        labels: { app: 'capacitor-backend' },
      },
      level: 'info',
    });

    // Also print to stdout in Docker so docker logs still works
    targets.push({
      target: 'pino/file',
      options: {},
      level: 'info',
    });
  }

  if (targets.length === 0) return undefined;
  return pino.transport({ targets });
}

export const logger = pino(
  { level: process.env.LOG_LEVEL || 'info' },
  buildTransport() as any,
);
