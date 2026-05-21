import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const lokiHost = process.env.LOKI_HOST;

function buildTransport() {
  const targets: pino.TransportTargetOptions[] = [];

  if (lokiHost) {
    // Ship logs to Loki via pino-loki (push API)
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
  }

  if (isDev && !lokiHost) {
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'info',
    });
  } else {
    targets.push({
      target: 'pino/file',
      options: {},
      level: 'info',
    });
  }

  return pino.transport({ targets });
}

export const logger = pino(
  { level: process.env.LOG_LEVEL || 'info' },
  buildTransport(),
);
