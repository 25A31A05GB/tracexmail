/**
 * Dynamic SEO, Page Title, Meta Description, and OpenGraph Synchronizer
 */

export interface PageMetadata {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: string;
}

export function updatePageMetadata({ title, description, canonicalPath = '/', robots = 'index, follow' }: PageMetadata) {
  if (typeof document === 'undefined') return;

  // 1. Update Title
  document.title = title;

  // 2. Update Meta Description
  let descMeta = document.querySelector('meta[name="description"]');
  if (!descMeta) {
    descMeta = document.createElement('meta');
    descMeta.setAttribute('name', 'description');
    document.head.appendChild(descMeta);
  }
  descMeta.setAttribute('content', description);

  // 3. Update Robots Directives (e.g. noindex, follow on 404)
  let robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', robots);

  // 4. Update Open Graph Meta
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', description);

  let twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', title);

  let twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc) twitterDesc.setAttribute('content', description);

  // 4. Update Canonical URL
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  const origin = window.location.origin || 'https://tracexmail.vercel.app';
  canonicalLink.setAttribute('href', `${origin}${canonicalPath === '/' ? '' : canonicalPath}`);
}

export const ROUTE_METADATA: Record<string, PageMetadata> = {
  landing: {
    title: 'TraceXMail | Email Forensics, Threat Intelligence & Hop Traceroute',
    description: 'Reconstruct phishing attacks from original sender MTA hops to final delivery. Deterministic RFC822 header forensic deconstruction with cryptographic proof.',
    canonicalPath: '/'
  },
  privacy: {
    title: 'Privacy Policy & GDPR/CCPA Standards | TraceXMail',
    description: 'Comprehensive disclosure of data processing, cryptographic forensic parsing, Google OAuth Limited Use compliance, and zero-training AI guarantee.',
    canonicalPath: '/privacy'
  },
  terms: {
    title: 'Terms of Service & Lawful Forensic Use | TraceXMail',
    description: 'Terms of service, lawful cybersecurity investigation requirements, 100% evidence ownership, and service level commitments for TraceXMail.',
    canonicalPath: '/terms'
  },
  cookies: {
    title: 'Cookie Policy & Local Storage Transparency | TraceXMail',
    description: 'Complete inventory of essential session storage keys with an absolute zero third-party advertising or behavioral tracking guarantee.',
    canonicalPath: '/cookies'
  },
  domains: {
    title: 'Authorized Domains & Google OAuth Verification | TraceXMail',
    description: 'Official verified production domains, Google OAuth 2.0 authorized redirect URIs, CSP origins, and infrastructure endpoints for TraceXMail.',
    canonicalPath: '/domains'
  },
  contact: {
    title: 'Developer Contact, DPO & Legal Enquiries | TraceXMail',
    description: 'Direct contact channels for Data Protection Officer (DPO), Google OAuth app verification, enterprise support, and security inquiries.',
    canonicalPath: '/contact'
  },
  security: {
    title: 'Security Architecture & Vulnerability Disclosure (VDP) | TraceXMail',
    description: 'Technical specifications on NIST SP 800-86 evidence chain of custody, AES-256-GCM encryption, sandboxed link defanging, and safe harbor disclosure.',
    canonicalPath: '/security'
  },
  about: {
    title: 'About TraceXMail | Email Forensics & Threat Intelligence Research',
    description: 'Learn about TraceXMail, our cybersecurity mission, email header forensic standards (RFC 5322, RFC 7208, RFC 6376), and founder Jayaram Sappa.',
    canonicalPath: '/about'
  },
  knowledge: {
    title: 'Email Forensics & Threat Intelligence Knowledge Base | TraceXMail',
    description: 'Cybersecurity and email forensics tutorials, RFC 5322 header analysis guides, SPF/DKIM/DMARC protocols, and SOC phishing investigation playbooks.',
    canonicalPath: '/knowledge'
  },
  '404': {
    title: '404 Page Not Found | TraceXMail',
    description: 'The requested forensic case docket or compliance view could not be located in the TraceXMail enclave.',
    canonicalPath: '/404',
    robots: 'noindex, follow'
  },
  login: {
    title: 'Sign In to Enclave | TraceXMail',
    description: 'Authenticate to access your TraceXMail forensic intelligence workspace and active cases.',
    canonicalPath: '/'
  },
  signup: {
    title: 'Request Enclave Clearance | TraceXMail',
    description: 'Register for TraceXMail pilot access or join your organization security operations team.',
    canonicalPath: '/'
  },
  'forgot-password': {
    title: 'Password Recovery | TraceXMail',
    description: 'Request a password recovery link or magic authentication token for your TraceXMail account.',
    canonicalPath: '/'
  },
  'reset-password': {
    title: 'Reset Enclave Password | TraceXMail',
    description: 'Set a new cryptographic password for your TraceXMail analyst account.',
    canonicalPath: '/'
  },
  'magic-link': {
    title: 'Verify Enclave Magic Link | TraceXMail',
    description: 'Verifying one-time magic link token for passwordless enclave access.',
    canonicalPath: '/'
  },
  'accept-invite': {
    title: 'Accept Team Invitation | TraceXMail',
    description: 'Accept organizational team invitation to join TraceXMail Security Operations Center.',
    canonicalPath: '/'
  }
};

export const TAB_METADATA: Record<string, PageMetadata> = {
  ingest: {
    title: 'Email Ingestion & Raw RFC822 Parser | TraceXMail',
    description: 'Upload or paste raw RFC822 email messages, EML files, or headers for instant cryptographic analysis.',
    canonicalPath: '/'
  },
  overview: {
    title: 'Case Overview & Evidence Tag | TraceXMail',
    description: 'Comprehensive email analysis overview with cryptographic SPF, DKIM, and DMARC verification statuses and origin hop telemetry.',
    canonicalPath: '/'
  },
  dashboard: {
    title: 'SOC Operations Dashboard | TraceXMail',
    description: 'High-level threat operations dashboard with aggregate severity metrics, active phishing waves, and triage status.',
    canonicalPath: '/'
  },
  cases: {
    title: 'Forensic Case Dossiers & Archive | TraceXMail',
    description: 'Browse, filter, and review verified email forensic cases, audit history, and investigator notes.',
    canonicalPath: '/'
  },
  campaigns: {
    title: 'Adversary Attack Campaigns | TraceXMail',
    description: 'Cluster concurrent phishing waves sharing infrastructure, malicious ASNs, and lookalike domain patterns.',
    canonicalPath: '/'
  },
  search: {
    title: 'Global IOC & Header Search | TraceXMail',
    description: 'Search across all investigated email cases by IP address, domain, subject, ASN, or SHA-256 hash.',
    canonicalPath: '/'
  },
  hops: {
    title: 'MTA Relay Hop Traceroute | TraceXMail',
    description: 'Trace email routing backwards across intermediate MTAs to isolate untrusted perimeter hops.',
    canonicalPath: '/'
  },
  map: {
    title: 'Threat Origin Geolocation Map | TraceXMail',
    description: 'Interactive global map plotting physical ingress hops, autonomous system networks, and Tor exit relays.',
    canonicalPath: '/'
  },
  logs: {
    title: 'Forensic Audit Logs & Telemetry | TraceXMail',
    description: 'Immutable chronological audit logs capturing parser events, DNS lookups, and VirusTotal telemetry.',
    canonicalPath: '/'
  },
  headers: {
    title: 'Raw RFC822 Header Inspector | TraceXMail',
    description: 'Searchable, categorized breakdown of all message headers with decoded parameters and values.',
    canonicalPath: '/'
  },
  graph: {
    title: 'Entity Relationship & Infrastructure Graph | TraceXMail',
    description: 'Interactive node graph connecting sender domains, intermediate relays, recipient inboxes, and external URLs.',
    canonicalPath: '/'
  },
  timeline: {
    title: 'Chronological Investigation Timeline | TraceXMail',
    description: 'Visual event timeline tracking attack campaign progression and repeat offender activity.',
    canonicalPath: '/'
  },
  alerts: {
    title: 'Live Threat Alerts & WebSockets Feed | TraceXMail',
    description: 'Real-time security operations alerts, triage notifications, and incoming case broadcasts.',
    canonicalPath: '/'
  },
  gmail: {
    title: 'Gmail Live Sync Pipeline | TraceXMail',
    description: 'Connect Google Workspace or Gmail inboxes for automated background threat scanning.',
    canonicalPath: '/'
  },
  organization: {
    title: 'Organization & Policy Controls | TraceXMail',
    description: 'Manage enterprise security policies, tenant domains, and compliance configurations.',
    canonicalPath: '/'
  },
  team: {
    title: 'SOC Team & Access Control | TraceXMail',
    description: 'Role-based access control, team member provisioning, and operational clearances.',
    canonicalPath: '/'
  },
  settings: {
    title: 'Account & Security Settings | TraceXMail',
    description: 'Manage analyst clearance, session timeouts, API credentials, and personal workspace preferences.',
    canonicalPath: '/'
  }
};
