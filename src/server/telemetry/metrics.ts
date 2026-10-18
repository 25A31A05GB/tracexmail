import promClient from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry
export const register = new promClient.Registry();

// Enable collection of default process/system metrics
promClient.collectDefaultMetrics({ register, prefix: 'tracexmail_' });

// 1. HTTP Request Metrics
export const httpRequestsTotal = new promClient.Counter({
  name: 'tracexmail_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register]
});

export const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'tracexmail_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// 2. Email Forensic Analysis Duration
export const analysisDurationSeconds = new promClient.Histogram({
  name: 'tracexmail_analysis_duration_seconds',
  help: 'Duration of email forensic analysis pipeline execution in seconds',
  labelNames: ['status'] as const,
  buckets: [0.1, 0.5, 1, 2, 3, 5, 10, 15, 30],
  registers: [register]
});

// 3. Queue Depth & Failures
export const queueDepth = new promClient.Gauge({
  name: 'tracexmail_queue_depth',
  help: 'Number of pending jobs currently waiting in background queues',
  labelNames: ['queue'] as const,
  registers: [register]
});

export const queueFailuresTotal = new promClient.Counter({
  name: 'tracexmail_queue_failures_total',
  help: 'Total number of background queue job failures',
  labelNames: ['queue'] as const,
  registers: [register]
});

// 4. External API Error Rates & Latency
export const externalApiRequestsTotal = new promClient.Counter({
  name: 'tracexmail_external_api_requests_total',
  help: 'Total external API calls to threat intel, AI models, and email providers',
  labelNames: ['provider', 'status'] as const,
  registers: [register]
});

export const externalApiDurationSeconds = new promClient.Histogram({
  name: 'tracexmail_external_api_duration_seconds',
  help: 'Latency of external API calls in seconds',
  labelNames: ['provider'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// 5. Classifier Verdict Distribution
export const classifierVerdictsTotal = new promClient.Counter({
  name: 'tracexmail_classifier_verdicts_total',
  help: 'Count of email classifications categorized by final verdict',
  labelNames: ['verdict'] as const, // 'benign', 'suspicious', 'malicious', 'bec', 'phishing'
  registers: [register]
});

// 6. Quarantine Actions
export const quarantineActionsTotal = new promClient.Counter({
  name: 'tracexmail_quarantine_actions_total',
  help: 'Total number of emails quarantined, released, or permanently deleted',
  labelNames: ['action'] as const, // 'quarantine', 'release', 'delete'
  registers: [register]
});

// 7. WebSocket Active Connections
export const activeWebSocketConnections = new promClient.Gauge({
  name: 'tracexmail_websocket_connections_active',
  help: 'Number of active authenticated WebSocket connections',
  registers: [register]
});

/**
 * Express middleware to track HTTP request count and latency
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method: req.method, route, status_code: statusCode }, durationSeconds);
  });

  next();
}

/**
 * Endpoint handler for GET /metrics
 */
export async function getMetricsHandler(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  const metricsToken = process.env.PROMETHEUS_METRICS_TOKEN || process.env.INTERNAL_METRICS_TOKEN;

  // Protect metrics in production if a token is configured
  if (process.env.NODE_ENV === 'production' && metricsToken) {
    if (authHeader !== `Bearer ${metricsToken}`) {
      res.status(401).send('Unauthorized metrics access');
      return;
    }
  }

  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
