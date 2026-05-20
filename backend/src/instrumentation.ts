import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-node';

const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
  : new ConsoleSpanExporter();

// Optional Langfuse span processor — only active when keys are configured
const spanProcessors: SpanProcessor[] = [];
if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
  const { LangfuseExporter } = await import('langfuse-vercel');
  spanProcessors.push(
    new BatchSpanProcessor(
      new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        ...(process.env.LANGFUSE_BASEURL && { baseUrl: process.env.LANGFUSE_BASEURL }),
      }),
    ),
  );
}

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'capacitor-backend',
  traceExporter,
  ...(spanProcessors.length > 0 && { spanProcessors }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
