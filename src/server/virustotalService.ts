// Re-export VirusTotal API v3 integration from src/server/intelligence/virustotal.ts
export * from './intelligence/virustotal';
export { enrichWithVirusTotal as enrichWithVirusTotalLegacy } from './intelligence/virustotal';

import { lookupVirusTotalUrl, lookupVirusTotalFileHash, enrichWithVirusTotal } from './intelligence/virustotal';

export async function checkVirusTotal(value: string, iocType: 'ip' | 'domain' | 'url' | 'hash') {
  if (iocType === 'url') {
    return lookupVirusTotalUrl(value);
  }
  if (iocType === 'hash') {
    return lookupVirusTotalFileHash(value);
  }
  return enrichWithVirusTotal({
    urls: iocType === 'domain' ? [`http://${value}`] : []
  });
}
