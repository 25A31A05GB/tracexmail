import * as Sentry from '@sentry/node';
import { logger } from './logger';

export function initBackendSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not provided; backend error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '2.5.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event, hint) {
      // PII Scrubbing: Ensure email bodies, headers, and tokens never reach Sentry
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
        if (event.request.data) {
          if (typeof event.request.data === 'string') {
            event.request.data = '[PII_BODY_SCRUBBED]';
          } else if (typeof event.request.data === 'object') {
            const sanitized = { ...event.request.data };
            delete sanitized.raw_email;
            delete sanitized.raw_content;
            delete sanitized.rawEml;
            delete sanitized.email;
            delete sanitized.password;
            delete sanitized.token;
            delete sanitized.secret;
            event.request.data = sanitized;
          }
        }
      }

      // Scrub breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs.forEach(bc => {
          if (bc.category === 'http' || bc.category === 'xhr') {
            if (bc.data?.url?.includes('token') || bc.data?.url?.includes('secret')) {
              bc.data.url = '[REDACTED_URL]';
            }
          }
        });
      }

      return event;
    }
  });

  logger.info('Backend Sentry initialized with PII scrubbing and release tracking');
}

/**
 * Attaches user and organization context tags to current Sentry scope.
 */
export function setSentryUserContext(user?: { id?: string; email?: string; organizationId?: string }) {
  if (!user) return;
  Sentry.setUser({
    id: user.id,
    // Do NOT include user.email to prevent PII leakage
  });
  if (user.organizationId) {
    Sentry.setTag('organization_id', user.organizationId);
  }
}
