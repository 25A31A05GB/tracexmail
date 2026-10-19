# TraceXMail Official TypeScript SDK

Official client library for integrating the TraceXMail Forensic Defense Platform into Node.js, Next.js, and edge workers.

## Installation
\`\`\`bash
npm install @tracexmail/sdk
\`\`\`

## Quickstart
\`\`\`typescript
import { TraceXMailClient } from '@tracexmail/sdk';
import fs from 'fs';

const client = new TraceXMailClient({
  apiKey: process.env.TRACEXMAIL_API_KEY!,
  baseUrl: 'https://api.tracexmail.com'
});

async function main() {
  const rawEmail = fs.readFileSync('suspicious_invoice.eml', 'utf8');

  const verdict = await client.analyzeEmail({
    rawEmail,
    fileName: 'suspicious_invoice.eml'
  });

  console.log(`Threat Verdict: ${verdict.threatVerdict} (${verdict.threatScore}/100)`);
  console.log(`Classification: ${verdict.classification}`);
  console.log(`SPF Status: ${verdict.auth.spf?.status}`);
  console.log(`Executive Rationale: ${verdict.why?.executive_summary}`);
}

main().catch(console.error);
\`\`\`
