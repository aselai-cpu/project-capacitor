import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
// Logs go directly to Loki OTLP endpoint (separate from trace collector)
const lokiEndpoint = process.env.LOKI_OTLP_ENDPOINT;
const hasLogEndpoint = !!lokiEndpoint;

function buildTransport() {
  const targets: pino.TransportTargetOptions[] = [];

  if (hasLogEndpoint) {
    // Ship logs directly to Loki's native OTLP endpoint
    targets.push({
      target: 'pino-opentelemetry-transport',
      options: {
        loggerName: 'capacitor-backend',
        resourceAttributes: {
          'service.name': process.env.OTEL_SERVICE_NAME || 'capacitor-backend',
        },
        // Override the default OTLP endpoint to point to Loki directly
        logRecordExporterOptions: {
          url: lokiEndpoint,
        },
      },
      level: 'info',
    });
  }

  if (isDev && !hasLogEndpoint) {
    // Dev: pretty console output
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'info',
    });
  } else {
    // Docker: also print to stdout so docker logs works
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
