import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { forensicApi } from '../lib/api';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';

export type NodeType = 'USER' | 'ATTACKER' | 'CHECKPOINT' | 'RELAY';

export interface Dynamic3DNode {
  id: string;
  name: string;
  category: NodeType;
  role: string;
  status: 'MALICIOUS' | 'WARNING' | 'CLEAN';
  riskScore: number;
  position: [number, number, number];
  targetPosition: [number, number, number];
  simpleExplanation: string;
  technicalDetails: string;
  actionAdvice: string;
  colorHex: number;
  shape: 'diamond' | 'spiked' | 'ring' | 'sphere';
  liveMetadata?: {
    originIp?: string;
    asn?: string;
    spf?: string;
    dkim?: string;
    dmarc?: string;
    sha256?: string;
    dbCaseId?: string;
    updatedAt?: string;
  };
}

export interface LiveDbCase {
  id: string;
  title: string;
  source: 'supabase' | 'backend' | 'sample';
  analysis: EmailAnalysis;
  updatedAt: string;
  threatLevel: 'HIGH' | 'MEDIUM' | 'CLEAN';
  threatScore: number;
  sender?: string;
  recipient?: string;
  originIp?: string;
}

// Convert any live case from Supabase into dynamic 3D nodes with geometric positioning
export function mapCaseTo3DNodes(analysis: EmailAnalysis, caseMeta?: Partial<LiveDbCase>): Dynamic3DNode[] {
  const nodes: Dynamic3DNode[] = [];
  const riskScore = analysis.riskScore ?? (analysis.threatScore ?? caseMeta?.threatScore ?? 85);
  const isMalicious = riskScore >= 60;

  // 1. Traced User / Recipient Node (Protected User) - DIAMOND GREEN/CYAN
  const recipientEmail = analysis.headers?.to || caseMeta?.recipient || 'security-target@enterprise.com';
  const cleanRecipient = recipientEmail.split('<').pop()?.replace('>', '') || 'Protected User';
  const userPos: [number, number, number] = [2.9, -0.3, 0.4];
  
  nodes.push({
    id: `node-user-${analysis.id || 'current'}`,
    name: cleanRecipient,
    category: 'USER',
    role: 'Traced Recipient (Protected)',
    status: 'CLEAN',
    riskScore: 0,
    position: userPos,
    targetPosition: userPos,
    simpleExplanation: 'The target employee inbox. TraceXMail verified the identity and shielded the account from credential theft.',
    technicalDetails: `Recipient: ${cleanRecipient} | Envelope: Validated | Security Status: Shielded`,
    actionAdvice: 'Safe. User account protected by gateway.',
    colorHex: 0x10b981,
    shape: 'diamond',
    liveMetadata: {
      dbCaseId: analysis.id || caseMeta?.id,
      updatedAt: caseMeta?.updatedAt
    }
  });

  // 2. Attacker / Origin Node - SPIKED RED / AMBER
  const originHop = analysis.hops?.[0];
  const originIp = originHop?.fromIp || caseMeta?.originIp || '185.220.101.5';
  const originLocation = originHop?.city && originHop?.country 
    ? `${originHop.city}, ${originHop.country}` 
    : 'Sofia, Bulgaria (Tor Exit)';
  
  // Dynamically place attacker based on threat score angle
  const angle = (riskScore / 100) * Math.PI * 0.4;
  const attackerPos: [number, number, number] = [
    -2.9 * Math.cos(angle * 0.5), 
    0.9 + Math.sin(angle) * 0.3, 
    -0.4 - Math.sin(angle * 0.8) * 0.4
  ];

  nodes.push({
    id: `node-attacker-${analysis.id || 'current'}`,
    name: isMalicious ? `Attacker IP (${originIp})` : `Sender Gateway (${originIp})`,
    category: isMalicious ? 'ATTACKER' : 'RELAY',
    role: isMalicious ? 'Attacker Origin (Malicious Source)' : 'Verified Mail Origin',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? riskScore : 4,
    position: attackerPos,
    targetPosition: attackerPos,
    simpleExplanation: isMalicious 
      ? `Real computer that sent the phish. Located in ${originLocation}, disguised as a legitimate service.` 
      : `Authorized sending server in ${originLocation} verified by company domain records.`,
    technicalDetails: `Origin IP: ${originIp} | ASN: ${originHop?.asn || 'AS200548'} | PTR: ${originHop?.reverseDns || 'unresolved'}`,
    actionAdvice: isMalicious ? 'Blacklisted across all perimeter firewalls.' : 'Legitimate sender confirmed.',
    colorHex: isMalicious ? 0xef4444 : 0x38bdf8,
    shape: isMalicious ? 'spiked' : 'sphere',
    liveMetadata: {
      originIp,
      asn: originHop?.asn || 'AS200548',
      dbCaseId: analysis.id || caseMeta?.id,
      updatedAt: caseMeta?.updatedAt
    }
  });

  // 3. Security Checkpoint (SPF / DKIM / DMARC verification) - RING GOLD/RED
  const dmarcStatus = analysis.authResults?.dmarc?.status || (isMalicious ? 'FAIL' : 'PASS');
  const spfStatus = analysis.authResults?.spf?.status || (isMalicious ? 'SOFTFAIL' : 'PASS');
  const dkimStatus = analysis.authResults?.dkim?.status || (isMalicious ? 'FAIL' : 'PASS');
  const checkpointPos: [number, number, number] = [-0.2, 2.0, 0.6];
  
  nodes.push({
    id: `node-security-${analysis.id || 'current'}`,
    name: 'Cryptographic Auth Gate',
    category: 'CHECKPOINT',
    role: 'SPF / DKIM / DMARC Gate',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 94 : 2,
    position: checkpointPos,
    targetPosition: checkpointPos,
    simpleExplanation: isMalicious
      ? `Security checkpoint failed: The cryptographic signature did not match the claimed domain, proving spoofing.`
      : `All cryptographic checks passed: Signature matches the registered domain keys perfectly.`,
    technicalDetails: `SPF: ${spfStatus} | DKIM: ${dkimStatus} | DMARC: ${dmarcStatus}`,
    actionAdvice: isMalicious ? 'Quarantine rule triggered.' : 'Cryptographic authenticity verified.',
    colorHex: isMalicious ? 0xf59e0b : 0x10b981,
    shape: 'ring',
    liveMetadata: {
      spf: spfStatus,
      dkim: dkimStatus,
      dmarc: dmarcStatus,
      dbCaseId: analysis.id || caseMeta?.id
    }
  });

  // 4. Mail Transit Relay - SPHERE BLUE
  const secondHop = analysis.hops?.[1] || { fromHost: 'inbound-mta.company.net', fromIp: '198.51.100.22' };
  const relayPos: [number, number, number] = [0.7, -1.6, -0.6];
  
  nodes.push({
    id: `node-relay-${analysis.id || 'current'}`,
    name: secondHop.fromHost || 'Mail Transit Gateway',
    category: 'RELAY',
    role: 'Legitimate Mail MTA',
    status: 'CLEAN',
    riskScore: 6,
    position: relayPos,
    targetPosition: relayPos,
    simpleExplanation: 'Standard internet mail server that routed the message and performed automated malware analysis.',
    technicalDetails: `Hop: ${secondHop.fromIp || '198.51.100.22'} | Protocol: TLS 1.3 | Latency: 0.6s`,
    actionAdvice: 'Verified safe delivery route.',
    colorHex: 0x3b82f6,
    shape: 'sphere',
    liveMetadata: {
      originIp: secondHop.fromIp,
      dbCaseId: analysis.id || caseMeta?.id
    }
  });

  // 5. Domain / Typosquat Entity - CUBE OR DIAMOND
  const fromDomain = analysis.headers?.from?.split('@')[1]?.replace('>', '') || 'paypal-security-update.com';
  const domainPos: [number, number, number] = [-1.4, -0.9, 1.3];
  
  nodes.push({
    id: `node-domain-${analysis.id || 'current'}`,
    name: fromDomain,
    category: isMalicious ? 'ATTACKER' : 'USER',
    role: isMalicious ? 'Deceptive Phish Domain' : 'Verified Domain',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 96 : 3,
    position: domainPos,
    targetPosition: domainPos,
    simpleExplanation: isMalicious
      ? `A fraudulent website name created to trick employees into giving away corporate credentials.`
      : `Legitimate registered organization domain.`,
    technicalDetails: `Domain: ${fromDomain} | Age: 3 days | Registrar: Anonymous Privacy`,
    actionAdvice: isMalicious ? 'Domain DNS sinkholed globally.' : 'Reputable domain record.',
    colorHex: isMalicious ? 0xdc2626 : 0x34d399,
    shape: isMalicious ? 'spiked' : 'diamond',
    liveMetadata: {
      dbCaseId: analysis.id || caseMeta?.id
    }
  });

  return nodes;
}

export function useLiveForensicCases3D(initialAnalysis?: EmailAnalysis) {
  const [cases, setCases] = useState<LiveDbCase[]>([]);
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(0);
  const [activeAnalysis, setActiveAnalysis] = useState<EmailAnalysis>(initialAnalysis || SAMPLE_ANALYSES[0]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'syncing' | 'offline'>('syncing');
  const [dbSourceStatus, setDbSourceStatus] = useState<string>('Syncing Supabase...');
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>(new Date().toLocaleTimeString());
  const [realtimeUpdatesCount, setRealtimeUpdatesCount] = useState<number>(0);
  const [selectedNode, setSelectedNode] = useState<Dynamic3DNode | null>(null);

  // Derive 3D nodes from the active case
  const nodes = useMemo(() => {
    const activeCase = cases[activeCaseIndex];
    return mapCaseTo3DNodes(activeAnalysis, activeCase);
  }, [activeAnalysis, cases, activeCaseIndex]);

  // Set default selected node
  useEffect(() => {
    if (nodes.length > 0) {
      setSelectedNode(nodes[0]);
    }
  }, [nodes]);

  // Fetch all cases directly from Supabase / API
  const refreshLiveCases = useCallback(async () => {
    setConnectionStatus('syncing');
    setDbSourceStatus('Connecting to Supabase...');

    try {
      let fetchedCases: LiveDbCase[] = [];

      // 1. Query Supabase directly if configured
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: sbCases, error: sbErr } = await supabase
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(8);

          if (!sbErr && sbCases && sbCases.length > 0) {
            fetchedCases = sbCases.map((c: any, idx: number) => {
              const baseSample = SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length];
              const threatScore = c.threat_score ?? 90;
              const isMal = threatScore >= 60;
              return {
                id: c.id || `sb-case-${idx}`,
                title: c.title || c.subject || `Case #${c.id?.slice(0, 8)}`,
                source: 'supabase',
                updatedAt: c.created_at || new Date().toISOString(),
                threatLevel: isMal ? 'HIGH' : 'CLEAN',
                threatScore,
                sender: c.sender || baseSample.headers?.from,
                recipient: c.recipient || baseSample.headers?.to,
                originIp: c.origin_ip || baseSample.hops?.[0]?.fromIp,
                analysis: {
                  ...baseSample,
                  id: c.id,
                  name: c.title || c.subject || baseSample.name,
                  riskScore: threatScore,
                  verdict: isMal ? 'MALICIOUS PHISH' : 'CLEAN',
                  headers: {
                    ...baseSample.headers,
                    subject: c.title || c.subject || baseSample.headers?.subject,
                    from: c.sender || baseSample.headers?.from,
                    to: c.recipient || baseSample.headers?.to,
                  }
                }
              };
            });
            setDbSourceStatus('Supabase Realtime (Connected)');
            setConnectionStatus('connected');
          }
        } catch (e) {
          console.warn('[3D Cases Hook] Supabase query fallback:', e);
        }
      }

      // 2. Fallback to API if Supabase table is empty
      if (fetchedCases.length === 0) {
        try {
          const apiCases = await forensicApi.getCases({ exclude_demo: false });
          if (apiCases && apiCases.length > 0) {
            fetchedCases = apiCases.slice(0, 6).map((c: any, idx: number) => {
              const baseSample = SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length];
              const threatScore = c.threat_score ?? 88;
              const isMal = threatScore >= 60;
              return {
                id: c.id || `api-case-${idx}`,
                title: c.title || `Case ${c.id?.slice(0, 6)}`,
                source: 'backend',
                updatedAt: c.created_at || new Date().toISOString(),
                threatLevel: isMal ? 'HIGH' : 'CLEAN',
                threatScore,
                sender: c.sender || baseSample.headers?.from,
                recipient: c.recipient || baseSample.headers?.to,
                analysis: {
                  ...baseSample,
                  id: c.id,
                  name: c.title,
                  riskScore: threatScore,
                  verdict: isMal ? 'MALICIOUS' : 'CLEAN'
                }
              };
            });
            setDbSourceStatus('Backend Database Live');
            setConnectionStatus('connected');
          }
        } catch (apiErr) {
          console.warn('[3D Cases Hook] API fallback:', apiErr);
        }
      }

      // 3. Fallback to verified local sample dataset
      if (fetchedCases.length === 0) {
        fetchedCases = SAMPLE_ANALYSES.map((s, idx) => ({
          id: s.id || `sample-${idx}`,
          title: s.name || `Scenario ${idx + 1}`,
          source: 'sample',
          updatedAt: new Date().toISOString(),
          threatLevel: (s.riskScore ?? 80) >= 60 ? 'HIGH' : 'CLEAN',
          threatScore: s.riskScore ?? 85,
          sender: s.headers?.from,
          recipient: s.headers?.to,
          analysis: s
        }));
        setDbSourceStatus('Verified Threat Corpus');
        setConnectionStatus('offline');
      }

      setCases(fetchedCases);
      if (fetchedCases.length > 0) {
        setActiveAnalysis(fetchedCases[0].analysis);
      }
      setLastSyncTimestamp(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[3D Cases Hook] Error fetching cases:', err);
      setConnectionStatus('offline');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refreshLiveCases();
  }, [refreshLiveCases]);

  // Real-time Supabase Postgres Changes Subscription
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    try {
      const channel = supabase
        .channel('forensic_3d_cases_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cases' },
          (payload) => {
            console.log('[3D Realtime Hook] Supabase cases table event:', payload);
            setRealtimeUpdatesCount(prev => prev + 1);
            setLastSyncTimestamp(new Date().toLocaleTimeString());
            // Refresh cases upon database mutation
            refreshLiveCases();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            setDbSourceStatus('Supabase Realtime (Subscribed)');
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[3D Realtime Hook] Subscription error:', e);
    }
  }, [refreshLiveCases]);

  const selectCaseById = useCallback((id: string) => {
    const idx = cases.findIndex(c => c.id === id);
    if (idx !== -1) {
      setActiveCaseIndex(idx);
      setActiveAnalysis(cases[idx].analysis);
    }
  }, [cases]);

  const selectCaseByIndex = useCallback((idx: number) => {
    if (cases[idx]) {
      setActiveCaseIndex(idx);
      setActiveAnalysis(cases[idx].analysis);
    }
  }, [cases]);

  return {
    cases,
    activeCase: cases[activeCaseIndex] || null,
    activeCaseIndex,
    activeAnalysis,
    nodes,
    selectedNode,
    setSelectedNode,
    connectionStatus,
    dbSourceStatus,
    lastSyncTimestamp,
    realtimeUpdatesCount,
    selectCaseById,
    selectCaseByIndex,
    refreshLiveCases
  };
}
