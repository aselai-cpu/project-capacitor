import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const hasOtlpEndpoint = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

function buildTransport() {
  const targets: pino.TransportTargetOptions[] = [];

  if (hasOtlpEndpoint) {
    // Ship logs to OTel Collector via OTLP (→ Loki)
    targets.push({
      target: 'pino-opentelemetry-transport',
      options: {
        resourceAttributes: {
          'service.name': process.env.OTEL_SERVICE_NAME || 'capacitor-backend',
        },
      },
      level: 'info',
    });
  }

  if (isDev && !hasOtlpEndpoint) {
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
