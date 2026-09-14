/**
 * TraceXMail VPN & Datacenter/Hosting Infrastructure Intelligence Service
 *
 * Utilizes X4BNet's open-source CIDR intelligence lists (VPN & Datacenter/Hosting ranges)
 * to accurately identify anonymous commercial VPNs, proxies, and cloud hosting nodes.
 *
 * Auto-refreshes daily with local disk cache and zero-overhead in-memory matching.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { isIpInCidr } from '../maxmindService';

const X4B_VPN_URLS = [
  'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
  'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/ipv4.txt'
];
const X4B_DC_URLS = [
  'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt',
  'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/ipv4.txt'
];

const LOCAL_VPN_FILE = path.join(process.cwd(), 'data/threat-lists/vpn-ipv4.txt');
const LOCAL_DC_FILE = path.join(process.cwd(), 'data/threat-lists/datacenter-ipv4.txt');
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const vpnCidrs: string[] = [];
const dcCidrs: string[] = [];
let isInitialized = false;
let refreshTimer: NodeJS.Timeout | null = null;

// Built-in seed of major commercial VPN & hosting provider subnets (NordVPN, ExpressVPN, Surfshark, DigitalOcean, Hetzner, AWS, Linode)
const SEED_VPN_CIDRS = [
  '185.220.100.0/22',
  '193.189.100.0/23',
  '194.26.29.0/24',
  '185.246.128.0/22',
  '185.242.6.0/24',
  '194.32.104.0/22',
  '185.183.104.0/22',
  '185.228.168.0/22',
  '89.187.160.0/19',
  '198.8.80.0/20'
];

const SEED_DC_CIDRS = [
  '104.16.0.0/12',
  '172.64.0.0/13',
  '13.32.0.0/15',
  '52.0.0.0/11',
  '54.0.0.0/9',
  '104.196.0.0/14',
  '34.64.0.0/11',
  '35.184.0.0/13',
  '13.64.0.0/11',
  '20.0.0.0/10',
  '167.99.0.0/16',
  '159.203.0.0/16',
  '178.62.0.0/16',
  '188.166.0.0/16',
  '138.68.0.0/16',
  '139.59.0.0/16',
  '88.99.0.0/16',
  '144.76.0.0/16',
  '148.251.0.0/16',
  '195.201.0.0/16'
];

function loadLinesFromText(text: string): string[] {
  const result: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // Basic CIDR / IP validation
    if (trimmed.includes('/') || /^[0-9a-fA-F:.]+$/.test(trimmed)) {
      result.push(trimmed);
    }
  }
  return result;
}

function loadLocalFallback() {
  try {
    if (fs.existsSync(LOCAL_VPN_FILE)) {
      const vpnText = fs.readFileSync(LOCAL_VPN_FILE, 'utf8');
      const loadedVpn = loadLinesFromText(vpnText);
      if (loadedVpn.length > 0) {
        vpnCidrs.length = 0;
        vpnCidrs.push(...loadedVpn);
      }
    }
  } catch (err: any) {
    console.warn('[VpnHostingList] Error reading local VPN file:', err?.message);
  }

  if (vpnCidrs.length === 0) {
    vpnCidrs.push(...SEED_VPN_CIDRS);
  }

  try {
    if (fs.existsSync(LOCAL_DC_FILE)) {
      const dcText = fs.readFileSync(LOCAL_DC_FILE, 'utf8');
      const loadedDc = loadLinesFromText(dcText);
      if (loadedDc.length > 0) {
        dcCidrs.length = 0;
        dcCidrs.push(...loadedDc);
      }
    }
  } catch (err: any) {
    console.warn('[VpnHostingList] Error reading local Datacenter file:', err?.message);
  }

  if (dcCidrs.length === 0) {
    dcCidrs.push(...SEED_DC_CIDRS);
  }
}

/**
 * Fetches and updates the VPN and Hosting lists from X4BNet repositories.
 */
export async function refreshVpnHostingList(): Promise<void> {
  try {
    // 1. Fetch VPN list
    let vpnLoaded = false;
    for (const vpnUrl of X4B_VPN_URLS) {
      try {
        const vpnRes = await axios.get(vpnUrl, {
          timeout: 12000,
          headers: { 'User-Agent': 'TraceXMail-SOC-Forensics/2.5' }
        });
        if (vpnRes.data && typeof vpnRes.data === 'string') {
          const parsed = loadLinesFromText(vpnRes.data);
          if (parsed.length > 0) {
            vpnCidrs.length = 0;
            vpnCidrs.push(...parsed);

            try {
              const dir = path.dirname(LOCAL_VPN_FILE);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(LOCAL_VPN_FILE, parsed.join('\n'), 'utf8');
            } catch {}
            console.log(`[VpnHostingList] Loaded ${parsed.length} VPN CIDR prefixes from X4BNet.`);
            vpnLoaded = true;
            break;
          }
        }
      } catch (err: any) {
        // Try next candidate URL
      }
    }
    if (!vpnLoaded && vpnCidrs.length === 0) {
      console.warn('[VpnHostingList] VPN list remote sync failed - using local cache.');
    }

    // 2. Fetch Datacenter list
    let dcLoaded = false;
    for (const dcUrl of X4B_DC_URLS) {
      try {
        const dcRes = await axios.get(dcUrl, {
          timeout: 12000,
          headers: { 'User-Agent': 'TraceXMail-SOC-Forensics/2.5' }
        });
        if (dcRes.data && typeof dcRes.data === 'string') {
          const parsed = loadLinesFromText(dcRes.data);
          if (parsed.length > 0) {
            dcCidrs.length = 0;
            dcCidrs.push(...parsed);

            try {
              const dir = path.dirname(LOCAL_DC_FILE);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(LOCAL_DC_FILE, parsed.join('\n'), 'utf8');
            } catch {}
            console.log(`[VpnHostingList] Loaded ${parsed.length} Datacenter/Hosting CIDR prefixes from X4BNet.`);
            dcLoaded = true;
            break;
          }
        }
      } catch (err: any) {
        // Try next candidate URL
      }
    }
    if (!dcLoaded && dcCidrs.length === 0) {
      console.warn('[VpnHostingList] Datacenter list remote sync failed - using local cache.');
    }
  } catch (err: any) {
    console.warn('[VpnHostingList] Refresh error:', err?.message);
  }

  if (vpnCidrs.length === 0 || dcCidrs.length === 0) {
    loadLocalFallback();
  }
}

/**
 * Initializes the VPN / Datacenter intelligence lists.
 */
export async function initVpnHostingList(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  loadLocalFallback();
  refreshVpnHostingList().catch(() => {});

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      refreshVpnHostingList().catch(() => {});
    }, REFRESH_INTERVAL_MS);
    if (refreshTimer.unref) refreshTimer.unref();
  }
}

// Auto-initialize on import
initVpnHostingList().catch(() => {});

/**
 * Classifies an IP as 'vpn', 'hosting', or null (if residential/standard public).
 */
export function classifyInfra(ip: string): 'vpn' | 'hosting' | null {
  if (!ip) return null;
  const cleanIp = ip.trim();

  // 1. Check VPN CIDR ranges first
  for (let i = 0; i < vpnCidrs.length; i++) {
    const cidr = vpnCidrs[i];
    if (isIpInCidr(cleanIp, cidr)) {
      return 'vpn';
    }
  }

  // 2. Check Datacenter / Cloud Hosting CIDR ranges
  for (let i = 0; i < dcCidrs.length; i++) {
    const cidr = dcCidrs[i];
    if (isIpInCidr(cleanIp, cidr)) {
      return 'hosting';
    }
  }

  return null;
}
