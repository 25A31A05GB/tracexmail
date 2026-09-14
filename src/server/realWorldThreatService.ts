/**
 * TraceXMail Curated Threat Scenario Library & Benchmark Intelligence Service
 * 
 * Provides a vetted catalog of real-world attack archetypes and IOC campaign signatures
 * modeled after historical CISA Alerts, OpenPhish lures, PhishTank patterns, and
 * VirusTotal campaign indicators for SOC simulation, testing, and dynamic incident generation.
 */

import { getSupabaseAdminClient, DEFAULT_ORG_ID } from './supabase';

export interface RealWorldThreatItem {
  id: string;
  source: 'CISA' | 'OPENPHISH' | 'PHISHTANK' | 'VIRUSTOTAL' | 'HONEYPOT_STREAM';
  title: string;
  description: string;
  threat_type: 'BEC_IMPERSONATION' | 'CREDENTIAL_HARVESTING' | 'MALWARE_DROPPER' | 'OAUTH_HIJACK' | 'QUISHING' | 'SUPPLY_CHAIN_FRAUD';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  threat_score: number;
  targeted_brand: string;
  target_industry: string;
  ioc_indicators: {
    sender_domain?: string;
    sender_ip?: string;
    malicious_urls?: string[];
    file_hashes?: string[];
    asn?: string;
  };
  sample_headers: {
    from: string;
    to: string;
    subject: string;
    date: string;
    message_id: string;
    received_hops: string[];
    auth_results: {
      spf: string;
      dkim: string;
      dmarc: string;
    };
  };
  sample_body: string;
  timestamp: string;
  is_active: boolean;
  mitigation_advice: string;
}

export const REAL_WORLD_THREAT_FEED: RealWorldThreatItem[] = [
  {
    id: 'cisa-adv-2026-081',
    source: 'CISA',
    title: 'CISA Alert AA26-249A: Active Campaign Hijacking Enterprise Device Code Flows',
    description: 'Threat actors are sending spear-phishing emails containing spoofed Microsoft 365 identity verification links that abuse Device Authorization Grants to bypass multi-factor authentication (MFA).',
    threat_type: 'OAUTH_HIJACK',
    severity: 'CRITICAL',
    threat_score: 98,
    targeted_brand: 'Microsoft 365 / Entra ID',
    target_industry: 'Critical Infrastructure, Financial Services, Defense',
    ioc_indicators: {
      sender_domain: 'login-microsoft-securityauth.com',
      sender_ip: '194.26.29.112',
      malicious_urls: ['https://login-microsoft-securityauth.com/device/verify-token?id=soc884'],
      asn: 'AS44050 (Bulletproof Hosting Ltd)',
      file_hashes: ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']
    },
    sample_headers: {
      from: 'Identity Verification Team <security@login-microsoft-securityauth.com>',
      to: 'soc-director@enterprise.com',
      subject: 'CRITICAL: Mandatory Re-authentication for Microsoft 365 Tenant',
      date: 'Sun, 06 Sep 2026 14:15:22 +0000',
      message_id: '<m365-alert-88294@login-microsoft-securityauth.com>',
      received_hops: [
        'from relay.login-microsoft-securityauth.com (194.26.29.112) by mx.enterprise.com with ESMTPS; Sun, 06 Sep 2026 14:15:23 +0000'
      ],
      auth_results: {
        spf: 'pass (login-microsoft-securityauth.com: 194.26.29.112)',
        dkim: 'pass (header.d=login-microsoft-securityauth.com)',
        dmarc: 'fail (p=reject, Header From does not align with microsoft.com)'
      }
    },
    sample_body: `Dear Administrator,

A conditional access policy requires immediate device code authorization for your tenant session. Failure to authenticate within 24 hours will result in administrative lock-out.

Device Authorization Code: TRAC-8892-X
Login Portal: https://login-microsoft-securityauth.com/device/verify-token?id=soc884

Microsoft 365 Global Security Team`,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    is_active: true,
    mitigation_advice: 'Revoke device authorization tokens, enforce FIDO2 WebAuthn, block AS44050 at firewall perimeter.'
  },
  {
    id: 'openphish-2026-4412',
    source: 'OPENPHISH',
    title: 'OpenPhish Urgent: DocuSign eSignature Financial Wire Tampering Lure',
    description: 'High-volume phishing wave mimicking DocuSign envelope notifications. Clicking the review button downloads an obfuscated HTML attachment executing an SVG-based credential harvest.',
    threat_type: 'BEC_IMPERSONATION',
    severity: 'HIGH',
    threat_score: 93,
    targeted_brand: 'DocuSign / Corporate Accounting',
    target_industry: 'Manufacturing, Real Estate, Corporate Legal',
    ioc_indicators: {
      sender_domain: 'docusign-envelope-review.net',
      sender_ip: '185.220.101.55',
      malicious_urls: ['https://docusign-envelope-review.net/d/v2/doc_inbound_7749'],
      asn: 'AS200052 (Tor Exit / Hosting Network)'
    },
    sample_headers: {
      from: 'DocuSign Alternate Routing <service@docusign-envelope-review.net>',
      to: 'accounts-payable@enterprise.com',
      subject: 'DocuSign: Please review and sign: 2026 Wire Transfer & Escrow Instruction Amendment',
      date: 'Sun, 06 Sep 2026 13:40:10 +0000',
      message_id: '<docu-994827@docusign-envelope-review.net>',
      received_hops: [
        'from exit.tor-relay-55.net (185.220.101.55) by mx.enterprise.com with ESMTPS; Sun, 06 Sep 2026 13:40:11 +0000'
      ],
      auth_results: {
        spf: 'neutral (domain owner does not designate permitted sender hosts)',
        dkim: 'none',
        dmarc: 'fail (p=reject)'
      }
    },
    sample_body: `DocuSign Electronic Signature Service

You have received an urgent document for electronic review and disbursement sign-off:
Document: Escrow_Payment_Wire_Details_Rev3.pdf
Sender: Office of Financial Controller

Click here to Review & Sign: https://docusign-envelope-review.net/d/v2/doc_inbound_7749`,
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    is_active: true,
    mitigation_advice: 'Enforce email header spoof protection, check recipient mailbox logs for accessed docu links.'
  },
  {
    id: 'vt-telemetry-2026-908',
    source: 'VIRUSTOTAL',
    title: 'VirusTotal IOC Hit: Malicious EML Dropper (Trojan.Downloader.Agent.EML)',
    description: 'Fresh SHA-256 detection on VirusTotal (46/72 engines malicious). Email contains ISO image attachment containing dynamic DLL side-loading binary targeting corporate ERP.',
    threat_type: 'MALWARE_DROPPER',
    severity: 'CRITICAL',
    threat_score: 96,
    targeted_brand: 'Global Logistics / DHL Express',
    target_industry: 'Logistics, Supply Chain, Retail',
    ioc_indicators: {
      sender_domain: 'dhl-tracking-express.cc',
      sender_ip: '91.240.118.82',
      malicious_urls: ['http://91.240.118.82/payload/Shipping_Receipt_DHL.iso'],
      file_hashes: ['a87b32d0016e4590cf2e25867ff4995a2992ef013cbb6249b6ef9436e5ec6d02'],
      asn: 'AS58224 (Flynet Hosting)'
    },
    sample_headers: {
      from: 'DHL Express Dispatch <delivery-notice@dhl-tracking-express.cc>',
      to: 'shipping-dock@enterprise.com',
      subject: 'DHL Express: Shipment N-99482103 customs clearance required (Action within 12h)',
      date: 'Sun, 06 Sep 2026 12:10:00 +0000',
      message_id: '<dhl-express-883921@dhl-tracking-express.cc>',
      received_hops: [
        'from node82.flynet.cc (91.240.118.82) by mx.enterprise.com with ESMTPS; Sun, 06 Sep 2026 12:10:01 +0000'
      ],
      auth_results: {
        spf: 'fail (ip 91.240.118.82 is not permitted for dhl.com)',
        dkim: 'fail (invalid signature header)',
        dmarc: 'fail (p=reject)'
      }
    },
    sample_body: `DHL Express Notification

Your consignment #N-99482103 is held at customs due to an incorrect tax calculation. Please download the attached customs documentation ISO container to complete delivery release.

Tracking Link: http://91.240.118.82/payload/Shipping_Receipt_DHL.iso`,
    timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    is_active: true,
    mitigation_advice: 'Block .iso / .vhd / .img email attachments at mail transfer agent (MTA) border.'
  },
  {
    id: 'phishtank-2026-7881',
    source: 'PHISHTANK',
    title: 'PhishTank Verified: QR Code "Quishing" HR Benefits Enrollment Phish',
    description: 'Verified phishing campaign utilizing embedded PNG QR code that bypasses standard email text regex filters. Directs mobile employees to fake Okta SSO portal.',
    threat_type: 'QUISHING',
    severity: 'HIGH',
    threat_score: 89,
    targeted_brand: 'Workday / Okta SSO',
    target_industry: 'Healthcare, Education, Enterprise Tech',
    ioc_indicators: {
      sender_domain: 'hr-benefits-portal-sync.com',
      sender_ip: '104.244.76.13',
      malicious_urls: ['https://okta-sso-verify-benefits.com/login'],
      asn: 'AS13335 (Cloudflare Proxy Shield)'
    },
    sample_headers: {
      from: 'Corporate Benefits Desk <hr-admin@hr-benefits-portal-sync.com>',
      to: 'staff-all@enterprise.com',
      subject: 'Mandatory: 2026 Open Enrollment Dental & Medical Benefit Verification (Scan QR Code)',
      date: 'Sun, 06 Sep 2026 11:30:00 +0000',
      message_id: '<qr-benefits-9982@hr-benefits-portal-sync.com>',
      received_hops: [
        'from relay.hr-benefits-portal-sync.com (104.244.76.13) by mx.enterprise.com with ESMTPS; Sun, 06 Sep 2026 11:30:01 +0000'
      ],
      auth_results: {
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'none (no dmarc record on hr-benefits-portal-sync.com)'
      }
    },
    sample_body: `Annual Open Enrollment Notice:

Please scan the QR code below on your corporate smartphone to verify your 2026 healthcare policy choices.

[Embedded QR Code Image: https://okta-sso-verify-benefits.com/login]

Human Resources & Benefits Division`,
    timestamp: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    is_active: true,
    mitigation_advice: 'Deploy computer vision QR OCR inspection in email security pipeline.'
  },
  {
    id: 'honeypot-2026-1029',
    source: 'HONEYPOT_STREAM',
    title: 'Live Honeypot Stream: Vendor Bank Account Change (BEC Payroll Fraud)',
    description: 'Real-time intercept on SOC honeypot mailbox. Attacker impersonating known electrical hardware supplier requesting urgent switch of ACH payment routing details.',
    threat_type: 'SUPPLY_CHAIN_FRAUD',
    severity: 'CRITICAL',
    threat_score: 95,
    targeted_brand: 'Corporate Supplier & AP',
    target_industry: 'Aerospace, Construction, Enterprise Hardware',
    ioc_indicators: {
      sender_domain: 'apex-industriall-supplies.com', // typosquat of apex-industrial-supplies.com
      sender_ip: '45.142.166.19',
      asn: 'AS209605 (HostRoyale Technologies)'
    },
    sample_headers: {
      from: 'Apex Billing Dept <accounts@apex-industriall-supplies.com>',
      to: 'finance@enterprise.com',
      subject: 'IMPORTANT: Updated Banking Coordinates for Invoice #INV-88390',
      date: 'Sun, 06 Sep 2026 10:05:00 +0000',
      message_id: '<apex-inv-88390@apex-industriall-supplies.com>',
      received_hops: [
        'from node19.hostroyale.net (45.142.166.19) by mx.enterprise.com with ESMTPS; Sun, 06 Sep 2026 10:05:01 +0000'
      ],
      auth_results: {
        spf: 'pass (ip 45.142.166.19 designated by apex-industriall-supplies.com)',
        dkim: 'pass',
        dmarc: 'none'
      }
    },
    sample_body: `Good morning,

Please note that our financial institution has undergone a scheduled audit transition. Effective immediately, all outstanding remittance for Invoice #INV-88390 ($48,250.00) must be wired to our new clearing account:

Beneficiary: Apex Hardware Supply Ltd
Routing Number (ABA): 026009593
Account Number: 99482710394

Please confirm once wire confirmation receipt is generated.

Best regards,
Billing Operations Lead`,
    timestamp: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    is_active: true,
    mitigation_advice: 'Perform mandatory secondary out-of-band voice verification with vendor before altering banking records.'
  }
];

/**
 * Converts a RealWorldThreatItem into raw RFC 822 text format
 */
export function convertThreatItemToRfc822(item: RealWorldThreatItem): string {
  const hops = (item.sample_headers.received_hops || []).join('\r\n');
  return `Received: ${hops}
From: ${item.sample_headers.from}
To: ${item.sample_headers.to}
Subject: ${item.sample_headers.subject}
Date: ${item.sample_headers.date}
Message-ID: ${item.sample_headers.message_id}
X-TraceXMail-Threat-Feed: ${item.source}
X-Threat-Score: ${item.threat_score}
X-Target-Brand: ${item.targeted_brand}
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

${item.sample_body}`;
}

/**
 * Creates and persists a dynamic real-world case directly into Supabase Postgres DB
 */
export async function createDynamicRealWorldCase(
  threatItem: RealWorldThreatItem, 
  orgId: string = DEFAULT_ORG_ID,
  assignedUser: string = 'SOC Lead Analyst'
): Promise<any> {
  const supabase = getSupabaseAdminClient();
  const caseId = `case-real-${threatItem.id}`;
  const now = new Date().toISOString();

  const caseRecord = {
    id: caseId,
    organization_id: orgId,
    title: `[${threatItem.source}] ${threatItem.title}`,
    description: threatItem.description,
    status: 'INVESTIGATING',
    severity: threatItem.severity,
    threat_score: threatItem.threat_score,
    created_at: now,
    updated_at: now,
    tags: [threatItem.source, threatItem.threat_type, threatItem.targeted_brand],
    assigned_user: assignedUser,
    source: `threat_feed_${threatItem.source.toLowerCase()}`,
    ml_confidence: Math.round(threatItem.threat_score * 0.95),
    phishing_probability: Math.round(threatItem.threat_score * 0.9)
  };

  const rawRfc822 = convertThreatItemToRfc822(threatItem);

  const emailRecord = {
    id: `email-${threatItem.id}`,
    case_id: caseId,
    organization_id: orgId,
    subject: threatItem.sample_headers.subject,
    sender: threatItem.sample_headers.from,
    recipient: threatItem.sample_headers.to,
    date: threatItem.sample_headers.date,
    headers: {
      ...threatItem.sample_headers,
      'x-threat-source': threatItem.source,
      'x-threat-type': threatItem.threat_type
    },
    raw_content: rawRfc822,
    threat_score: threatItem.threat_score,
    verdict: threatItem.severity === 'CRITICAL' || threatItem.severity === 'HIGH' ? 'Phishing' : 'Suspicious',
    created_at: now
  };

  if (supabase) {
    try {
      await supabase.from('cases').upsert([caseRecord]);
      await supabase.from('emails').upsert([emailRecord]);
    } catch (err) {
      console.warn('[RealWorldThreatService] DB upsert warning:', err);
    }
  }

  return {
    case: caseRecord,
    email: emailRecord,
    raw_email: rawRfc822
  };
}

// ============================================================================
// LIVE THREAT FEEDS (CISA & OPENPHISH) WITH 15-MINUTE IN-MEMORY TTL CACHING
// ============================================================================

export interface LiveThreatFeedResult {
  status: 'live' | 'cached' | 'fallback_simulated';
  isSimulated: boolean;
  count: number;
  last_synced: string;
  cache_expires_at: string;
  sources: string[];
  error?: string;
  feeds: (RealWorldThreatItem & { isSimulated?: boolean })[];
}

interface ThreatCache {
  data: (RealWorldThreatItem & { isSimulated?: boolean })[];
  fetchedAt: number;
  sources: string[];
}

let threatFeedCache: ThreatCache | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function parseHostname(urlStr: string): string {
  try {
    const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return u.hostname;
  } catch {
    return urlStr.replace(/^https?:\/\//i, '').split('/')[0] || urlStr;
  }
}

/**
 * Fetches real-time threats from CISA Known Exploited Vulnerabilities (KEV)
 * and OpenPhish public threat feeds without requiring API credentials.
 * Cached in memory for 15 minutes to preserve network efficiency.
 */
export async function getLiveThreatFeed(limit = 10): Promise<LiveThreatFeedResult> {
  const now = Date.now();

  // Return cached result if valid
  if (threatFeedCache && (now - threatFeedCache.fetchedAt < CACHE_TTL_MS)) {
    const remainingSec = Math.round((CACHE_TTL_MS - (now - threatFeedCache.fetchedAt)) / 1000);
    const sliced = threatFeedCache.data.slice(0, limit);
    return {
      status: 'cached',
      isSimulated: false,
      count: sliced.length,
      last_synced: new Date(threatFeedCache.fetchedAt).toISOString(),
      cache_expires_at: new Date(threatFeedCache.fetchedAt + CACHE_TTL_MS).toISOString(),
      sources: threatFeedCache.sources,
      feeds: sliced
    };
  }

  const liveItems: (RealWorldThreatItem & { isSimulated?: boolean })[] = [];
  const fetchedSources: string[] = [];
  let fetchError: string | undefined;

  // 1. Fetch CISA Known Exploited Vulnerabilities catalog (JSON)
  try {
    const cisaRes = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      headers: { 'User-Agent': 'TraceXMail-SOC-ThreatIntel/1.0' },
      signal: AbortSignal.timeout(6000)
    });

    if (cisaRes.ok) {
      const cisaJson: any = await cisaRes.json();
      const vulns: any[] = Array.isArray(cisaJson.vulnerabilities) ? cisaJson.vulnerabilities : [];
      // Take the most recently cataloged vulnerabilities
      const recentVulns = vulns.slice(-15).reverse();

      for (const vuln of recentVulns) {
        const cve = vuln.cveID || 'CVE-UNKNOWN';
        const vendor = vuln.vendorProject || 'Enterprise';
        const product = vuln.product || 'Software';
        const isRansomware = vuln.knownRansomwareCampaignUse === 'Known';
        const dateAdded = vuln.dateAdded || new Date().toISOString().slice(0, 10);

        const item: RealWorldThreatItem & { isSimulated: boolean } = {
          id: `cisa-${cve.toLowerCase()}`,
          source: 'CISA',
          title: `CISA KEV: ${cve} — ${vuln.vulnerabilityName || `${vendor} ${product}`}`,
          description: vuln.shortDescription || `Actively exploited vulnerability in ${vendor} ${product}. Required action: ${vuln.requiredAction || 'Apply vendor updates.'}`,
          threat_type: isRansomware ? 'MALWARE_DROPPER' : 'SUPPLY_CHAIN_FRAUD',
          severity: 'CRITICAL',
          threat_score: isRansomware ? 96 : 89,
          targeted_brand: `${vendor} ${product}`,
          target_industry: 'Critical Infrastructure, Government & Enterprise IT',
          ioc_indicators: {
            sender_domain: `${vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}-security-advisory.org`,
            sender_ip: '198.51.100.42',
            malicious_urls: [`https://nvd.nist.gov/vuln/detail/${cve}`],
            file_hashes: []
          },
          sample_headers: {
            from: `CISA Alert Bulletin <threat-intel@cisa.dhs.gov>`,
            to: `soc-team@enterprise.internal`,
            subject: `[CISA KEV ALERT] Active Exploitation of ${cve} (${vendor} ${product})`,
            date: new Date(dateAdded).toUTCString(),
            message_id: `<cisa-kev-${cve.toLowerCase()}@cisa.gov>`,
            received_hops: [
              `from mail-relay.cisa.dhs.gov (198.51.100.42) by mx.enterprise.internal with ESMTPS; ${new Date(dateAdded).toUTCString()}`
            ],
            auth_results: {
              spf: 'pass (cisa.dhs.gov: 198.51.100.42)',
              dkim: 'pass (header.d=cisa.dhs.gov)',
              dmarc: 'pass (p=reject)'
            }
          },
          sample_body: `CISA CYBERSECURITY ADVISORY — KNOWN EXPLOITED VULNERABILITY\n\nCVE ID: ${cve}\nVendor / Project: ${vendor}\nProduct: ${product}\nDate Cataloged: ${dateAdded}\nDue Date for Federal Agencies: ${vuln.dueDate || 'Immediate'}\nRansomware Association: ${vuln.knownRansomwareCampaignUse || 'Investigating'}\n\nDESCRIPTION:\n${vuln.shortDescription || 'No details provided.'}\n\nREQUIRED REMEDIATION:\n${vuln.requiredAction || 'Apply official patches immediately according to vendor instructions.'}\n\nNotes: ${vuln.notes || 'Cataloged in CISA KEV repository under BOD 22-01.'}`,
          timestamp: new Date(dateAdded).toISOString(),
          is_active: true,
          mitigation_advice: vuln.requiredAction || 'Apply security updates immediately and audit outbound network traffic.',
          isSimulated: false
        };
        liveItems.push(item);
      }
      fetchedSources.push('cisa');
    }
  } catch (err: any) {
    console.warn('[RealWorldThreatService] CISA live feed fetch warning:', err?.message || err);
    fetchError = err?.message || 'CISA network timeout';
  }

  // 2. Fetch OpenPhish active phishing lures (plain text URLs)
  try {
    const phishRes = await fetch('https://openphish.com/feed.txt', {
      headers: { 'User-Agent': 'TraceXMail-SOC-ThreatIntel/1.0' },
      signal: AbortSignal.timeout(6000)
    });

    if (phishRes.ok) {
      const phishText = await phishRes.text();
      const rawUrls = phishText.split(/\r?\n/).map(u => u.trim()).filter(Boolean);
      const topUrls = rawUrls.slice(0, 15);

      for (let i = 0; i < topUrls.length; i++) {
        const phishUrl = topUrls[i];
        const domain = parseHostname(phishUrl);
        const urlId = `openphish-${Date.now().toString(36)}-${i}`;

        const item: RealWorldThreatItem & { isSimulated: boolean } = {
          id: urlId,
          source: 'OPENPHISH',
          title: `OpenPhish Active Lure: ${domain}`,
          description: `Active zero-hour phishing link detected by OpenPhish feed targeting domain ${domain}. Malicious credential harvester or deceptive redirection.`,
          threat_type: 'CREDENTIAL_HARVESTING',
          severity: 'HIGH',
          threat_score: 92,
          targeted_brand: domain,
          target_industry: 'Financial Services & Enterprise Identity',
          ioc_indicators: {
            sender_domain: domain,
            malicious_urls: [phishUrl],
            sender_ip: '185.220.101.9'
          },
          sample_headers: {
            from: `Identity Notification <notice@${domain}>`,
            to: `employee@target-corp.com`,
            subject: `URGENT: Security confirmation required for ${domain}`,
            date: new Date().toUTCString(),
            message_id: `<phish-${Date.now()}-${i}@${domain}>`,
            received_hops: [
              `from unverified-gateway.${domain} (185.220.101.9) by mx.target-corp.com; ${new Date().toUTCString()}`
            ],
            auth_results: {
              spf: 'fail (domain does not authorize sending relay)',
              dkim: 'none',
              dmarc: 'fail'
            }
          },
          sample_body: `Dear User,\n\nA security review has flagged unauthorized access to your account at ${domain}.\nPlease verify your credentials immediately to avoid suspension:\n\nVerification URL: ${phishUrl}\n\nSecurity Administration`,
          timestamp: new Date().toISOString(),
          is_active: true,
          mitigation_advice: `Block URL ${phishUrl} and domain ${domain} across perimeter web security gateways and endpoint protection agents.`,
          isSimulated: false
        };
        liveItems.push(item);
      }
      fetchedSources.push('openphish');
    }
  } catch (err: any) {
    console.warn('[RealWorldThreatService] OpenPhish live feed fetch warning:', err?.message || err);
    fetchError = fetchError ? `${fetchError}; ${err?.message}` : err?.message;
  }

  // If we fetched live items successfully from at least one source
  if (liveItems.length > 0) {
    // Interleave / balance CISA and OpenPhish items for variety
    const cisaItems = liveItems.filter(i => i.source === 'CISA');
    const openPhishItems = liveItems.filter(i => i.source === 'OPENPHISH');
    const interleaved: (RealWorldThreatItem & { isSimulated?: boolean })[] = [];
    const maxLen = Math.max(cisaItems.length, openPhishItems.length);
    for (let i = 0; i < maxLen; i++) {
      if (cisaItems[i]) interleaved.push(cisaItems[i]);
      if (openPhishItems[i]) interleaved.push(openPhishItems[i]);
    }

    threatFeedCache = {
      data: interleaved,
      fetchedAt: now,
      sources: fetchedSources
    };

    const sliced = interleaved.slice(0, limit);
    return {
      status: 'live',
      isSimulated: false,
      count: sliced.length,
      last_synced: new Date(now).toISOString(),
      cache_expires_at: new Date(now + CACHE_TTL_MS).toISOString(),
      sources: fetchedSources,
      feeds: sliced
    };
  }

  // Graceful fallback: return previous cache if exists even if expired
  if (threatFeedCache && threatFeedCache.data.length > 0) {
    const sliced = threatFeedCache.data.slice(0, limit);
    return {
      status: 'cached',
      isSimulated: false,
      count: sliced.length,
      last_synced: new Date(threatFeedCache.fetchedAt).toISOString(),
      cache_expires_at: new Date(now + 60000).toISOString(),
      sources: threatFeedCache.sources,
      error: `Network update failed (${fetchError}), serving stale cached feeds`,
      feeds: sliced
    };
  }

  // Final fallback to static curated library ONLY when network is completely unreachable
  const fallbackSimulated = REAL_WORLD_THREAT_FEED.map(item => ({
    ...item,
    isSimulated: true
  })).slice(0, limit);

  return {
    status: 'fallback_simulated',
    isSimulated: true,
    count: fallbackSimulated.length,
    last_synced: new Date(now).toISOString(),
    cache_expires_at: new Date(now + 60000).toISOString(),
    sources: ['curated_offline_archive'],
    error: `Live feeds unreachable (${fetchError || 'network down'}). Fell back to curated benchmark library with isSimulated: true.`,
    feeds: fallbackSimulated
  };
}
