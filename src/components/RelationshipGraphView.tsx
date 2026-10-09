import React, { useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Mail, 
  Globe, 
  Server, 
  Network, 
  Layers, 
  FileText, 
  ShieldAlert, 
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Lock,
  UserCheck,
  Repeat,
  Compass,
  Filter,
  Eye,
  Info,
  Building2,
  Radio,
  Search,
  Maximize2,
  KeyRound,
  Link as LinkIcon,
  Paperclip,
  QrCode,
  Crosshair,
  User,
  Scale,
  Sparkles,
  Share2,
  AlertOctagon,
  Shield,
  Activity,
  Zap,
  Copy,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  ChevronDown,
  Hash,
  MapPin,
  Users,
  Printer,
  X
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';
import { ShareCaseModal } from './ShareCaseModal';
import { exportEvidenceAsJson, exportEvidenceAsCsv, exportEvidenceAsPdf } from '../utils/exportEvidence';
import { EmailActorD3Graph } from './EmailActorD3Graph';

// Custom Entity Node supporting all forensic evidence types in ReactFlow
const CustomGraphNode = ({ data }: any) => {
  const { 
    type, 
    label, 
    sublabel, 
    riskLevel, 
    isOrigin, 
    isDiverter, 
    isMismatch,
    isPrivate, 
    asn, 
    city, 
    country, 
    hopNumber,
    protocol,
    delaySec,
    isTor,
    isVpn,
    status,
    techniqueId,
    tag,
    selected
  } = data;

  let Icon = FileText;
  let bgClass = "bg-slate-900";
  let borderClass = "border-slate-700";
  let textClass = "text-slate-200";
  let iconClass = "text-slate-400";
  let badgeColor = "bg-slate-800 text-slate-400";

  switch (type) {
    case 'case':
      Icon = ShieldAlert;
      bgClass = riskLevel === 'MALICIOUS PHISH' || riskLevel === 'MALICIOUS' ? 'bg-rose-950/90' : riskLevel === 'SUSPICIOUS' ? 'bg-amber-950/90' : 'bg-emerald-950/90';
      borderClass = riskLevel === 'MALICIOUS PHISH' || riskLevel === 'MALICIOUS' ? 'border-rose-500 ring-2 ring-rose-500/30' : riskLevel === 'SUSPICIOUS' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-emerald-500';
      iconClass = riskLevel === 'MALICIOUS PHISH' || riskLevel === 'MALICIOUS' ? 'text-rose-400' : riskLevel === 'SUSPICIOUS' ? 'text-amber-400' : 'text-emerald-400';
      badgeColor = 'bg-slate-950 text-white font-bold';
      break;

    case 'sender':
      Icon = Mail;
      bgClass = "bg-blue-950/70";
      borderClass = "border-blue-500/60";
      iconClass = "text-blue-400";
      badgeColor = "bg-blue-900/60 text-blue-300";
      break;

    case 'alias':
      Icon = UserCheck;
      bgClass = "bg-indigo-950/70";
      borderClass = "border-indigo-500/60";
      iconClass = "text-indigo-400";
      badgeColor = "bg-indigo-900/60 text-indigo-300";
      break;

    case 'domain':
      Icon = Globe;
      bgClass = isMismatch ? "bg-orange-950/80" : "bg-cyan-950/70";
      borderClass = isMismatch ? "border-orange-500/80" : "border-cyan-500/60";
      iconClass = isMismatch ? "text-orange-400" : "text-cyan-400";
      badgeColor = isMismatch ? "bg-orange-900/80 text-orange-200" : "bg-cyan-900/60 text-cyan-300";
      break;

    case 'reply_to':
      Icon = Repeat;
      bgClass = isDiverter ? "bg-rose-950/85" : "bg-slate-900";
      borderClass = isDiverter ? "border-rose-500/80" : "border-slate-700";
      iconClass = isDiverter ? "text-rose-400" : "text-slate-400";
      badgeColor = isDiverter ? "bg-rose-900/80 text-rose-200" : "bg-slate-800 text-slate-300";
      break;

    case 'return_path':
      Icon = Repeat;
      bgClass = "bg-indigo-950/70";
      borderClass = "border-indigo-500/60";
      iconClass = "text-indigo-400";
      badgeColor = "bg-indigo-900/60 text-indigo-300";
      break;

    case 'dns_mx':
      Icon = Server;
      bgClass = "bg-sky-950/70";
      borderClass = "border-sky-500/60";
      iconClass = "text-sky-400";
      badgeColor = "bg-sky-900/60 text-sky-300";
      break;

    case 'auth_spf':
    case 'auth_dkim':
    case 'auth_dmarc':
      Icon = type === 'auth_spf' ? KeyRound : type === 'auth_dkim' ? CheckCircle2 : Lock;
      if (status === 'PASS') {
        bgClass = "bg-emerald-950/80";
        borderClass = "border-emerald-500/70";
        iconClass = "text-emerald-400";
        badgeColor = "bg-emerald-900/80 text-emerald-200";
      } else {
        bgClass = "bg-rose-950/80";
        borderClass = "border-rose-500/70";
        iconClass = "text-rose-400";
        badgeColor = "bg-rose-900/80 text-rose-200";
      }
      break;

    case 'origin_ip':
    case 'real_sender_ip':
      Icon = Server;
      bgClass = isOrigin ? "bg-rose-950/80" : "bg-cyan-950/80";
      borderClass = isOrigin ? "border-rose-500/90" : "border-cyan-500/80";
      iconClass = isOrigin ? "text-rose-400" : "text-cyan-400";
      badgeColor = isOrigin ? "bg-rose-900/80 text-rose-200 font-bold" : "bg-cyan-900/80 text-cyan-200";
      break;

    case 'relay_hop':
      Icon = Network;
      bgClass = isPrivate ? "bg-slate-950/90" : isOrigin ? "bg-red-950/80" : "bg-slate-900";
      borderClass = isOrigin ? "border-red-500" : isPrivate ? "border-cyan-600/70" : "border-slate-600";
      iconClass = isOrigin ? "text-red-400" : isPrivate ? "text-cyan-400" : "text-slate-300";
      badgeColor = "bg-slate-800 text-slate-300";
      break;

    case 'asn':
      Icon = Building2;
      bgClass = "bg-purple-950/70";
      borderClass = "border-purple-500/70";
      iconClass = "text-purple-400";
      badgeColor = "bg-purple-900/60 text-purple-300";
      break;

    case 'ioc_url':
      Icon = LinkIcon;
      bgClass = status === 'MALICIOUS' ? "bg-rose-950/90" : status === 'SUSPICIOUS' ? "bg-amber-950/80" : "bg-slate-900";
      borderClass = status === 'MALICIOUS' ? "border-rose-500" : status === 'SUSPICIOUS' ? "border-amber-500" : "border-slate-700";
      iconClass = status === 'MALICIOUS' ? "text-rose-400" : status === 'SUSPICIOUS' ? "text-amber-400" : "text-slate-400";
      badgeColor = status === 'MALICIOUS' ? "bg-rose-900/80 text-rose-200 font-bold" : "bg-slate-800 text-slate-300";
      break;

    case 'ioc_attachment':
      Icon = Paperclip;
      bgClass = status === 'MALICIOUS' ? "bg-rose-950/90" : "bg-slate-900";
      borderClass = status === 'MALICIOUS' ? "border-rose-500" : "border-slate-700";
      iconClass = status === 'MALICIOUS' ? "text-rose-400" : "text-slate-300";
      badgeColor = status === 'MALICIOUS' ? "bg-rose-900/80 text-rose-200 font-bold" : "bg-slate-800 text-slate-300";
      break;

    case 'ioc_qr':
      Icon = QrCode;
      bgClass = "bg-amber-950/80";
      borderClass = "border-amber-500";
      iconClass = "text-amber-400";
      badgeColor = "bg-amber-900/80 text-amber-200 font-bold";
      break;

    case 'threat_campaign':
      Icon = Share2;
      bgClass = "bg-fuchsia-950/80";
      borderClass = "border-fuchsia-500/80";
      iconClass = "text-fuchsia-400";
      badgeColor = "bg-fuchsia-900/80 text-fuchsia-200 font-bold";
      break;

    case 'threat_mitre':
      Icon = Crosshair;
      bgClass = "bg-rose-950/80";
      borderClass = "border-rose-600/70";
      iconClass = "text-rose-400";
      badgeColor = "bg-rose-900/70 text-rose-300 font-mono";
      break;

    case 'compliance':
      Icon = Scale;
      bgClass = "bg-purple-950/80";
      borderClass = "border-purple-600/70";
      iconClass = "text-purple-400";
      badgeColor = "bg-purple-900/70 text-purple-300";
      break;

    case 'soc_analyst':
      Icon = User;
      bgClass = "bg-blue-950/70";
      borderClass = "border-blue-500/70";
      iconClass = "text-blue-400";
      badgeColor = "bg-blue-900/60 text-blue-300";
      break;

    case 'recipient':
      Icon = CheckCircle2;
      bgClass = "bg-emerald-950/70";
      borderClass = "border-emerald-500/80";
      iconClass = "text-emerald-400";
      badgeColor = "bg-emerald-900/60 text-emerald-300";
      break;
  }

  return (
    <div
      className={`relative px-3.5 py-2.5 rounded-xl border ${bgClass} ${borderClass} shadow-xl flex flex-col gap-1 min-w-[190px] max-w-[280px] transition-all duration-150 ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950 scale-105' : 'hover:scale-[1.02]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className={`p-1 rounded-md bg-slate-950/60 ${iconClass}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400">
            {type.replace('_', ' ')}
          </span>
        </div>

        {hopNumber !== undefined && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
            Hop #{hopNumber}
          </span>
        )}

        {isOrigin && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold animate-pulse">
            ORIGIN
          </span>
        )}

        {status && (
          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${badgeColor}`}>
            {status}
          </span>
        )}

        {techniqueId && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-rose-300 border border-rose-800 font-bold">
            {techniqueId}
          </span>
        )}
      </div>

      {/* Main Label */}
      <div className={`text-xs font-bold font-mono truncate ${textClass} mt-0.5`} title={label}>
        {label}
      </div>

      {/* Secondary Meta Sublabel */}
      {sublabel && (
        <div className="text-[10px] text-slate-400 truncate" title={sublabel}>
          {sublabel}
        </div>
      )}

      {/* Geo / ASN / Protocol / Threat Flags */}
      <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/80">
        {city && country && (
          <span className="text-[9px] text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[140px]">
            📍 {city}, {country}
          </span>
        )}

        {asn && (
          <span className="text-[9px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60 truncate max-w-[120px]">
            {asn}
          </span>
        )}

        {isPrivate && (
          <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
            RFC 1918
          </span>
        )}

        {isTor && (
          <span className="text-[9px] font-mono text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
            TOR EXIT
          </span>
        )}

        {isDiverter && (
          <span className="text-[9px] font-mono text-rose-300 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800 font-bold">
            DECEPTIVE DIVERT
          </span>
        )}

        {isMismatch && (
          <span className="text-[9px] font-mono text-orange-300 bg-orange-950 px-1.5 py-0.5 rounded border border-orange-800 font-bold">
            DOMAIN MISMATCH
          </span>
        )}

        {tag && (
          <span className="text-[9px] font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
            {tag}
          </span>
        )}

        {delaySec !== undefined && delaySec > 0 && (
          <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
            +{delaySec}s
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />
    </div>
  );
};

const nodeTypes = {
  entity: CustomGraphNode
};

interface RelationshipGraphViewProps {
  caseId?: string;
  analysis?: EmailAnalysis;
  onSelectNode?: (entityData: any) => void;
}

export function RelationshipGraphView({ 
  caseId, 
  analysis,
  onSelectNode 
}: RelationshipGraphViewProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'constellation' | 'd3_actors' | 'all_evidence' | 'relay_pipeline' | 'iocs_threats' | 'auth_identity'>('constellation');
  const [hidePrivateHops, setHidePrivateHops] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeConstellationNode, setActiveConstellationNode] = useState<string>('email');
  const [copiedId, setCopiedId] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const effectiveAnalysis = analysis;

  // Synthesize Comprehensive Evidence Relationship Graph for ReactFlow views
  useEffect(() => {
    if (!effectiveAnalysis) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const hops = effectiveAnalysis.hops || [];
    const filteredHops = hidePrivateHops ? hops.filter(h => !h.isPrivate) : hops;

    // 1. Core Case Node (Central Evidence Anchor)
    const effectiveCaseId = caseId || effectiveAnalysis.id || 'CASE-FORENSIC-01';
    const effectiveVerdict = effectiveAnalysis.threatVerdict || effectiveAnalysis.verdict || 'SUSPICIOUS';
    const effectiveScore = effectiveAnalysis.threatScore ?? effectiveAnalysis.riskScore ?? 0;
    const effectiveSubject = effectiveAnalysis.headers?.subject || effectiveAnalysis.subject || 'Forensic Evidence Ingestion';

    newNodes.push({
      id: 'node-case',
      type: 'entity',
      position: { x: 420, y: 30 },
      data: {
        type: 'case',
        label: `CASE: ${effectiveCaseId}`,
        sublabel: effectiveSubject,
        riskLevel: effectiveVerdict,
        status: `${effectiveVerdict} (${effectiveScore}/100)`,
        tag: `SHA-256: ${(effectiveAnalysis.sha256Hash || effectiveAnalysis.sha256 || 'TAMPER-PROOF').slice(0, 10)}...`
      }
    });

    // 2. Sender Node
    const senderEmail = effectiveAnalysis.headers?.fromEmail || effectiveAnalysis.from || 'sender@unknown.com';
    const senderMatch = senderEmail.match(/^(.*?)(?:<(.+?)>)?$/);
    const senderName = effectiveAnalysis.headers?.fromName || (senderMatch && senderMatch[2] ? senderMatch[1].trim() : '');
    const cleanSenderAddr = senderMatch && senderMatch[2] ? senderMatch[2].trim() : senderEmail;
    const senderDomain = cleanSenderAddr.includes('@') ? cleanSenderAddr.split('@')[1] : 'unknown-domain.com';

    newNodes.push({
      id: 'node-sender',
      type: 'entity',
      position: { x: 120, y: 160 },
      data: {
        type: 'sender',
        label: cleanSenderAddr,
        sublabel: senderName ? `Display: "${senderName}"` : 'Direct Header Sender',
        status: effectiveVerdict === 'MALICIOUS PHISH' || effectiveVerdict === 'MALICIOUS' ? 'FLAGGED' : 'OBSERVED',
        tag: 'ENVELOPE SENDER'
      }
    });

    newEdges.push({
      id: 'edge-case-sender',
      source: 'node-case',
      target: 'node-sender',
      label: 'CLAIMED SENDER',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 1.5 }
    });

    // 3. Sender Domain Node
    newNodes.push({
      id: 'node-domain',
      type: 'entity',
      position: { x: 120, y: 300 },
      data: {
        type: 'domain',
        label: senderDomain,
        sublabel: effectiveAnalysis.domain_intelligence?.registrar ? `Registrar: ${effectiveAnalysis.domain_intelligence.registrar}` : 'Registered Domain',
        status: effectiveAnalysis.domain_intelligence?.is_newly_registered ? 'NEW REG' : 'ESTABLISHED',
        tag: effectiveAnalysis.domain_intelligence?.domain_age_days ? `AGE: ${effectiveAnalysis.domain_intelligence.domain_age_days}d` : 'DNS DOMAIN'
      }
    });

    newEdges.push({
      id: 'edge-sender-domain',
      source: 'node-sender',
      target: 'node-domain',
      label: 'RESOLVES TO',
      style: { stroke: '#06b6d4', strokeWidth: 1.5 }
    });

    // 4. Return-Path Node
    const returnPath = effectiveAnalysis.headers?.returnPath || effectiveAnalysis.headers?.['return-path'] || effectiveAnalysis.returnPath;
    if (returnPath) {
      const cleanReturn = returnPath.replace(/[<>]/g, '').trim();
      const returnDomain = cleanReturn.includes('@') ? cleanReturn.split('@')[1] : cleanReturn;
      const isMismatch = returnDomain.toLowerCase() !== senderDomain.toLowerCase();

      newNodes.push({
        id: 'node-return-path',
        type: 'entity',
        position: { x: -140, y: 160 },
        data: {
          type: 'return_path',
          label: cleanReturn,
          sublabel: isMismatch ? `MISMATCH with ${senderDomain}` : 'Aligned Envelope Header',
          isMismatch,
          status: isMismatch ? 'MISMATCH' : 'ALIGNED',
          tag: 'BOUNCE PATH'
        }
      });

      newEdges.push({
        id: 'edge-sender-return',
        source: 'node-sender',
        target: 'node-return-path',
        label: isMismatch ? 'BOUNCE DIVERGENCE' : 'BOUNCE ADDRESS',
        style: { stroke: isMismatch ? '#f97316' : '#6366f1', strokeWidth: 1.5, strokeDasharray: isMismatch ? '4,4' : undefined }
      });
    }

    // 5. Reply-To Node
    const replyTo = effectiveAnalysis.headers?.replyTo || effectiveAnalysis.headers?.['reply-to'];
    if (replyTo && replyTo !== senderEmail) {
      const cleanReply = replyTo.replace(/[<>]/g, '').trim();
      newNodes.push({
        id: 'node-reply-to',
        type: 'entity',
        position: { x: -140, y: 300 },
        data: {
          type: 'reply_to',
          label: cleanReply,
          sublabel: 'Header reply recipient differs from sender',
          isDiverter: true,
          status: 'DIVERTED',
          tag: 'DECEPTIVE DIVERT'
        }
      });

      newEdges.push({
        id: 'edge-sender-replyto',
        source: 'node-sender',
        target: 'node-reply-to',
        label: 'DECEPTIVE REDIRECT',
        animated: true,
        style: { stroke: '#ef4444', strokeWidth: 2 }
      });
    }

    // 6. Cryptographic Authentication Nodes (SPF, DKIM, DMARC)
    const spfVal = effectiveAnalysis.authResults?.spf?.status || (typeof effectiveAnalysis.auth?.spf === 'string' ? effectiveAnalysis.auth?.spf : effectiveAnalysis.auth?.spf?.status) || 'PASS';
    newNodes.push({
      id: 'node-auth-spf',
      type: 'entity',
      position: { x: 380, y: 190 },
      data: {
        type: 'auth_spf',
        label: `SPF: ${spfVal}`,
        sublabel: `Envelope authorization check`,
        status: String(spfVal).toUpperCase(),
        tag: 'RFC 7208'
      }
    });
    newEdges.push({
      id: 'edge-domain-spf',
      source: 'node-domain',
      target: 'node-auth-spf',
      label: 'ENVELOPE POLICY',
      style: { stroke: spfVal === 'PASS' ? '#10b981' : '#ef4444', strokeWidth: 1.5 }
    });

    const dkimVal = effectiveAnalysis.authResults?.dkim?.status || (typeof effectiveAnalysis.auth?.dkim === 'string' ? effectiveAnalysis.auth?.dkim : effectiveAnalysis.auth?.dkim?.status) || 'PASS';
    newNodes.push({
      id: 'node-auth-dkim',
      type: 'entity',
      position: { x: 580, y: 190 },
      data: {
        type: 'auth_dkim',
        label: `DKIM: ${dkimVal}`,
        sublabel: `Cryptographic body & header signature`,
        status: String(dkimVal).toUpperCase(),
        tag: 'RFC 6376'
      }
    });
    newEdges.push({
      id: 'edge-case-dkim',
      source: 'node-case',
      target: 'node-auth-dkim',
      label: 'CRYPTO SIGNATURE',
      style: { stroke: dkimVal === 'PASS' ? '#10b981' : '#ef4444', strokeWidth: 1.5 }
    });

    const dmarcVal = effectiveAnalysis.authResults?.dmarc?.status || (typeof effectiveAnalysis.auth?.dmarc === 'string' ? effectiveAnalysis.auth?.dmarc : effectiveAnalysis.auth?.dmarc?.status) || 'PASS';
    newNodes.push({
      id: 'node-auth-dmarc',
      type: 'entity',
      position: { x: 480, y: 290 },
      data: {
        type: 'auth_dmarc',
        label: `DMARC: ${dmarcVal}`,
        sublabel: `Sender domain alignment & enforcement`,
        status: String(dmarcVal).toUpperCase(),
        tag: 'RFC 7489'
      }
    });
    newEdges.push({
      id: 'edge-domain-dmarc',
      source: 'node-domain',
      target: 'node-auth-dmarc',
      label: 'DOMAIN ENFORCEMENT',
      style: { stroke: dmarcVal === 'PASS' ? '#10b981' : '#ef4444', strokeWidth: 1.5 }
    });

    // 7. Transmission Hop Nodes (DAG Pipeline)
    let prevHopNodeId: string | null = null;
    filteredHops.forEach((h: EmailHop, idx: number) => {
      const hopNodeId = `node-hop-${idx + 1}`;
      const hopX = 350 + (idx * 220);
      const hopY = 430;

      newNodes.push({
        id: hopNodeId,
        type: 'entity',
        position: { x: hopX, y: hopY },
        data: {
          type: 'relay_hop',
          label: h.fromIp || `Relay #${idx + 1}`,
          sublabel: h.byHost || h.fromHost || `Hop Index ${idx + 1}`,
          hopNumber: idx + 1,
          isOrigin: h.isOrigin,
          isPrivate: h.isPrivate,
          city: h.city,
          country: h.country,
          asn: h.asn,
          delaySec: h.delaySec ?? (h as any).delay,
          isTor: h.is_tor,
          status: h.isOrigin ? 'ORIGIN' : h.is_tor ? 'TOR RELAY' : h.isPrivate ? 'PRIVATE' : 'PUBLIC'
        }
      });

      if (prevHopNodeId) {
        const hopDelay = h.delaySec ?? (h as any).delay;
        newEdges.push({
          id: `edge-${prevHopNodeId}-${hopNodeId}`,
          source: prevHopNodeId,
          target: hopNodeId,
          label: hopDelay ? `+${hopDelay}s DELAY` : 'SMTP HANDOFF',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' },
          style: { stroke: '#38bdf8', strokeWidth: 2 }
        });
      } else {
        newEdges.push({
          id: `edge-sender-${hopNodeId}`,
          source: 'node-sender',
          target: hopNodeId,
          label: 'ORIGIN INGRESS',
          animated: true,
          style: { stroke: '#f43f5e', strokeWidth: 2 }
        });
      }
      prevHopNodeId = hopNodeId;
    });

    // 8. Ingress Recipient Mailbox Node
    const recipientAddr = effectiveAnalysis.headers?.to || effectiveAnalysis.to || 'recipient@internal.corp';
    const recX = 350 + (filteredHops.length * 220);
    const recY = 430;
    newNodes.push({
      id: 'node-recipient',
      type: 'entity',
      position: { x: recX, y: recY },
      data: {
        type: 'recipient',
        label: recipientAddr,
        sublabel: 'Target Corporate Mailbox',
        status: 'DELIVERED',
        tag: 'INGRESS MAILBOX'
      }
    });

    if (prevHopNodeId) {
      newEdges.push({
        id: `edge-${prevHopNodeId}-recipient`,
        source: prevHopNodeId,
        target: 'node-recipient',
        label: 'LOCAL DELIVERY',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        style: { stroke: '#10b981', strokeWidth: 2 }
      });
    }

    // 9. Weaponized IOCs & Indicators
    (effectiveAnalysis.urls || []).slice(0, 3).forEach((u, i) => {
      const urlNodeId = `node-ioc-url-${i}`;
      newNodes.push({
        id: urlNodeId,
        type: 'entity',
        position: { x: 740, y: 60 + (i * 90) },
        data: {
          type: 'ioc_url',
          label: u.domain || u.url,
          sublabel: u.url.length > 34 ? `${u.url.slice(0, 32)}...` : u.url,
          status: u.status || 'MALICIOUS',
          tag: u.virustotalScore ? `VT: ${u.virustotalScore}` : 'URL IOC'
        }
      });
      newEdges.push({
        id: `edge-case-${urlNodeId}`,
        source: 'node-case',
        target: urlNodeId,
        label: 'PAYLOAD LINK',
        style: { stroke: '#ef4444', strokeWidth: 1.8 }
      });
    });

    // 10. Attachments IOCs
    (effectiveAnalysis.attachments || []).slice(0, 2).forEach((att, i) => {
      const attNodeId = `node-ioc-att-${i}`;
      newNodes.push({
        id: attNodeId,
        type: 'entity',
        position: { x: 740, y: 340 + (i * 90) },
        data: {
          type: 'ioc_attachment',
          label: att.filename,
          sublabel: `SHA-256: ${(att.sha256 || 'N/A').slice(0, 14)}...`,
          status: att.status || 'MALICIOUS',
          tag: att.vtDetection || 'ATTACHMENT'
        }
      });
      newEdges.push({
        id: `edge-case-${attNodeId}`,
        source: 'node-case',
        target: attNodeId,
        label: 'EMBEDDED FILE',
        style: { stroke: '#ef4444', strokeWidth: 1.8 }
      });
    });

    // 11. Campaign Cluster Node
    const campaignName = effectiveAnalysis.campaign_name || effectiveAnalysis.campaign_id || 'CAMP-2026-FIN-091';
    newNodes.push({
      id: 'node-campaign',
      type: 'entity',
      position: { x: 120, y: 20 },
      data: {
        type: 'threat_campaign',
        label: campaignName,
        sublabel: 'Correlated Phishing Campaign Cluster',
        status: 'CORRELATED',
        tag: 'CLUSTER INTEL'
      }
    });
    newEdges.push({
      id: 'edge-case-campaign',
      source: 'node-case',
      target: 'node-campaign',
      label: 'CAMPAIGN CLUSTER',
      style: { stroke: '#d946ef', strokeWidth: 1.8 }
    });

    // Filter by viewMode presets
    let finalNodes = newNodes;
    let finalEdges = newEdges;

    if (viewMode === 'relay_pipeline') {
      const allowedTypes = ['sender', 'relay_hop', 'asn', 'recipient'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      finalEdges = newEdges.filter(e => e.id.startsWith('edge-node-hop') || e.id.includes('sender') || e.id.includes('recipient'));
    } else if (viewMode === 'iocs_threats') {
      const allowedTypes = ['case', 'ioc_url', 'ioc_attachment', 'ioc_qr', 'threat_campaign', 'threat_mitre'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      finalEdges = newEdges.filter(e => finalNodes.some(fn => fn.id === e.source) && finalNodes.some(fn => fn.id === e.target));
    } else if (viewMode === 'auth_identity') {
      const allowedTypes = ['case', 'sender', 'alias', 'domain', 'return_path', 'reply_to', 'auth_spf', 'auth_dkim', 'auth_dmarc'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      finalEdges = newEdges.filter(e => finalNodes.some(fn => fn.id === e.source) && finalNodes.some(fn => fn.id === e.target));
    }

    // Filter by live text query
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      finalNodes = finalNodes.filter(n => 
        String(n.data?.label || '').toLowerCase().includes(q) ||
        String(n.data?.sublabel || '').toLowerCase().includes(q) ||
        String(n.data?.type || '').toLowerCase().includes(q)
      );
      const remainingIds = new Set(finalNodes.map(n => n.id));
      finalEdges = finalEdges.filter(e => remainingIds.has(e.source) && remainingIds.has(e.target));
    }

    setNodes(finalNodes);
    setEdges(finalEdges);
  }, [effectiveAnalysis, caseId, viewMode, hidePrivateHops, searchFilter]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedEntity({ type: 'node', data: node.data });
    setIsDossierOpen(true);
    if (onSelectNode) onSelectNode(node.data);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEntity({ type: 'edge', data: edge.data, label: edge.label });
    setIsDossierOpen(true);
  };

  // -------------------------------------------------------------
  // Constellation Graph Data & Calculations (Matching Reference Image)
  // -------------------------------------------------------------
  const constellationData = useMemo(() => {
    if (!effectiveAnalysis) return null;

    const hops = effectiveAnalysis.hops || [];
    const firstHop = hops[0];
    const originIp = firstHop?.fromIp || effectiveAnalysis.realSenderIp?.ip || '185.220.101.4';
    const originLoc = firstHop ? [firstHop.city, firstHop.country].filter(Boolean).join(', ') : 'Unknown Geo';

    const senderEmail = effectiveAnalysis.headers?.fromEmail || effectiveAnalysis.from || 'unknown@domain.com';
    const cleanSender = senderEmail.replace(/[<>]/g, '').trim();
    const senderDomain = cleanSender.includes('@') ? cleanSender.split('@')[1] : 'domain.com';
    const recipientEmail = effectiveAnalysis.headers?.to || effectiveAnalysis.to || 'recipient@corp.internal';

    const urlsCount = (effectiveAnalysis.urls || []).length;
    const attsCount = (effectiveAnalysis.attachments || []).length;
    const indicatorCount = urlsCount + attsCount;

    const campaignCluster = effectiveAnalysis.campaign_name || effectiveAnalysis.campaign_id || (effectiveAnalysis.correlationEvidence?.length ? 'CAMP-2026-OCT-01' : 'CAMP-2026-FIN-091');
    const infraAsn = firstHop?.asn || 'AS208294';
    const relayCount = hops.length || 1;

    const verdict = effectiveAnalysis.threatVerdict || effectiveAnalysis.verdict || 'SUSPICIOUS';
    const score = effectiveAnalysis.threatScore ?? effectiveAnalysis.riskScore ?? 0;
    const subject = effectiveAnalysis.headers?.subject || effectiveAnalysis.subject || '(No Subject)';
    const assignedUser = effectiveAnalysis.assigned_user || effectiveAnalysis.assignedUser || effectiveAnalysis.user_email || 'Jayaram Sappa';

    // Satellite definitions mapping 1-to-1 to the user's reference image
    const nodesMap: Record<string, {
      id: string;
      title: string;
      x: number;
      y: number;
      value: string;
      secondary: string;
      status: 'danger' | 'warning' | 'clean' | 'info';
      countBadge?: string;
    }> = {
      email: {
        id: 'email',
        title: 'Email',
        x: 480,
        y: 320,
        value: subject,
        secondary: `${verdict} • Risk: ${score}/100`,
        status: verdict.includes('MALICIOUS') ? 'danger' : verdict.includes('SUSPICIOUS') ? 'warning' : 'clean'
      },
      ip: {
        id: 'ip',
        title: 'IP',
        x: 410,
        y: 130,
        value: originIp,
        secondary: `${originLoc} (${firstHop?.isp || 'Tor Exit Relay'})`,
        status: firstHop?.is_tor || firstHop?.abuseScore ? 'danger' : 'info',
        countBadge: firstHop?.is_tor ? 'TOR' : 'FIRST HOP'
      },
      infrastructure: {
        id: 'infrastructure',
        title: 'Infrastructure',
        x: 680,
        y: 180,
        value: `${relayCount} Relay Hops`,
        secondary: `${infraAsn} • MX & Transit Gateways`,
        status: 'info',
        countBadge: `${relayCount} Hops`
      },
      indicator: {
        id: 'indicator',
        title: 'Indicator',
        x: 800,
        y: 330,
        value: `${indicatorCount} Threat IOCs`,
        secondary: `${urlsCount} URLs • ${attsCount} Attachments`,
        status: indicatorCount > 0 ? 'danger' : 'clean',
        countBadge: `${indicatorCount} IOCs`
      },
      campaign: {
        id: 'campaign',
        title: 'Campaign',
        x: 670,
        y: 490,
        value: campaignCluster,
        secondary: 'Cross-Case Threat Correlation',
        status: campaignCluster.includes('CAMP-') ? 'danger' : 'info',
        countBadge: 'CLUSTER'
      },
      recipient: {
        id: 'recipient',
        title: 'Recipient',
        x: 400,
        y: 530,
        value: recipientEmail,
        secondary: 'Target Ingress Mailbox',
        status: 'clean',
        countBadge: 'INBOX'
      },
      sender: {
        id: 'sender',
        title: 'Sender',
        x: 180,
        y: 430,
        value: cleanSender,
        secondary: effectiveAnalysis.headers?.fromName ? `Alias: ${effectiveAnalysis.headers.fromName}` : 'Envelope Author',
        status: verdict.includes('MALICIOUS') ? 'danger' : 'warning',
        countBadge: 'FROM'
      },
      domain: {
        id: 'domain',
        title: 'Domain',
        x: 190,
        y: 240,
        value: senderDomain,
        secondary: effectiveAnalysis.domain_intelligence?.domain_age_days ? `Age: ${effectiveAnalysis.domain_intelligence.domain_age_days}d` : 'Registrar Verified',
        status: effectiveAnalysis.domain_intelligence?.is_newly_registered ? 'danger' : 'info',
        countBadge: 'WHOIS'
      }
    };

    // Connections: Radial rays from Email + Perimeter Polygon chords
    const connections: Array<[string, string]> = [
      // Central spokes
      ['email', 'ip'],
      ['email', 'infrastructure'],
      ['email', 'indicator'],
      ['email', 'campaign'],
      ['email', 'recipient'],
      ['email', 'sender'],
      ['email', 'domain'],
      // Outer perimeter web
      ['domain', 'ip'],
      ['ip', 'infrastructure'],
      ['infrastructure', 'indicator'],
      ['indicator', 'campaign'],
      ['campaign', 'recipient'],
      ['recipient', 'sender'],
      ['sender', 'domain']
    ];

    const spfStatus = effectiveAnalysis.authResults?.spf?.status || (typeof effectiveAnalysis.auth?.spf === 'string' ? effectiveAnalysis.auth?.spf : effectiveAnalysis.auth?.spf?.status) || 'PASS';
    const dkimStatus = effectiveAnalysis.authResults?.dkim?.status || (typeof effectiveAnalysis.auth?.dkim === 'string' ? effectiveAnalysis.auth?.dkim : effectiveAnalysis.auth?.dkim?.status) || 'PASS';
    const dmarcStatus = effectiveAnalysis.authResults?.dmarc?.status || (typeof effectiveAnalysis.auth?.dmarc === 'string' ? effectiveAnalysis.auth?.dmarc : effectiveAnalysis.auth?.dmarc?.status) || 'PASS';

    return {
      nodesMap,
      connections,
      summary: {
        verdict,
        score,
        subject,
        cleanSender,
        originIp,
        originLoc,
        campaignCluster,
        assignedUser,
        authStatus: `SPF: ${spfStatus} • DKIM: ${dkimStatus} • DMARC: ${dmarcStatus}`
      }
    };
  }, [effectiveAnalysis]);

  // Handle node selection in constellation
  const handleSelectConstellationNode = (nodeId: string) => {
    setActiveConstellationNode(nodeId);
    setIsDossierOpen(true);
    if (!constellationData) return;
    const n = constellationData.nodesMap[nodeId];
    if (n) {
      setSelectedEntity({
        type: 'node',
        data: {
          type: n.title.toLowerCase(),
          label: n.value,
          sublabel: n.secondary,
          status: n.countBadge || n.status
        }
      });
      if (onSelectNode) {
        onSelectNode({
          type: n.title.toLowerCase(),
          label: n.value,
          sublabel: n.secondary
        });
      }
    }
  };

  const handleCopyIdentifier = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleExportJson = () => {
    try {
      exportEvidenceAsJson(effectiveAnalysis, {
        caseId: caseId || effectiveAnalysis?.id,
        evidenceId: effectiveAnalysis?.evidenceId
      });
    } catch (err) {
      console.error('Failed to export graph evidence as JSON:', err);
    }
  };

  const handleExportCsv = () => {
    try {
      exportEvidenceAsCsv(effectiveAnalysis, {
        caseId: caseId || effectiveAnalysis?.id,
        evidenceId: effectiveAnalysis?.evidenceId
      });
    } catch (err) {
      console.error('Failed to export graph evidence as CSV:', err);
    }
  };

  const handleExportPdf = () => {
    try {
      setExportingPdf(true);
      exportEvidenceAsPdf(null, `TraceXMail-Evidence-${currentCaseId}.pdf`, {
        analysis: effectiveAnalysis,
        caseId: caseId || effectiveAnalysis?.id,
        evidenceId: effectiveAnalysis?.evidenceId
      });
    } catch (err) {
      console.error('Failed to export graph evidence as PDF:', err);
    } finally {
      setTimeout(() => setExportingPdf(false), 1200);
    }
  };

  const currentCaseId = caseId || effectiveAnalysis?.id || 'CASE-2026-0881';
  const currentVerdict = effectiveAnalysis?.threatVerdict || effectiveAnalysis?.verdict || 'SUSPICIOUS';
  const currentScore = effectiveAnalysis?.threatScore ?? effectiveAnalysis?.riskScore ?? 85;
  const isMalicious = currentVerdict.toUpperCase().includes('MALICIOUS');
  const isSuspicious = currentVerdict.toUpperCase().includes('SUSPICIOUS');
  const assignedLead = effectiveAnalysis?.assigned_user || effectiveAnalysis?.assignedUser || effectiveAnalysis?.user_email || 'Jayaram Sappa';

  const hops = effectiveAnalysis?.hops || [];
  const firstHop = hops.find(h => h.isOrigin) || hops[0];
  const originIp = firstHop?.fromIp || effectiveAnalysis?.realSenderIp?.ip || '185.220.101.4';
  const originLocation = firstHop ? [firstHop.city, firstHop.country].filter(Boolean).join(', ') : 'Sofia, Bulgaria';
  const originAsn = firstHop?.asn || 'AS208294 (ZettaHost)';
  const originDelay = firstHop?.delaySec ?? (firstHop as any)?.delay ?? 2.4;

  const spfStatus = effectiveAnalysis?.authResults?.spf?.status || (typeof effectiveAnalysis?.auth?.spf === 'string' ? effectiveAnalysis?.auth?.spf : effectiveAnalysis?.auth?.spf?.status) || 'PASS';
  const dkimStatus = effectiveAnalysis?.authResults?.dkim?.status || (typeof effectiveAnalysis?.auth?.dkim === 'string' ? effectiveAnalysis?.auth?.dkim : effectiveAnalysis?.auth?.dkim?.status) || 'PASS';
  const dmarcStatus = effectiveAnalysis?.authResults?.dmarc?.status || (typeof effectiveAnalysis?.auth?.dmarc === 'string' ? effectiveAnalysis?.auth?.dmarc : effectiveAnalysis?.auth?.dmarc?.status) || 'PASS';

  const campaignName = effectiveAnalysis?.campaign_name || effectiveAnalysis?.campaign_id || 'CAMP-2026-FIN-091';
  const campaignSimilarity = (effectiveAnalysis as any)?.campaignSimilarity || 94;

  const sha256Digest = effectiveAnalysis?.sha256Hash || effectiveAnalysis?.sha256 || 'e8f12b9d283c4f7a1928374a5b6c7d8e9f0123456789abcdef0123456789abcd';

  return (
    <div className="relative h-full min-h-[640px] bg-[#080d17] rounded-2xl border border-[#162338] overflow-hidden flex flex-col shadow-2xl">
      {/* Top Forensic Toolbar - Similarly Organized with Evidence Identification, Badges & Controls */}
      <div className="px-5 py-3 border-b border-[#162338] bg-[#0b1220]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/40">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Threat Infrastructure &amp; Evidence Graph</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101b2e] border border-[#213554] text-cyan-300 font-bold">
                {currentCaseId}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                isMalicious 
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300 animate-pulse' 
                  : isSuspicious 
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300' 
                  : 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isMalicious ? 'bg-rose-400' : isSuspicious ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span>SEV: {isMalicious ? 'CRITICAL' : isSuspicious ? 'HIGH' : 'LOW'}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-mono tracking-wider">
                {viewMode === 'constellation' ? '8 CONSTELLATION NODES' : `${nodes.length} EVIDENCE NODES • ${edges.length} RELATIONS`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Interactive relationship network connecting email entity, origin IPs, infrastructure, IOC indicators &amp; campaign clusters
            </p>
          </div>
        </div>

        {/* View Mode Switches, Search Bar & Utility Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search evidence / IOCs..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-40"
            />
          </div>

          {/* Toggle View Layout Preset */}
          <div className="flex items-center rounded-lg bg-[#0e1626] border border-[#1b2b44] p-0.5">
            <button
              onClick={() => setViewMode('constellation')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'constellation'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Forensic Constellation View matching system threat network"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-300" />
              <span>Constellation</span>
            </button>
            <button
              onClick={() => setViewMode('d3_actors')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'd3_actors'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60'
                  : 'text-indigo-400 hover:text-indigo-200 bg-indigo-950/40 border border-indigo-800/50'
              }`}
              title="D3.js Dynamic Mail Hop Actor Graph"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-300" />
              <span>D3 Actor Flow</span>
            </button>
            <button
              onClick={() => setViewMode('all_evidence')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'all_evidence'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="All Evidence 360° Network"
            >
              All Evidence
            </button>
            <button
              onClick={() => setViewMode('relay_pipeline')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'relay_pipeline'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Transmission Route DAG"
            >
              Relay Route
            </button>
            <button
              onClick={() => setViewMode('iocs_threats')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'iocs_threats'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Observed IOCs & Payloads"
            >
              IOCs &amp; Threats
            </button>
          </div>

          {/* Toggle Evidence Dossier Drawer */}
          <button
            onClick={() => setIsDossierOpen(!isDossierOpen)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              isDossierOpen
                ? 'bg-cyan-950/80 border-cyan-600 text-cyan-200 shadow-sm shadow-cyan-950/50'
                : 'bg-[#101b2e] border-[#1b2b44] text-slate-300 hover:text-slate-100 hover:border-slate-600'
            }`}
            title="Toggle Forensic Evidence Dossier & Telemetry Inspector"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Evidence Dossier</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isDossierOpen ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          </button>

          {/* Export JSON / CSV Dropdown */}
          <div className="relative inline-block text-left">
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="px-2.5 py-1.5 rounded-lg border bg-[#101b2e] border-[#1b2b44] text-slate-300 hover:text-slate-100 hover:border-slate-600 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Export Forensic Telemetry as JSON, CSV, or PDF"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportDropdownOpen && (
              <div 
                className="absolute right-0 mt-1 w-48 rounded-xl shadow-2xl bg-[#0f172a] border border-[#223652] py-1.5 z-50 text-xs font-mono animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-[#1b2b44] mb-1">
                  Export Case Data
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    handleExportJson();
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#1b2b44] text-slate-200 hover:text-cyan-300 cursor-pointer transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Export JSON</span>
                    <span className="text-[9px] text-slate-400">Full forensic dossier</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    handleExportCsv();
                  }}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#1b2b44] text-slate-200 hover:text-emerald-300 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Export CSV</span>
                    <span className="text-[9px] text-slate-400">RFC 4180 spreadsheet</span>
                  </div>
                </button>
                <div className="my-1 border-t border-[#1b2b44]" />
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    handleExportPdf();
                  }}
                  disabled={exportingPdf}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#1b2b44] text-slate-300 hover:text-amber-300 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px]">{exportingPdf ? 'Generating PDF...' : 'Export PDF Dossier'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Share Case Button */}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg border bg-[#101b2e] border-[#1b2b44] text-cyan-300 hover:text-cyan-100 hover:border-cyan-600 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Generate secure, temporary link for internal team collaboration"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Share Case</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area + Side Organized Evidence Inspector Drawer */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* ======================================================== */}
        {/* 1. CONSTELLATION GRAPH VIEW (Exact Match to User Reference) */}
        {/* ======================================================== */}
        {viewMode === 'constellation' && constellationData && (
          <div className="flex-1 h-full relative overflow-hidden flex items-center justify-center select-none bg-[#070b14]">
            {/* Subtle Forensic Background Watermark */}
            <div className="absolute bottom-6 left-8 text-4xl font-display font-black tracking-widest text-[#111e33]/50 uppercase select-none pointer-events-none">
              Forensic
            </div>

            {/* SVG Constellation Network Canvas */}
            <svg 
              viewBox="0 0 960 620" 
              className="w-full h-full max-w-[1200px] max-h-[760px] pointer-events-auto"
            >
              <defs>
                {/* Dark Blueprint Grid Pattern */}
                <pattern id="constellation-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#10192a" strokeWidth="0.8" />
                </pattern>
                
                {/* Glow Filter for Active Nodes & Rays */}
                <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-danger" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Background */}
              <rect width="100%" height="100%" fill="url(#constellation-grid)" />

              {/* Ambient radial gradient soft glow behind the Email hub */}
              <circle cx="480" cy="320" r="260" fill="rgba(14, 165, 233, 0.04)" />
              <circle cx="480" cy="320" r="140" fill="rgba(2, 132, 199, 0.06)" />

              {/* Constellation Connecting Lines */}
              {constellationData.connections.map(([sourceKey, targetKey], idx) => {
                const s = constellationData.nodesMap[sourceKey];
                const t = constellationData.nodesMap[targetKey];
                if (!s || !t) return null;
                const isHubSpoke = sourceKey === 'email' || targetKey === 'email';
                const isHighlight = activeConstellationNode === sourceKey || activeConstellationNode === targetKey;

                return (
                  <g key={`conn-${idx}`}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={
                        isHighlight
                          ? '#38bdf8'
                          : isHubSpoke
                          ? 'rgba(56, 189, 248, 0.45)'
                          : 'rgba(56, 189, 248, 0.22)'
                      }
                      strokeWidth={isHighlight ? 2.5 : isHubSpoke ? 1.8 : 1.2}
                      strokeDasharray={isHubSpoke ? undefined : '4 3'}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}

              {/* Constellation Nodes */}
              {Object.values(constellationData.nodesMap).map((n) => {
                const isSelected = activeConstellationNode === n.id;
                const isCenter = n.id === 'email';
                const isDanger = n.status === 'danger';
                const isWarning = n.status === 'warning';

                const haloColor = isDanger 
                  ? 'rgba(244, 63, 94, 0.16)' 
                  : isWarning 
                  ? 'rgba(245, 158, 11, 0.16)' 
                  : 'rgba(56, 189, 248, 0.14)';
                
                const haloBorder = isDanger 
                  ? 'rgba(244, 63, 94, 0.45)' 
                  : isWarning 
                  ? 'rgba(245, 158, 11, 0.45)' 
                  : 'rgba(56, 189, 248, 0.35)';

                const dotColor = isDanger ? '#f43f5e' : isWarning ? '#f59e0b' : '#38bdf8';

                return (
                  <g
                    key={n.id}
                    onClick={() => handleSelectConstellationNode(n.id)}
                    className="cursor-pointer group"
                    transform={`translate(${n.x}, ${n.y})`}
                  >
                    {/* Outer Large Translucent Halo Aura */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isCenter ? 36 : 28}
                      fill={haloColor}
                      stroke={haloBorder}
                      strokeWidth={isSelected ? 2 : 1}
                      className={`transition-all duration-300 ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    />

                    {/* Middle Pulse Ring */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isCenter ? 22 : 17}
                      fill={isDanger ? 'rgba(244, 63, 94, 0.25)' : 'rgba(2, 132, 199, 0.28)'}
                      className={isDanger || isCenter ? 'animate-pulse' : ''}
                    />

                    {/* Core Solid Glowing Node Dot */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isCenter ? 9 : 7}
                      fill={dotColor}
                      filter="url(#glow-cyan)"
                      className="transition-all duration-200 group-hover:scale-125"
                    />

                    {/* Node Title Label (e.g. Email, IP, Domain, etc.) */}
                    <text
                      textAnchor="middle"
                      y={isCenter ? -44 : -34}
                      fill="#e2e8f0"
                      fontSize={isCenter ? 14 : 12.5}
                      fontWeight={isCenter ? '700' : '600'}
                      fontFamily="system-ui, sans-serif"
                      letterSpacing="0.02em"
                      className="select-none pointer-events-none transition-colors group-hover:fill-cyan-300"
                    >
                      {n.title}
                    </text>

                    {/* Secondary Value Label on Hover/Select */}
                    {(isSelected || isCenter) && (
                      <text
                        textAnchor="middle"
                        y={isCenter ? 50 : 42}
                        fill="#94a3b8"
                        fontSize={9.5}
                        fontFamily="monospace"
                        className="select-none pointer-events-none truncate"
                      >
                        {n.value.length > 22 ? `${n.value.slice(0, 20)}...` : n.value}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Floating Summary Card Positioned in constellation - Organized Similarly to Evidence Card */}
              <foreignObject x="235" y="215" width="225" height="195" className="overflow-visible pointer-events-auto">
                <div 
                  onClick={() => {
                    handleSelectConstellationNode('email');
                    setIsDossierOpen(true);
                  }}
                  className="w-full h-full rounded-xl bg-[#0d1627]/92 backdrop-blur-md border border-[#223652] p-3 shadow-2xl flex flex-col justify-between hover:border-cyan-500/80 transition-all cursor-pointer group hover:shadow-cyan-950/50"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#1b2b44]">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-bold text-slate-100 font-mono tracking-wide">CASE EVIDENCE</span>
                    </div>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      isMalicious 
                        ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                        : isSuspicious 
                        ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {constellationData.summary.score}/100
                    </span>
                  </div>

                  {/* Refined Structured Forensic Data Rows (Clean Alignment & Spacing) */}
                  <div className="space-y-1.5 my-1 text-[10px] font-mono">
                    {/* Subject & Verdict Banner */}
                    <div className="truncate text-slate-200 font-semibold" title={constellationData.summary.subject}>
                      {constellationData.summary.subject}
                    </div>

                    {/* Origin Row */}
                    <div className="flex items-center justify-between text-slate-300 bg-[#070d17]/80 px-1.5 py-0.5 rounded border border-[#142338]">
                      <span className="text-slate-500 text-[9px] uppercase">ORIGIN</span>
                      <span className="text-cyan-300 font-bold truncate max-w-[125px]">
                        {constellationData.summary.originIp}
                      </span>
                    </div>

                    {/* Auth Row */}
                    <div className="flex items-center justify-between text-slate-300 bg-[#070d17]/80 px-1.5 py-0.5 rounded border border-[#142338]">
                      <span className="text-slate-500 text-[9px] uppercase">AUTH</span>
                      <span className="text-emerald-400 truncate max-w-[125px]">
                        {constellationData.summary.authStatus}
                      </span>
                    </div>

                    {/* Campaign / Incident Cluster */}
                    <div className="flex items-center justify-between text-slate-300 bg-[#070d17]/80 px-1.5 py-0.5 rounded border border-[#142338]">
                      <span className="text-slate-500 text-[9px] uppercase">INCIDENT</span>
                      <span className="text-fuchsia-300 truncate max-w-[125px]">
                        {constellationData.summary.campaignCluster}
                      </span>
                    </div>

                    {/* SOC Analyst */}
                    <div className="flex items-center justify-between text-slate-300 bg-[#070d17]/80 px-1.5 py-0.5 rounded border border-[#142338]">
                      <span className="text-slate-500 text-[9px] uppercase">ANALYST</span>
                      <span className="text-blue-300 truncate max-w-[125px]">
                        {constellationData.summary.assignedUser}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-cyan-400 pt-1.5 border-t border-[#1b2b44] group-hover:text-cyan-300 font-semibold">
                    <span>Inspect Evidence Dossier</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </foreignObject>
            </svg>

            {/* Quick Interactive Constellation Info Bar on Bottom */}
            <div className="absolute bottom-4 right-4 flex items-center gap-3 p-2.5 rounded-xl bg-[#0d1627]/90 border border-[#1b2b44] backdrop-blur-md text-xs font-mono shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Selected Node:</span>
                <span className="font-bold text-cyan-300 uppercase">
                  {constellationData.nodesMap[activeConstellationNode]?.title || 'Email Hub'}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="truncate max-w-[240px]">
                  {constellationData.nodesMap[activeConstellationNode]?.value}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1.5 D3 DYNAMIC ACTOR GRAPH VIEW */}
        {/* ======================================================== */}
        {viewMode === 'd3_actors' && effectiveAnalysis && (
          <div className="flex-1 h-full relative overflow-hidden flex flex-col p-4 bg-[#070b14]">
            <EmailActorD3Graph
              analysis={effectiveAnalysis}
              className="h-full w-full"
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. REACTFLOW DETAILED CANVAS (For Topology & IOC Drilldown) */}
        {/* ======================================================== */}
        {viewMode !== 'constellation' && viewMode !== 'd3_actors' && (
          <div className="flex-1 h-full relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#1e293b" gap={20} size={1} />
              <Controls className="bg-slate-900 border-slate-800 fill-slate-300 stroke-slate-300" />
            </ReactFlow>

            {/* Floating Legend */}
            <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs backdrop-blur-md shadow-xl max-w-sm pointer-events-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>Evidence Nodes &amp; Relationship Legend</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
                  <span className="text-slate-200 font-semibold">Case Hub / Verdict</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-300">Sender / Envelope</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-emerald-300">SPF / DKIM / DMARC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-cyan-300">Transmission Hops</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-rose-300 font-medium">Weaponized IOCs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400" />
                  <span className="text-fuchsia-300">Campaign Clusters</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. STRUCTURED FORENSIC EVIDENCE DOSSIER DRAWER */}
        {/* Organized identically to the approved Evidence Tag Card */}
        {/* ======================================================== */}
        {isDossierOpen && (
          <div className="w-96 border-l border-[#1a293f] bg-[#090f1c]/95 backdrop-blur-md flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 shrink-0 z-30">
            {/* 1. Header & Fast Situational Awareness */}
            <div className="p-4 border-b border-[#1b2b44] bg-[#0b1322] sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 shadow-sm">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <span>FORENSIC EVIDENCE DOSSIER</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentCaseId} • UTC: {new Date().toISOString().slice(11, 19)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setIsDossierOpen(false)} 
                    className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#162338] cursor-pointer"
                    title="Close Dossier"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dynamic Severity Badge & Quick Export Actions */}
              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-[#1b2b44]/70">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 ${
                  isMalicious 
                    ? 'bg-rose-950/80 border-rose-600 text-rose-200 animate-pulse' 
                    : isSuspicious 
                    ? 'bg-amber-950/80 border-amber-600 text-amber-200' 
                    : 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isMalicious ? 'bg-rose-400' : isSuspicious ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span>SEV: {isMalicious ? 'CRITICAL' : isSuspicious ? 'HIGH' : 'LOW'}</span>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/70 text-[10px] font-mono text-cyan-300 cursor-pointer flex items-center gap-1"
                    title="Export as JSON"
                  >
                    <FileJson className="w-3 h-3" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/70 text-[10px] font-mono text-emerald-300 cursor-pointer flex items-center gap-1"
                    title="Export as CSV"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareModalOpen(true)}
                    className="px-2 py-0.5 rounded bg-blue-950/60 hover:bg-blue-900 border border-blue-800/70 text-[10px] font-mono text-blue-300 cursor-pointer flex items-center gap-1"
                    title="Share Case Link"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dossier Body with Clear Hierarchical Sections */}
            <div className="p-4 space-y-4 text-xs text-slate-300">
              
              {/* Selected Entity Card if an active node/edge is selected */}
              {selectedEntity && (
                <div className="p-3 rounded-xl bg-[#0f1828] border border-cyan-500/50 shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-cyan-400 border-b border-cyan-900/60 pb-1.5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-cyan-400" />
                      <span>SELECTED {selectedEntity.type?.toUpperCase()}</span>
                    </span>
                    <button 
                      onClick={() => setSelectedEntity(null)}
                      className="text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Identifier / Value</span>
                    <span className="font-mono text-xs font-bold text-white break-all">
                      {selectedEntity.data.label || selectedEntity.label}
                    </span>
                  </div>
                  {selectedEntity.data.sublabel && (
                    <p className="text-[11px] text-slate-300 font-mono bg-[#080d17] p-2 rounded border border-[#1b2b44]">
                      {selectedEntity.data.sublabel}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyIdentifier(selectedEntity.data.label || selectedEntity.label)}
                    className="w-full py-1 px-2 rounded bg-[#162338] hover:bg-[#1e2f4a] border border-[#223652] text-[10.5px] font-mono text-cyan-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                    <span>{copiedId ? 'Copied Identifier!' : 'Copy Identifier'}</span>
                  </button>
                </div>
              )}

              {/* 2. Subject & Threat Verdict Banner */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <span>THREAT VERDICT OVERVIEW</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    isMalicious ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {currentVerdict}
                  </span>
                </div>
                <h5 className="font-bold text-slate-100 text-sm leading-snug break-words">
                  {effectiveAnalysis?.headers?.subject || effectiveAnalysis?.subject || '(No Subject Line Extracted)'}
                </h5>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#1b2b44]">
                  <div>
                    <span className="text-[9px] uppercase font-mono text-slate-500 block">THREAT RISK SCORE</span>
                    <span className={`font-mono text-sm font-bold ${isMalicious ? 'text-rose-400' : 'text-amber-400'}`}>
                      {currentScore} / 100
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono text-slate-500 block">CLASSIFICATION</span>
                    <span className="font-mono text-xs font-semibold text-cyan-300">
                      {((effectiveAnalysis as any)?.mlPrediction as any)?.label || ((effectiveAnalysis as any)?.ml_prediction as any)?.label || 'Suspicious Phish'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Origin & Network Routing (Refined Origin Section) */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1b2b44] pb-1.5">
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <Server className="w-3.5 h-3.5" />
                    <span>ORIGIN &amp; NETWORK ROUTING</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                    FIRST PUBLIC HOP
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between items-center bg-[#080d17] p-2 rounded border border-[#162338]">
                    <span className="text-slate-400">Origin IP:</span>
                    <span className="font-bold text-cyan-300 break-all">{originIp}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#080d17] p-2 rounded border border-[#162338]">
                    <span className="text-slate-400">Geolocation:</span>
                    <span className="text-slate-200">📍 {originLocation}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#080d17] p-2 rounded border border-[#162338]">
                    <span className="text-slate-400">Autonomous System:</span>
                    <span className="text-purple-300 font-semibold truncate max-w-[170px]">{originAsn}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#080d17] p-2 rounded border border-[#162338]">
                      <span className="text-[9px] text-slate-500 block">TOTAL RELAYS</span>
                      <span className="font-bold text-slate-200">{hops.length || 1} Hops Traced</span>
                    </div>
                    <div className="bg-[#080d17] p-2 rounded border border-[#162338]">
                      <span className="text-[9px] text-slate-500 block">INGRESS DELAY</span>
                      <span className="font-bold text-amber-400">+{originDelay}s latency</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Threat Breakdown & Cryptographic Verification */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1b2b44] pb-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>AUTHENTICATION &amp; CRYPTO</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">RFC 7208 / 6376</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  <div className={`p-2 rounded border text-center ${
                    spfStatus === 'PASS' ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300' : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
                  }`}>
                    <span className="block text-[8.5px] uppercase text-slate-400">SPF</span>
                    <span className="font-bold">{spfStatus}</span>
                  </div>
                  <div className={`p-2 rounded border text-center ${
                    dkimStatus === 'PASS' ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300' : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
                  }`}>
                    <span className="block text-[8.5px] uppercase text-slate-400">DKIM</span>
                    <span className="font-bold">{dkimStatus}</span>
                  </div>
                  <div className={`p-2 rounded border text-center ${
                    dmarcStatus === 'PASS' ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300' : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
                  }`}>
                    <span className="block text-[8.5px] uppercase text-slate-400">DMARC</span>
                    <span className="font-bold">{dmarcStatus}</span>
                  </div>
                </div>

                <div className="bg-[#080d17] p-2 rounded border border-[#162338] text-[11px] font-mono flex justify-between items-center">
                  <span className="text-slate-400">Domain Alignment:</span>
                  <span className="text-emerald-400 font-semibold">Strict Envelope Match</span>
                </div>
              </div>

              {/* 5. Related Incident & Threat Campaign */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1b2b44] pb-1.5">
                  <div className="flex items-center gap-1.5 text-fuchsia-400">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>RELATED INCIDENT &amp; CAMPAIGN</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-800 font-bold">
                    {campaignSimilarity}% MATCH
                  </span>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between items-center bg-[#080d17] p-2 rounded border border-[#162338]">
                    <span className="text-slate-400">Campaign ID:</span>
                    <span className="text-fuchsia-300 font-bold">{campaignName}</span>
                  </div>
                  <div className="flex justify-between items-center bg-[#080d17] p-2 rounded border border-[#162338]">
                    <span className="text-slate-400">Correlated Cases:</span>
                    <span className="text-slate-200">3 Related Incidents in Tenant</span>
                  </div>
                </div>
              </div>

              {/* 6. Assigned Team & SOC Lead Analyst */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1b2b44] pb-1.5">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <User className="w-3.5 h-3.5" />
                    <span>ASSIGNED SOC ANALYST</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400">ACTIVE TRIAGE</span>
                </div>

                <div className="flex items-center gap-3 bg-[#080d17] p-2.5 rounded-xl border border-[#162338]">
                  <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-600 flex items-center justify-center text-blue-300 font-bold font-mono text-xs">
                    {assignedLead.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-100 font-mono truncate">{assignedLead}</div>
                    <div className="text-[10px] text-slate-400">Tier-2 Senior Incident Response Lead</div>
                  </div>
                </div>
              </div>

              {/* 7. Weaponized IOCs & Indicators */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1b2b44] pb-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>OBSERVED IOCS &amp; MITRE TACTICS</span>
                  </div>
                  <span className="text-[9px] font-mono text-rose-300">T1566 Phishing</span>
                </div>

                <div className="space-y-1.5 font-mono text-[10.5px]">
                  {(effectiveAnalysis?.urls || []).length > 0 ? (
                    (effectiveAnalysis?.urls || []).slice(0, 2).map((u, idx) => (
                      <div key={idx} className="p-2 rounded bg-rose-950/30 border border-rose-900/60 text-rose-200 flex items-center justify-between gap-2">
                        <span className="truncate">{u.url}</span>
                        <span className="text-[9px] font-bold text-rose-400 shrink-0">FLAGGED</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 rounded bg-[#080d17] border border-[#162338] text-slate-400 text-center">
                      No malicious URL payloads detected
                    </div>
                  )}
                </div>
              </div>

              {/* 8. Tamper-Proof Digest & Recommended Action */}
              <div className="p-3.5 rounded-xl bg-[#0e1626] border border-[#1b2b44] space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">TAMPER-PROOF DIGEST (SHA-256)</span>
                <div className="font-mono text-[10px] text-slate-300 bg-[#080d17] p-2 rounded border border-[#162338] break-all select-all">
                  {sha256Digest}
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Recommended SOC Action:</span>
                  <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                    QUARANTINE &amp; BLOCK
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Share Case Modal */}
      {shareModalOpen && (
        <ShareCaseModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          caseId={currentCaseId}
          evidenceId={effectiveAnalysis?.evidenceId || 'EVD-2026-0881'}
          subject={effectiveAnalysis?.headers?.subject || effectiveAnalysis?.subject}
          verdict={currentVerdict}
          severity={isMalicious ? 'CRITICAL' : isSuspicious ? 'HIGH' : 'LOW'}
          threatScore={currentScore}
        />
      )}
    </div>
  );
}

export default RelationshipGraphView;
