import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { logger } from '../logger';

const TRACER_NAME = 'tracexmail-core';
const tracer = trace.getTracer(TRACER_NAME);

export function getTracer() {
  return tracer;
}

/**
 * Executes an async function within an active OpenTelemetry span.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {}
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err: any) {
      span.recordException(err);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err?.message || 'Operation failed'
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Tracing helper for external provider calls (Gemini, Groq, VirusTotal, AbuseIPDB, Gmail).
 */
export async function traceExternalCall<T>(
  provider: 'gemini' | 'groq' | 'virustotal' | 'abuseipdb' | 'gmail' | 'otx' | 'rdap' | 'dns',
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`external.${provider}.${operation}`, async (span) => {
    span.setAttribute('peer.service', provider);
    span.setAttribute('external.operation', operation);
    return fn();
  });
}
