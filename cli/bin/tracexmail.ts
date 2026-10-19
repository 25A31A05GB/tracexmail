#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
TraceXMail Forensic CLI v2.5.0
Usage:
  npx tracexmail analyze <file.eml> [--api-key <key>] [--url <gateway-url>]

Options:
  --api-key <key>    Your TraceXMail API Key (or set TRACEXMAIL_API_KEY)
  --url <url>        API Gateway URL (defaults to http://localhost:3000)
  --json             Output raw JSON response
  --help, -h         Show help
`);
    process.exit(0);
  }

  if (command === 'analyze') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: Please provide path to an .eml file. Example: npx tracexmail analyze sample.eml');
      process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: File not found at '${resolvedPath}'`);
      process.exit(1);
    }

    const rawEmail = fs.readFileSync(resolvedPath, 'utf8');

    // Parse options
    let apiKey = process.env.TRACEXMAIL_API_KEY || '';
    let baseUrl = process.env.TRACEXMAIL_API_URL || 'http://localhost:3000';
    let outputJson = false;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--api-key' && args[i + 1]) apiKey = args[++i];
      if (args[i] === '--url' && args[i + 1]) baseUrl = args[++i];
      if (args[i] === '--json') outputJson = true;
    }

    console.log(`\n🔍 [TraceXMail] Inspecting RFC822 artifact: ${path.basename(resolvedPath)} (${rawEmail.length} bytes)...`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'TraceXMail-CLI/2.5'
      };
      if (apiKey) headers['X-API-Key'] = apiKey;

      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v1/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          raw_email: rawEmail,
          file_name: path.basename(resolvedPath)
        })
      });

      const data: any = await res.json();
      if (!res.ok) {
        console.error(`API Error (${res.status}):`, data.detail || data.title || data.error);
        process.exit(1);
      }

      const result = data.analysis || data;

      if (outputJson) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      }

      const score = result.threatScore || 0;
      const verdict = result.threatVerdict || (score >= 70 ? 'MALICIOUS' : score >= 35 ? 'SUSPICIOUS' : 'CLEAN');
      const badge = verdict === 'MALICIOUS' ? '\x1b[41m\x1b[37m MALICIOUS \x1b[0m' : verdict === 'SUSPICIOUS' ? '\x1b[43m\x1b[30m SUSPICIOUS \x1b[0m' : '\x1b[42m\x1b[30m CLEAN \x1b[0m';

      console.log(`\n======================================================`);
      console.log(` Verdict: ${badge}  (Threat Score: ${score}/100)`);
      console.log(` Classification: ${result.classification || 'Unknown'}`);
      console.log(` Language:       ${result.detectedLanguage || 'en'}`);
      console.log(`------------------------------------------------------`);
      console.log(` Cryptographic Authentication:`);
      console.log(`   SPF:   ${result.auth?.spf?.status || 'NONE'} (${result.auth?.spf?.domain || 'N/A'})`);
      console.log(`   DKIM:  ${result.auth?.dkim?.status || 'NONE'}`);
      console.log(`   DMARC: ${result.auth?.dmarc?.status || 'NONE'} (policy: ${result.auth?.dmarc?.policy || 'none'})`);
      console.log(`------------------------------------------------------`);
      console.log(` Executive Summary:`);
      console.log(`   ${result.why?.executive_summary || result.description || 'Forensic analysis completed.'}`);
      console.log(`======================================================\n`);
    } catch (err: any) {
      console.error('Failed to communicate with TraceXMail gateway:', err.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command '${command}'. Run 'npx tracexmail --help' for usage.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
