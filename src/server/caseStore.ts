import fs from 'fs';
import path from 'path';

export interface PersistedCase {
  id: string;
  organization_id?: string;
  user_id?: string;
  user_email?: string;
  created_by?: string;
  title: string;
  description?: string;
  status: string;
  severity: string;
  threat_score: number;
  threatScore?: number;
  classification?: string;
  verdict?: string;
  threatVerdict?: string;
  from_domain?: string;
  from?: string;
  origin_ip?: string;
  origin_country?: string;
  origin_asn?: string;
  origin_asn_org?: string;
  infra_type?: string;
  created_at: string;
  assigned_user?: string;
  tags?: string[];
  source?: string;
  is_demo?: boolean;
  headers?: any;
  auth?: any;
  hops?: any[];
  heuristics?: any[];
  why?: string;
  raw_analysis?: any;
  [key: string]: any;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');

// Default initial forensic cases to seed if data/cases.json does not exist
export const DEFAULT_BASELINE_CASES: PersistedCase[] = [
  {
    id: 'CASE-2026-0881',
    organization_id: 'org_acme_soc_01',
    user_id: 'usr_analyst_lead',
    user_email: 'analyst@acmedefense.sec',
    created_by: 'usr_analyst_lead',
    title: 'Urgent: Wire Transfer Account Discrepancy',
    description: 'Deceptive executive impersonation attack targeting accounts payable. Displays spoofed CFO identity with anomalous Reply-To routed via bulletproof infrastructure.',
    status: 'OPEN',
    severity: 'CRITICAL',
    threat_score: 92,
    threatScore: 92,
    classification: 'BEC / Executive Impersonation',
    verdict: 'MALICIOUS',
    threatVerdict: 'CRITICAL THREAT',
    from_domain: 'executive-verify-auth.net',
    from: 'Chief Financial Officer <finance@executive-verify-auth.net>',
    origin_ip: '185.220.101.5',
    origin_country: 'Bulgaria',
    origin_asn: 'AS200548',
    origin_asn_org: 'Relay Transit Network Ltd',
    infra_type: 'BOTNET_INDICATOR',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    assigned_user: 'Lead SOC Analyst',
    tags: ['BEC', 'Impersonation', 'Critical Risk', 'Wire Transfer', 'DKIM Fail'],
    source: 'inbound_analysis',
    is_demo: false,
    headers: {
      subject: 'Urgent: Wire Transfer Account Discrepancy',
      from: 'Chief Financial Officer <finance@executive-verify-auth.net>',
      to: 'accounting@acmedefense.sec',
      date: new Date(Date.now() - 3600000 * 2).toUTCString(),
      messageId: '<cfo-wire-99128@executive-verify-auth.net>',
      replyTo: 'cfo-private-desk@protonmail.ch'
    },
    auth: {
      spf: { status: 'FAIL', details: 'IP 185.220.101.5 is not authorized by domain SPF record' },
      dkim: { status: 'FAIL', details: 'Cryptographic signature mismatch' },
      dmarc: { status: 'FAIL', policy: 'reject', details: 'DMARC alignment test failed' }
    },
    hops: [
      {
        hopNumber: 1,
        fromHost: 'relay-bg.bulletproof-transit.net',
        fromIp: '185.220.101.5',
        byHost: 'mx.acmedefense.sec',
        country: 'Bulgaria',
        countryCode: 'BG',
        city: 'Sofia',
        asn: 'AS200548',
        isp: 'Relay Transit Network Ltd',
        delaySec: 0,
        isOrigin: true,
        isPrivate: false,
        is_tor: false,
        infrastructureType: 'BOTNET_INDICATOR'
      }
    ],
    heuristics: [
      { id: 'H1', title: 'Display Name Spoofing Detected', severity: 'HIGH' },
      { id: 'H2', title: 'Reply-To Address Divergence', severity: 'CRITICAL' },
      { id: 'H3', title: 'Urgent Financial Coercion Keywords', severity: 'HIGH' }
    ]
  },
  {
    id: 'CASE-2026-0882',
    organization_id: 'org_acme_soc_01',
    user_id: 'usr_analyst_lead',
    user_email: 'analyst@acmedefense.sec',
    created_by: 'usr_analyst_lead',
    title: 'Microsoft 365 Password Expiration Notice',
    description: 'High-fidelity credential harvesting kit spoofing Microsoft Security Notification. Contains obfuscated HTML redirection link to external phishing reverse proxy.',
    status: 'QUARANTINED',
    severity: 'HIGH',
    threat_score: 87,
    threatScore: 87,
    classification: 'Credential Harvesting Phish',
    verdict: 'MALICIOUS',
    threatVerdict: 'HIGH RISK',
    from_domain: 'portal-login-m365.online',
    from: 'Microsoft 365 Security Team <no-reply@portal-login-m365.online>',
    origin_ip: '194.26.29.112',
    origin_country: 'Russia',
    origin_asn: 'AS44050',
    origin_asn_org: 'Serverius Holding B.V.',
    infra_type: 'DATACENTER_HOSTING',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    assigned_user: 'Lead SOC Analyst',
    tags: ['Credential Phishing', 'Microsoft 365', 'Quarantined', 'Typosquatting'],
    source: 'gmail_ingest',
    is_demo: false,
    headers: {
      subject: 'Microsoft 365 Password Expiration Notice',
      from: 'Microsoft 365 Security Team <no-reply@portal-login-m365.online>',
      to: 'security-team@acmedefense.sec',
      date: new Date(Date.now() - 3600000 * 5).toUTCString(),
      messageId: '<m365-pass-notice-8812@portal-login-m365.online>'
    },
    auth: {
      spf: { status: 'PASS', details: 'Domain authorized' },
      dkim: { status: 'NONE', details: 'No signature present' },
      dmarc: { status: 'FAIL', policy: 'quarantine', details: 'Header From domain misaligned' }
    }
  },
  {
    id: 'CASE-2026-0883',
    organization_id: 'org_acme_soc_01',
    user_id: 'usr_analyst_lead',
    user_email: 'analyst@acmedefense.sec',
    created_by: 'usr_analyst_lead',
    title: 'Overdue Vendor Invoice INV-9941 with Attached PDF',
    description: 'Inbound message containing malicious macro dropper attachment disguised as vendor payment statement. Triggered endpoint sandbox alert.',
    status: 'INVESTIGATING',
    severity: 'HIGH',
    threat_score: 84,
    threatScore: 84,
    classification: 'Malicious Payload Dropper',
    verdict: 'MALICIOUS',
    threatVerdict: 'HIGH RISK',
    from_domain: 'billing-supplies-net.com',
    from: 'Vendor Invoicing <accounting@billing-supplies-net.com>',
    origin_ip: '91.240.118.23',
    origin_country: 'Netherlands',
    origin_asn: 'AS49981',
    origin_asn_org: 'WorldStream B.V.',
    infra_type: 'DATACENTER_HOSTING',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    assigned_user: 'Lead SOC Analyst',
    tags: ['Malware', 'Weaponized Attachment', 'Invoice Fraud'],
    source: 'inbound_analysis',
    is_demo: false,
    headers: {
      subject: 'Overdue Vendor Invoice INV-9941 with Attached PDF',
      from: 'Vendor Invoicing <accounting@billing-supplies-net.com>',
      to: 'vendor-desk@acmedefense.sec',
      date: new Date(Date.now() - 3600000 * 12).toUTCString(),
      messageId: '<inv-9941-stmt@billing-supplies-net.com>'
    }
  },
  {
    id: 'CASE-2026-0884',
    organization_id: 'org_acme_soc_01',
    user_id: 'usr_analyst_lead',
    user_email: 'analyst@acmedefense.sec',
    created_by: 'usr_analyst_lead',
    title: 'IT Helpdesk: Mandatory MFA Device Re-registration',
    description: 'Adversary-in-the-Middle (AiTM) reverse proxy phishing session targeting Okta authentication tokens. Blocked by inbound gateway.',
    status: 'OPEN',
    severity: 'CRITICAL',
    threat_score: 95,
    threatScore: 95,
    classification: 'AiTM MFA Bypass Phish',
    verdict: 'MALICIOUS',
    threatVerdict: 'CRITICAL THREAT',
    from_domain: 'it-support-sso-portal.com',
    from: 'IT Support <helpdesk@it-support-sso-portal.com>',
    origin_ip: '103.145.13.88',
    origin_country: 'Singapore',
    origin_asn: 'AS133199',
    origin_asn_org: 'Host Universal SG',
    infra_type: 'VPN_PROXY',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    assigned_user: 'Lead SOC Analyst',
    tags: ['AiTM', 'MFA Phishing', 'Okta Spoof', 'Critical Risk'],
    source: 'gmail_ingest',
    is_demo: false,
    headers: {
      subject: 'IT Helpdesk: Mandatory MFA Device Re-registration',
      from: 'IT Support <helpdesk@it-support-sso-portal.com>',
      to: 'all-staff@acmedefense.sec',
      date: new Date(Date.now() - 3600000 * 18).toUTCString(),
      messageId: '<it-mfa-req-77@it-support-sso-portal.com>'
    }
  },
  {
    id: 'CASE-2026-0885',
    organization_id: 'org_acme_soc_01',
    user_id: 'usr_analyst_lead',
    user_email: 'analyst@acmedefense.sec',
    created_by: 'usr_analyst_lead',
    title: 'Weekly SOC Operations & Telemetry Briefing',
    description: 'Internal operational newsletter transmitted from verified corporate mail exchange. Cryptographic DKIM and SPF checks confirmed clean.',
    status: 'CLOSED',
    severity: 'CLEAN',
    threat_score: 5,
    threatScore: 5,
    classification: 'Legitimate Corporate Communication',
    verdict: 'CLEAN',
    threatVerdict: 'CLEAN',
    from_domain: 'acmedefense.sec',
    from: 'SOC Intel Desk <soc-intel@acmedefense.sec>',
    origin_ip: '198.51.100.25',
    origin_country: 'United States',
    origin_asn: 'AS15169',
    origin_asn_org: 'Google LLC Enterprise Relay',
    infra_type: 'PUBLIC_ROUTABLE',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    assigned_user: 'Lead SOC Analyst',
    tags: ['Internal', 'Clean', 'Verified SPF', 'Verified DKIM'],
    source: 'inbound_analysis',
    is_demo: false,
    headers: {
      subject: 'Weekly SOC Operations & Telemetry Briefing',
      from: 'SOC Intel Desk <soc-intel@acmedefense.sec>',
      to: 'soc-team@acmedefense.sec',
      date: new Date(Date.now() - 3600000 * 24).toUTCString(),
      messageId: '<soc-weekly-digest-0885@acmedefense.sec>'
    },
    auth: {
      spf: { status: 'PASS', details: 'Authorized mail exchanger' },
      dkim: { status: 'PASS', details: 'Signature verified' },
      dmarc: { status: 'PASS', policy: 'reject', details: 'DMARC alignment verified' }
    }
  }
];

// Persistent Map cache
const inMemoryStore = new Map<string, PersistedCase>();
let isInitialized = false;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[CaseStore] Error ensuring data directory exists:', err);
  }
}

export function loadCasesFromDisk(): Map<string, PersistedCase> {
  ensureDataDir();
  try {
    if (fs.existsSync(CASES_FILE)) {
      const raw = fs.readFileSync(CASES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((c: PersistedCase) => {
          if (c && c.id) {
            inMemoryStore.set(c.id, c);
          }
        });
        console.log(`[CaseStore] Loaded ${inMemoryStore.size} persistent cases from disk.`);
        return inMemoryStore;
      }
    }
  } catch (err) {
    console.warn('[CaseStore] Failed to read cases.json from disk:', err);
  }

  // Seed default baseline cases if file did not exist or was empty
  console.log('[CaseStore] Seeding initial baseline cases to disk...');
  DEFAULT_BASELINE_CASES.forEach((c) => {
    inMemoryStore.set(c.id, c);
  });
  saveCasesToDisk(inMemoryStore);
  return inMemoryStore;
}

export function saveCasesToDisk(casesMap: Map<string, PersistedCase>): boolean {
  ensureDataDir();
  try {
    const list = Array.from(casesMap.values());
    fs.writeFileSync(CASES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[CaseStore] Failed to save cases to disk:', err);
    return false;
  }
}

export function getPersistedCases(): PersistedCase[] {
  if (!isInitialized) {
    loadCasesFromDisk();
    isInitialized = true;
  }
  return Array.from(inMemoryStore.values());
}

export function upsertPersistedCase(caseItem: PersistedCase): PersistedCase {
  if (!isInitialized) {
    loadCasesFromDisk();
    isInitialized = true;
  }
  inMemoryStore.set(caseItem.id, caseItem);
  saveCasesToDisk(inMemoryStore);
  return caseItem;
}

export function deletePersistedCase(caseId: string): boolean {
  if (!isInitialized) {
    loadCasesFromDisk();
    isInitialized = true;
  }
  const existed = inMemoryStore.delete(caseId);
  if (existed) {
    saveCasesToDisk(inMemoryStore);
  }
  return existed;
}

export function getPersistedCase(caseId: string): PersistedCase | undefined {
  if (!isInitialized) {
    loadCasesFromDisk();
    isInitialized = true;
  }
  return inMemoryStore.get(caseId);
}
