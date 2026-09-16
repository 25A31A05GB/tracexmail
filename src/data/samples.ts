import { EmailAnalysis } from '../types';

export const EMPTY_ANALYSIS: EmailAnalysis = {
  id: 'TXM-PENDING-ANALYSIS',
  sessionId: 'SES-STANDBY',
  name: 'No Active Analysis Selected',
  subject: 'No Email Analyzed',
  from: 'analyst@enclave.local',
  to: 'soc-triage@enclave.local',
  date: new Date().toUTCString(),
  analyzedAt: new Date().toISOString(),
  messageId: '<standby-0000@enclave.local>',
  threatVerdict: 'Awaiting Ingestion',
  threatScore: 0,
  riskScore: 0,
  verdict: 'LEGITIMATE',
  mlConfidence: 0,
  rawEml: '',
  summary: 'No active email analysis artifact is currently loaded. Ingest an RFC 822 EML message, paste headers, or connect your Gmail inbox to initiate full-depth automated triage.',
  headers: {
    subject: 'No Email Analyzed',
    from: 'analyst@enclave.local',
    fromEmail: 'analyst@enclave.local',
    fromName: 'SOC Enclave Standby',
    to: 'soc-triage@enclave.local',
    date: new Date().toUTCString(),
    messageId: '<standby-0000@enclave.local>',
    allHeaders: {}
  },
  auth: {
    spf: { status: 'NONE', details: 'No active email loaded' },
    dkim: { status: 'NONE', details: 'No active email loaded' },
    dmarc: { status: 'NONE', details: 'No active email loaded' }
  },
  hops: [],
  urls: [],
  attachments: [],
  heuristics: [],
  logs: [
    {
      id: 'log-init-0',
      timestamp: new Date().toLocaleTimeString(),
      tag: 'INIT',
      message: 'Forensic engine initialized and standing by for inbound email ingestion.'
    }
  ]
};

export const SAMPLE_ANALYSES: EmailAnalysis[] = [];
