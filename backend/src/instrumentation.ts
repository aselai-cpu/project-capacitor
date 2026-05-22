import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { BatchLogRecordProcessor, ConsoleLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-node';

const hasOtlpEndpoint = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// --- Trace exporters ---
const traceExporter = hasOtlpEndpoint
  ? new OTLPTraceExporter()
  : new ConsoleSpanExporter();

// --- Log exporters ---
const logRecordProcessor = hasOtlpEndpoint
  ? new BatchLogRecordProcessor(new OTLPLogExporter())
  : new SimpleLogRecordProcessor(new ConsoleLogRecordExporter());

// --- Span processors: always include trace exporter, optionally add Langfuse ---
const spanProcessors: SpanProcessor[] = [
  new BatchSpanProcessor(traceExporter),
];

if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
  const { LangfuseExporter } = await import('langfuse-vercel');
  spanProcessors.push(
    new BatchSpanProcessor(
      new LangfuseExporter({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        ...(process.env.LANGFUSE_BASEURL && { baseUrl: process.env.LANGFUSE_BASEURL }),
        debug: false,
      }),
    ),
  );
}

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'capacitor-backend',
  logRecordProcessor,
  spanProcessors,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Auto-instrument Pino to bridge logs to OTel
      '@opentelemetry/instrumentation-pino': { enabled: true },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
