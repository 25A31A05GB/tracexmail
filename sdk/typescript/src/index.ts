export interface TraceXMailClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface AnalyzeEmailOptions {
  rawEmail: string;
  fileName?: string;
  idempotencyKey?: string;
}

export interface AnalysisVerdict {
  threatScore: number;
  threatVerdict: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  classification: string;
  detectedLanguage?: string;
  auth: {
    spf?: { status: string; ip?: string; domain?: string };
    dkim?: { status: string; domain?: string };
    dmarc?: { status: string; policy?: string };
  };
  why?: {
    verdict_label: string;
    executive_summary: string;
  };
}

export class TraceXMailClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: TraceXMailClientOptions) {
    if (!options.apiKey) throw new Error('TraceXMail API Key is required');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || 'https://api.tracexmail.com').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs || 15000;
  }

  /**
   * Submit an RFC822 email string for forensic deconstruction and threat scoring.
   */
  async analyzeEmail(options: AnalyzeEmailOptions): Promise<AnalysisVerdict> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'User-Agent': 'TraceXMail-TS-SDK/1.0'
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const res = await fetch(`${this.baseUrl}/api/v1/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        raw_email: options.rawEmail,
        file_name: options.fileName || 'email.eml'
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    const data: any = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.title || `API error (${res.status})`);
    }

    return data.analysis || data;
  }

  /**
   * Query a forensic case dossier by ID.
   */
  async getCase(caseId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/v1/cases/${caseId}`, {
      headers: {
        'X-API-Key': this.apiKey,
        'User-Agent': 'TraceXMail-TS-SDK/1.0'
      }
    });
    if (!res.ok) throw new Error(`Failed to fetch case ${caseId} (${res.status})`);
    return res.json();
  }

  /**
   * Move an email into quarantine.
   */
  async quarantineEmail(caseId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/cases/${caseId}/quarantine`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'User-Agent': 'TraceXMail-TS-SDK/1.0'
      }
    });
    return res.json();
  }
}
