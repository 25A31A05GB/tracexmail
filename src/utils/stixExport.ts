import { EmailAnalysis } from '../types';

/**
 * OASIS STIX 2.1 & OpenIOC Standard Formatter
 * Compliant with OASIS STIX v2.1 (JSON) and Mandiant OpenIOC (XML) specifications.
 */

export interface StixBundle {
  type: 'bundle';
  id: string;
  spec_version: '2.1';
  objects: any[];
}

export function generateStix21Bundle(analysis: EmailAnalysis): StixBundle {
  const timestamp = new Date().toISOString();
  const bundleId = `bundle--${crypto.randomUUID ? crypto.randomUUID() : 'txm-' + Date.now()}`;
  const reportId = `report--${crypto.randomUUID ? crypto.randomUUID() : 'rep-' + Date.now()}`;
  const identityId = `identity--${crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now()}`;

  const fromEmail = analysis.headers?.fromEmail || analysis.from || 'unknown@sender.local';
  const subject = analysis.headers?.subject || analysis.subject || 'Security Incident Artifact';
  const threatScore = analysis.threatScore ?? analysis.riskScore ?? 50;
  const isMalicious = threatScore >= 70;

  const objects: any[] = [
    {
      type: 'identity',
      spec_version: '2.1',
      id: identityId,
      created: timestamp,
      modified: timestamp,
      name: 'TraceXMail Automated SOC Forensics Engine',
      identity_class: 'system',
      sectors: ['technology', 'defense']
    },
    {
      type: 'report',
      spec_version: '2.1',
      id: reportId,
      created: timestamp,
      modified: timestamp,
      name: `TraceXMail Forensic Report: ${subject}`,
      description: analysis.summary || `Email forensic triage for message "${subject}" from ${fromEmail}`,
      published: timestamp,
      report_types: ['threat-report', 'incident'],
      confidence: Math.round((analysis.mlConfidence || 0.85) * 100),
      object_refs: [identityId]
    }
  ];

  // 1. Sender Email Indicator
  if (fromEmail && fromEmail.includes('@')) {
    const emailIndId = `indicator--${crypto.randomUUID ? crypto.randomUUID() : 'ind-mail-' + Date.now()}`;
    objects.push({
      type: 'indicator',
      spec_version: '2.1',
      id: emailIndId,
      created: timestamp,
      modified: timestamp,
      name: `Malicious Sender Email: ${fromEmail}`,
      pattern: `[email-addr:value = '${fromEmail}']`,
      pattern_type: 'stix',
      valid_from: timestamp,
      indicator_types: [isMalicious ? 'malicious-activity' : 'anomalous-activity'],
      confidence: threatScore
    });
    objects[1].object_refs.push(emailIndId);
  }

  // 2. Extracted Malicious URLs / Links
  const urls = analysis.urls || [];
  urls.forEach((u, i) => {
    const rawUrl = typeof u === 'string' ? u : u.url;
    if (rawUrl && rawUrl.startsWith('http')) {
      const urlIndId = `indicator--${crypto.randomUUID ? crypto.randomUUID() : 'ind-url-' + i + '-' + Date.now()}`;
      objects.push({
        type: 'indicator',
        spec_version: '2.1',
        id: urlIndId,
        created: timestamp,
        modified: timestamp,
        name: `Extracted URL Indicator: ${rawUrl.substring(0, 60)}...`,
        pattern: `[url:value = '${rawUrl.replace(/'/g, "\\'")}']`,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['malicious-activity', 'phishing'],
        confidence: threatScore
      });
      objects[1].object_refs.push(urlIndId);
    }
  });

  // 3. Extracted Relay Hop IPs
  const hops = analysis.hops || [];
  hops.forEach((hop, i) => {
    const hopIp = hop.fromIp || (hop as any).ip;
    if (hopIp && !hop.isPrivate && !hop.isRfc1918 && hopIp !== '127.0.0.1') {
      const ipIndId = `indicator--${crypto.randomUUID ? crypto.randomUUID() : 'ind-ip-' + i + '-' + Date.now()}`;
      objects.push({
        type: 'indicator',
        spec_version: '2.1',
        id: ipIndId,
        created: timestamp,
        modified: timestamp,
        name: `Public Relay Ingress IP: ${hopIp}`,
        pattern: `[ipv4-addr:value = '${hopIp}']`,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['anomalous-activity'],
        confidence: Math.max(30, threatScore - 15)
      });
      objects[1].object_refs.push(ipIndId);
    }
  });

  // 4. Attachments (File Hashes)
  const attachments = analysis.attachments || [];
  attachments.forEach((att, i) => {
    if (att.sha256 || att.filename) {
      const fileIndId = `indicator--${crypto.randomUUID ? crypto.randomUUID() : 'ind-file-' + i + '-' + Date.now()}`;
      const pattern = att.sha256
        ? `[file:hashes.'SHA-256' = '${att.sha256}']`
        : `[file:name = '${att.filename}']`;
      objects.push({
        type: 'indicator',
        spec_version: '2.1',
        id: fileIndId,
        created: timestamp,
        modified: timestamp,
        name: `Suspicious Email Attachment: ${att.filename}`,
        pattern,
        pattern_type: 'stix',
        valid_from: timestamp,
        indicator_types: ['malicious-activity'],
        confidence: att.status === 'MALICIOUS' ? 95 : 60
      });
      objects[1].object_refs.push(fileIndId);
    }
  });

  return {
    type: 'bundle',
    id: bundleId,
    spec_version: '2.1',
    objects
  };
}

export function generateOpenIocXml(analysis: EmailAnalysis): string {
  const iocId = `ioc-${Date.now()}`;
  const fromEmail = analysis.headers?.fromEmail || analysis.from || 'unknown@sender.local';
  const subject = analysis.headers?.subject || analysis.subject || 'Email Security Incident';
  const timestamp = new Date().toISOString();

  let itemsXml = '';

  if (fromEmail) {
    itemsXml += `
      <IndicatorItem id="item-from-${Date.now()}" condition="is">
        <Context document="Email" search="Email/From" type="mir" />
        <Content type="string">${escapeXml(fromEmail)}</Content>
      </IndicatorItem>`;
  }

  (analysis.urls || []).forEach((u, i) => {
    const rawUrl = typeof u === 'string' ? u : u.url;
    if (rawUrl) {
      itemsXml += `
      <IndicatorItem id="item-url-${i}-${Date.now()}" condition="contains">
        <Context document="UrlHistory" search="UrlHistory/URL" type="mir" />
        <Content type="string">${escapeXml(rawUrl)}</Content>
      </IndicatorItem>`;
    }
  });

  (analysis.hops || []).forEach((hop, i) => {
    const hopIp = hop.fromIp || (hop as any).ip;
    if (hopIp && !hop.isPrivate && !hop.isRfc1918) {
      itemsXml += `
      <IndicatorItem id="item-ip-${i}-${Date.now()}" condition="is">
        <Context document="PortItem" search="PortItem/remoteIP" type="mir" />
        <Content type="IP">${escapeXml(hopIp)}</Content>
      </IndicatorItem>`;
    }
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<ioc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" id="${iocId}" last-modified="${timestamp}" xmlns="http://schemas.mandiant.com/2010/ioc">
  <short_description>TraceXMail IOC: ${escapeXml(subject)}</short_description>
  <description>Automated Indicators of Compromise extracted by TraceXMail Security Operations Enclave.</description>
  <authored_by>TraceXMail SOC Engine</authored_by>
  <authored_date>${timestamp}</authored_date>
  <definition>
    <Indicator operator="OR" id="ind-root-${Date.now()}">
      ${itemsXml}
    </Indicator>
  </definition>
</ioc>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
