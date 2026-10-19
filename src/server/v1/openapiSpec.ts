export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'TraceXMail Enterprise Forensics API',
    version: '1.0.0',
    description: `TraceXMail public REST API v1 for automated email forensics, quishing defense, quarantine orchestration, and SIEM integration.

### Authentication
Authenticate with your organization's API key:
- Header: \`X-API-Key: txm_live_...\`
- Or: \`Authorization: Bearer txm_live_...\`

### Scopes
API keys are scoped with least privilege:
- \`analyze:write\` — Submit emails for forensic analysis
- \`cases:read\` — Query forensic case dossiers and verdicts
- \`quarantine:manage\` — Hold or release emails from quarantine
- \`webhooks:manage\` — Register and replay outbound webhooks

### Error Format (RFC 9457)
All error responses use the standard \`application/problem+json\` media type:
\`\`\`json
{
  "type": "https://tracexmail.com/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid or expired API key provided.",
  "instance": "/api/v1/analyze"
}
\`\`\`

### Idempotency
Pass \`Idempotency-Key: <unique-uuid>\` on mutating POST requests to prevent duplicate processing on network retries.`,
    contact: {
      name: 'TraceXMail Security Engineering',
      url: 'https://tracexmail.com',
      email: 'security@tracexmail.sec'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current Environment API Gateway'
    }
  ],
  paths: {
    '/analyze': {
      post: {
        summary: 'Submit Raw Email for Forensic Deconstruction',
        description: 'Analyzes RFC822 (.eml) email content. Returns forensic breakdown, cryptographic verification (SPF/DKIM/DMARC), relay hops, URL safety, attachment magic bytes, and composite threat score.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            schema: { type: 'string' },
            description: 'Unique UUID to prevent duplicate email analysis'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['raw_email'],
                properties: {
                  raw_email: { type: 'string', description: 'Raw RFC822 email text string or Base64 encoded payload' },
                  file_name: { type: 'string', description: 'Original filename (e.g. invoice.eml)', default: 'email.eml' },
                  is_base64: { type: 'boolean', description: 'Set to true if raw_email is Base64 encoded', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Synchronous forensic analysis result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AnalysisResponse' }
              }
            }
          },
          '202': {
            description: 'Analysis accepted and offloaded to asynchronous background queue',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/QueuedJobResponse' }
              }
            }
          },
          '400': { description: 'Malformed request payload', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          '401': { description: 'Missing or invalid API key', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          '402': { description: 'Monthly quota exhausted', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } }
        }
      }
    },
    '/cases': {
      get: {
        summary: 'List Forensic Cases',
        description: 'Query organization cases with cursor-based pagination and filtering.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Opaque pagination cursor' },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'QUARANTINED', 'RESOLVED', 'CLOSED'] } }
        ],
        responses: {
          '200': {
            description: 'Paginated cases list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/CaseSummary' } },
                    nextCursor: { type: 'string', nullable: true },
                    hasMore: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/cases/{id}': {
      get: {
        summary: 'Get Case Forensic Dossier',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Complete case dossier', content: { 'application/json': { schema: { $ref: '#/components/schemas/CaseDossier' } } } },
          '404': { description: 'Case not found', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } }
        }
      }
    },
    '/cases/{id}/quarantine': {
      post: {
        summary: 'Hold Email in Quarantine',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Quarantine state updated successfully' },
          '404': { description: 'Case not found' }
        }
      }
    },
    '/cases/{id}/release': {
      post: {
        summary: 'Release Email from Quarantine',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Email released back to recipient inbox' },
          '404': { description: 'Case not found' }
        }
      }
    },
    '/webhooks': {
      get: {
        summary: 'List Registered Outbound Webhooks',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'List of outbound webhooks' } }
      },
      post: {
        summary: 'Register Outbound Webhook',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri', example: 'https://api.yourcorp.com/security/webhooks' },
                  events: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['case.created', 'verdict.high_risk', 'quarantine.held', 'quarantine.released', 'campaign.detected']
                    }
                  },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Webhook registered' } }
      }
    }
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Organization Scoped API Key'
      }
    },
    schemas: {
      ProblemDetails: {
        type: 'object',
        properties: {
          type: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          instance: { type: 'string' }
        }
      },
      AnalysisResponse: {
        type: 'object',
        properties: {
          threatScore: { type: 'integer', minimum: 0, maximum: 100 },
          threatVerdict: { type: 'string', enum: ['CLEAN', 'SUSPICIOUS', 'MALICIOUS'] },
          classification: { type: 'string' },
          detectedLanguage: { type: 'string', example: 'en' },
          auth: {
            type: 'object',
            properties: {
              spf: { type: 'object' },
              dkim: { type: 'object' },
              dmarc: { type: 'object' }
            }
          },
          urlAnalysis: { type: 'object' },
          attachmentAnalysis: { type: 'object' }
        }
      },
      QueuedJobResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'queued' },
          jobId: { type: 'string' },
          pollUrl: { type: 'string' }
        }
      },
      CaseSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string' },
          threatScore: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      CaseDossier: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          threatScore: { type: 'integer' },
          status: { type: 'string' },
          why: { type: 'object' }
        }
      }
    }
  }
};
