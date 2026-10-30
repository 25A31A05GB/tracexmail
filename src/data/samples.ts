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

export const MOCK_INCIDENT_ANALYSIS: EmailAnalysis = {
  id: 'TXM-2026-9812',
  sessionId: 'SES-SOC-9812',
  trackingId: 'TRK-ALPHA-491',
  evidenceId: 'EVID-RFC822-9812-SHA256',
  analysisSource: 'server_verified',
  name: 'Executive Wire Transfer Fraud (CEO Impersonation)',
  subject: 'URGENT: Reauthorization of $485,000 Acquisition Escrow Wire',
  from: 'ceo.office@exec-globalpartners.com',
  to: 'cfo.desk@acme-corp.com',
  replyTo: 'wire.desk.confirm@fin-wiretransfer-gateway.net',
  returnPath: 'bounce-gateway@shadow-bulletproof.ch',
  date: new Date(Date.now() - 3600000 * 2).toUTCString(),
  analyzedAt: new Date(Date.now() - 1800000).toISOString(),
  messageId: '<20261030.escrow.9812@exec-globalpartners.com>',
  threatVerdict: 'CRITICAL',
  verdict: 'MALICIOUS',
  threatScore: 94,
  riskScore: 96,
  mlConfidence: 0.982,
  classification: 'Business Email Compromise (BEC) / Spear Phishing',
  phishingProbability: 0.985,
  rawEml: `Received: from mail-edge01.anonymous-relays.is (185.220.101.42) by relay-inbound.frankfurt-transit.net; Fri, 30 Oct 2026 12:00:00 +0000
Received: from relay-inbound.frankfurt-transit.net (194.146.107.12) by mx-primary.acme-corp.com; Fri, 30 Oct 2026 12:00:02 +0000
From: Arthur Vance (CEO) <ceo.office@exec-globalpartners.com>
To: cfo.desk@acme-corp.com
Reply-To: wire.desk.confirm@fin-wiretransfer-gateway.net
Subject: URGENT: Reauthorization of $485,000 Acquisition Escrow Wire
Date: Fri, 30 Oct 2026 12:00:00 +0000
Message-ID: <20261030.escrow.9812@exec-globalpartners.com>
Content-Type: text/plain; charset=UTF-8

Please reauthorize the wire transfer immediately to ensure closing escrow is not forfeited.`,
  sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  summary: 'High-severity Business Email Compromise (BEC) attempt impersonating C-Suite executive. SPF hard-fail with unauthorized sending IP (185.220.101.42). Reply-to header redirects to newly registered lookalike domain with high-risk financial coercion lures.',
  headers: {
    subject: 'URGENT: Reauthorization of $485,000 Acquisition Escrow Wire',
    from: 'ceo.office@exec-globalpartners.com',
    fromEmail: 'ceo.office@exec-globalpartners.com',
    fromName: 'Arthur Vance (CEO)',
    to: 'cfo.desk@acme-corp.com',
    replyTo: 'wire.desk.confirm@fin-wiretransfer-gateway.net',
    date: new Date(Date.now() - 3600000 * 2).toUTCString(),
    messageId: '<20261030.escrow.9812@exec-globalpartners.com>',
    allHeaders: {
      'from': 'Arthur Vance (CEO) <ceo.office@exec-globalpartners.com>',
      'to': 'cfo.desk@acme-corp.com',
      'reply-to': 'wire.desk.confirm@fin-wiretransfer-gateway.net',
      'subject': 'URGENT: Reauthorization of $485,000 Acquisition Escrow Wire',
      'date': new Date(Date.now() - 3600000 * 2).toUTCString(),
      'message-id': '<20261030.escrow.9812@exec-globalpartners.com>',
      'x-mailer': 'PHPMailer 6.1.4 (custom-patched)',
      'x-originating-ip': '[185.220.101.42]',
      'x-priority': '1 (Highest)',
      'x-ms-exchange-antispam-srfa-diagnostics': 'SOS;SOX'
    }
  },
  auth: {
    spf: { status: 'FAIL', details: 'IP 185.220.101.42 is not authorized under exec-globalpartners.com SPF policy (-all)' },
    dkim: { status: 'FAIL', details: 'DKIM signature missing or stripped during transit relay' },
    dmarc: { status: 'FAIL', details: 'SPF alignment failed. From header domain does not match mail envelope' }
  },
  hops: [
    {
      hopNumber: 1,
      fromHost: 'mail-edge01.anonymous-relays.is',
      fromIp: '185.220.101.42',
      byHost: 'relay-inbound.frankfurt-transit.net',
      protocol: 'ESMTPS',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      delaySec: 2,
      city: 'Reykjavik',
      country: 'Iceland',
      countryCode: 'IS',
      lat: 64.1466,
      lng: -21.9426,
      asn: 'AS39351',
      org: 'Bulletproof Enclave Infrastructure Ltd',
      isOrigin: true,
      hopRole: 'EXTERNAL_ORIGIN',
      isProxyOrVpn: true,
      abuseScore: 92
    },
    {
      hopNumber: 2,
      fromHost: 'relay-inbound.frankfurt-transit.net',
      fromIp: '194.146.107.12',
      byHost: 'mx-primary.acme-corp.com',
      protocol: 'ESMTPS',
      timestamp: new Date(Date.now() - 7198000).toISOString(),
      delaySec: 3,
      city: 'Frankfurt',
      country: 'Germany',
      countryCode: 'DE',
      lat: 50.1109,
      lng: 8.6821,
      asn: 'AS3320',
      org: 'Deutsche Telekom Transit',
      hopRole: 'TRANSIT_RELAY',
      abuseScore: 4
    },
    {
      hopNumber: 3,
      fromHost: 'mx-primary.acme-corp.com',
      fromIp: '198.51.100.25',
      byHost: 'mail-store04.internal.acme-corp.com',
      protocol: 'ESMTPS',
      timestamp: new Date(Date.now() - 7195000).toISOString(),
      delaySec: 1,
      city: 'New York',
      country: 'United States',
      countryCode: 'US',
      lat: 40.7128,
      lng: -74.0060,
      asn: 'AS15169',
      org: 'Acme SOC Enterprise Gateway',
      hopRole: 'INGRESS_GATEWAY',
      abuseScore: 0
    }
  ],
  urls: [
    {
      url: 'https://fin-wiretransfer-gateway.net/auth/portal?case=TXM-9812',
      defangedUrl: 'hxxps://fin-wiretransfer-gateway[.]net/auth/portal?case=TXM-9812',
      domain: 'fin-wiretransfer-gateway.net',
      status: 'MALICIOUS',
      category: 'Credential Harvesting / Financial Fraud',
      virustotalScore: '89/94 malicious'
    }
  ],
  attachments: [
    {
      filename: 'Escrow_Wire_Routing_Instructions_Confidential.pdf.exe',
      size: '412 KB',
      mimeType: 'application/x-msdownload',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      md5: '7d891b0f00a089f86d081884c7d659a2',
      status: 'MALICIOUS',
      vtDetection: '64/72 engines'
    }
  ],
  heuristics: [
    {
      id: 'HEUR-SPF-FAIL',
      title: 'SPF Hard-Fail on High-Value Domain',
      severity: 'CRITICAL',
      score: 35,
      triggered: true,
      description: 'The originating IP address 185.220.101.42 fails the published sender policy framework configuration.'
    },
    {
      id: 'HEUR-REPLY-MISMATCH',
      title: 'Reply-To Header Domain Mismatch',
      severity: 'HIGH',
      score: 30,
      triggered: true,
      description: 'The Reply-To address redirects replies away from exec-globalpartners.com to newly registered fin-wiretransfer-gateway.net.'
    },
    {
      id: 'HEUR-URGENCY-LURE',
      title: 'Financial Coercion & Artificial Urgency Lures',
      severity: 'HIGH',
      score: 25,
      triggered: true,
      description: 'Subject and body invoke urgent capital expenditure, tight deadlines, and confidential wire routing instructions.'
    }
  ],
  logs: [
    {
      id: 'log-01',
      timestamp: new Date(Date.now() - 7200000).toLocaleTimeString(),
      tag: 'INGRESS',
      message: 'Inbound connection accepted from 185.220.101.42 (Reykjavik, IS) via TLS 1.3'
    },
    {
      id: 'log-02',
      timestamp: new Date(Date.now() - 7199000).toLocaleTimeString(),
      tag: 'AUTH_VERIFY',
      message: 'SPF verification completed: FAIL (result: -all, ip: 185.220.101.42)'
    },
    {
      id: 'log-03',
      timestamp: new Date(Date.now() - 7198000).toLocaleTimeString(),
      tag: 'TRIAGE',
      message: 'ML Classifier triggered: High probability phishing detected (p=0.985). Calibrated risk score: 94/100'
    },
    {
      id: 'log-04',
      timestamp: new Date(Date.now() - 7197000).toLocaleTimeString(),
      tag: 'QUARANTINE',
      message: 'Automated policy rule triggered: Message isolated to SOC Enclave forensic sandbox.'
    }
  ]
};

export const SAMPLE_ANALYSES: EmailAnalysis[] = [MOCK_INCIDENT_ANALYSIS];
