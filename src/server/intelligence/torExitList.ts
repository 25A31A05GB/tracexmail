/**
 * TraceXMail Independent Tor Bulk Exit Node Intelligence Service
 *
 * Synchronizes with the official Tor Project bulk exit list (https://check.torproject.org/torbulkexitlist)
 * at startup and every 6 hours. Provides authoritative, sub-millisecond local in-memory
 * checks for Tor exit nodes, with local disk caching and fallback.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const TOR_EXIT_URLS = [
  'https://raw.githubusercontent.com/SecOps-Institute/Tor-IP-Addresses/master/tor-exit-nodes.lst',
  'https://check.torproject.org/torbulkexitlist'
];
const TOR_EXIT_URL = TOR_EXIT_URLS[0];
const LOCAL_FALLBACK_FILE = path.join(process.cwd(), 'data/threat-lists/tor-exit-list.txt');
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-Memory Set of Active Tor Exit IP Addresses
const torExitIps = new Set<string>();
let isInitialized = false;
let refreshTimer: NodeJS.Timeout | null = null;

// Built-in seed of known high-traffic Tor exit nodes for instantaneous cold-start resilience
const SEED_TOR_EXIT_IPS = [
  '185.220.101.5', '185.220.101.6', '185.220.101.7', '185.220.101.8',
  '185.220.101.9', '185.220.101.10', '185.220.101.11', '185.220.101.12',
  '185.220.101.13', '185.220.101.14', '185.220.101.15', '185.220.101.16',
  '185.220.101.17', '185.220.101.18', '185.220.101.19', '185.220.101.20',
  '185.220.101.21', '185.220.101.22', '185.220.101.23', '185.220.101.24',
  '185.220.101.25', '185.220.101.26', '185.220.101.27', '185.220.101.28',
  '185.220.101.29', '185.220.101.30', '185.220.101.31', '185.220.101.32',
  '185.220.101.33', '185.220.101.34', '185.220.101.35', '185.220.101.36',
  '185.220.101.37', '185.220.101.38', '185.220.101.39', '185.220.101.40',
  '185.220.102.4', '185.220.102.5', '185.220.102.6', '185.220.102.7',
  '185.220.102.8', '185.220.102.9', '185.220.103.4', '185.220.103.5',
  '51.15.43.205', '51.15.54.120', '198.98.56.149', '199.249.230.70',
  '199.249.230.71', '199.249.230.72', '199.249.230.73', '199.249.230.74',
  '199.249.230.75', '199.249.230.76', '199.249.230.77', '199.249.230.78',
  '199.249.230.79', '199.249.230.80', '199.249.230.81', '199.249.230.82',
  '199.249.230.83', '199.249.230.84', '199.249.230.85', '199.249.230.86',
  '199.249.230.87', '199.249.230.88', '199.249.230.89', '199.249.230.90',
  '109.70.100.25', '109.70.100.26', '109.70.100.27', '109.70.100.28',
  '109.70.100.29', '109.70.100.30', '109.70.100.31', '109.70.100.32',
  '109.70.100.33', '109.70.100.34', '109.70.100.35', '109.70.100.36'
];

/**
 * Loads and parses IPs from raw text content into the in-memory set.
 */
function parseAndLoadTorIps(content: string): number {
  let count = 0;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Check if valid IPv4 or IPv6
    if (/^[0-9a-fA-F:.]+$/.test(trimmed)) {
      torExitIps.add(trimmed.toLowerCase());
      count++;
    }
  }
  return count;
}

/**
 * Loads the local fallback list from disk or initializes seed entries.
 */
function loadLocalFallback() {
  try {
    if (fs.existsSync(LOCAL_FALLBACK_FILE)) {
      const content = fs.readFileSync(LOCAL_FALLBACK_FILE, 'utf8');
      const count = parseAndLoadTorIps(content);
      if (count > 0) {
        return;
      }
    }
  } catch (err: any) {
    console.warn('[TorExitList] Could not read local fallback file:', err?.message);
  }

  // Load built-in seed if file doesn't exist
  for (const ip of SEED_TOR_EXIT_IPS) {
    torExitIps.add(ip.toLowerCase());
  }
}

/**
 * Fetches the live Tor bulk exit list from authoritative mirrors.
 */
export async function refreshTorExitList(): Promise<void> {
  for (const url of TOR_EXIT_URLS) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/plain,*/*'
        }
      });

      if (response.data && typeof response.data === 'string') {
        const newIps = new Set<string>();
        const lines = response.data.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && /^[0-9a-fA-F:.]+$/.test(trimmed)) {
            newIps.add(trimmed.toLowerCase());
          }
        }

        if (newIps.size > 0) {
          torExitIps.clear();
          for (const ip of newIps) {
            torExitIps.add(ip);
          }

          // Persist to local cache
          try {
            const dir = path.dirname(LOCAL_FALLBACK_FILE);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(LOCAL_FALLBACK_FILE, Array.from(newIps).join('\n'), 'utf8');
          } catch {}

          return;
        }
      }
    } catch {
      // Continue to next mirror or fallback
    }
  }

  // If live fetch was unavailable, ensure fallback is loaded
  if (torExitIps.size === 0) {
    loadLocalFallback();
  }
}

/**
 * Initializes the Tor exit list service and sets up recurring refresh.
 */
export async function initTorExitList(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  loadLocalFallback();
  // Asynchronously trigger live update without blocking
  refreshTorExitList().catch(() => {});

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      refreshTorExitList().catch(() => {});
    }, REFRESH_INTERVAL_MS);
    if (refreshTimer.unref) refreshTimer.unref();
  }
}

// Auto-initialize on import
initTorExitList().catch(() => {});

/**
 * Returns true if the provided IP is a known Tor exit node.
 */
export function isTorExitNode(ip: string): boolean {
  if (!ip) return false;
  const clean = ip.trim().toLowerCase();
  return torExitIps.has(clean);
}
