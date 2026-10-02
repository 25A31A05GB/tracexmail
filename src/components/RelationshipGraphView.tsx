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
  Check
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';

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
      bgClass = "bg-blue-950/80";
      borderClass = "border-blue-500/80";
      iconClass = "text-blue-400";
      badgeColor = "bg-blue-900/60 text-blue-300";
      break;

    case 'alias':
      Icon = UserCheck;
      bgClass = "bg-amber-950/70";
      borderClass = "border-amber-500/70";
      iconClass = "text-amber-400";
      badgeColor = "bg-amber-900/60 text-amber-300";
      break;

    case 'reply_to':
      Icon = Repeat;
      if (isDiverter) {
        bgClass = "bg-rose-950/90";
        borderClass = "border-rose-500 animate-pulse";
        iconClass = "text-rose-400";
        badgeColor = "bg-rose-900/80 text-rose-200 font-bold";
      } else {
        bgClass = "bg-slate-900";
        borderClass = "border-slate-600";
        iconClass = "text-slate-300";
        badgeColor = "bg-slate-800 text-slate-300";
      }
      break;

    case 'return_path':
      Icon = ArrowRight;
      if (isMismatch) {
        bgClass = "bg-orange-950/90";
        borderClass = "border-orange-500";
        iconClass = "text-orange-400";
        badgeColor = "bg-orange-900/80 text-orange-200 font-bold";
      } else {
        bgClass = "bg-slate-900";
        borderClass = "border-slate-600";
        iconClass = "text-slate-300";
        badgeColor = "bg-slate-800 text-slate-300";
      }
      break;

    case 'domain':
      Icon = Globe;
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
  const [viewMode, setViewMode] = useState<'constellation' | 'all_evidence' | 'relay_pipeline' | 'iocs_threats' | 'auth_identity'>('constellation');
  const [hidePrivateHops, setHidePrivateHops] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeConstellationNode, setActiveConstellationNode] = useState<string>('email');
  const [copiedId, setCopiedId] = useState(false);

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
        sublabel: 'Header From / Envelope Sender',
        riskLevel: effectiveVerdict,
        raw: effectiveAnalysis.from
      }
    });

    newEdges.push({
      id: 'edge-case-sender',
      source: 'node-case',
      target: 'node-sender',
      label: 'authored by',
      type: 'smoothstep',
      style: { stroke: '#3b82f6', strokeWidth: 1.5 },
      labelStyle: { fill: '#60a5fa', fontSize: 10 },
      labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
    });

    // 3. Sender Alias Node
    if (senderName) {
      newNodes.push({
        id: 'node-alias',
        type: 'entity',
        position: { x: -160, y: 160 },
        data: {
          type: 'alias',
          label: senderName,
          sublabel: 'Claimed Display Name / Alias',
          riskLevel: 'SUSPICIOUS'
        }
      });

      newEdges.push({
        id: 'edge-alias-sender',
        source: 'node-alias',
        target: 'node-sender',
        label: 'claims identity',
        type: 'smoothstep',
        style: { stroke: '#f59e0b', strokeWidth: 1.5 },
        labelStyle: { fill: '#f59e0b', fontSize: 10 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      });
    }

    // 4. Return-Path Node (Check for Domain Mismatch)
    const effectiveReturnPath = effectiveAnalysis.headers?.returnPath || effectiveAnalysis.returnPath;
    if (effectiveReturnPath) {
      const returnPathDomain = effectiveReturnPath.includes('@') ? effectiveReturnPath.split('@')[1].replace(/[<>]/g, '').trim() : '';
      const isMismatch = Boolean(returnPathDomain && senderDomain && !returnPathDomain.includes(senderDomain) && !senderDomain.includes(returnPathDomain));

      newNodes.push({
        id: 'node-returnpath',
        type: 'entity',
        position: { x: -160, y: 280 },
        data: {
          type: 'return_path',
          label: effectiveReturnPath,
          sublabel: isMismatch ? 'BOUNCE DOMAIN MISMATCH (Sender vs Return-Path)' : 'Validated Bounce Path',
          isMismatch,
          status: isMismatch ? 'MISMATCH' : 'ALIGNED'
        }
      });

      newEdges.push({
        id: 'edge-sender-returnpath',
        source: 'node-sender',
        target: 'node-returnpath',
        label: isMismatch ? 'mismatched bounce target' : 'return path',
        type: 'smoothstep',
        style: { stroke: isMismatch ? '#f97316' : '#64748b', strokeWidth: isMismatch ? 2 : 1 },
        labelStyle: { fill: isMismatch ? '#f97316' : '#94a3b8', fontSize: 10 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      });
    }

    // 5. Reply-To Node (Check for Diverter)
    const effectiveReplyTo = effectiveAnalysis.headers?.replyTo || effectiveAnalysis.replyTo;
    if (effectiveReplyTo && effectiveReplyTo !== effectiveAnalysis.from) {
      const isDiverted = effectiveReplyTo.toLowerCase() !== cleanSenderAddr.toLowerCase();
      newNodes.push({
        id: 'node-replyto',
        type: 'entity',
        position: { x: -160, y: 400 },
        data: {
          type: 'reply_to',
          label: effectiveReplyTo,
          sublabel: isDiverted ? 'ANOMALOUS DIVERTER (Replies hijacked away from sender)' : 'Direct Reply Target',
          isDiverter: isDiverted,
          riskLevel: isDiverted ? 'MALICIOUS' : 'NORMAL'
        }
      });

      newEdges.push({
        id: 'edge-sender-replyto',
        source: 'node-sender',
        target: 'node-replyto',
        label: isDiverted ? 'HIJACKED REPLY TARGET' : 'replies to',
        type: 'smoothstep',
        animated: isDiverted,
        style: { stroke: isDiverted ? '#f43f5e' : '#94a3b8', strokeWidth: isDiverted ? 2.5 : 1, strokeDasharray: isDiverted ? '5,5' : undefined },
        labelStyle: { fill: isDiverted ? '#f43f5e' : '#94a3b8', fontSize: 10, fontWeight: isDiverted ? 'bold' : 'normal' },
        labelBgStyle: { fill: '#0f172a', stroke: isDiverted ? '#881337' : '#1e293b' }
      });
    }

    // 6. Sender Domain & DNS Infrastructure
    const domIntel = effectiveAnalysis.domain_intelligence || effectiveAnalysis.domainIntelligence;
    newNodes.push({
      id: 'node-domain',
      type: 'entity',
      position: { x: 720, y: 160 },
      data: {
        type: 'domain',
        label: senderDomain,
        sublabel: domIntel?.registrar ? `Registrar: ${domIntel.registrar}` : 'Sender Registered Domain',
        tag: domIntel?.domain_age_days !== undefined ? `Age: ${domIntel.domain_age_days} days` : 'WHOIS Registered'
      }
    });

    newEdges.push({
      id: 'edge-sender-domain',
      source: 'node-sender',
      target: 'node-domain',
      label: 'author domain',
      type: 'smoothstep',
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      labelStyle: { fill: '#818cf8', fontSize: 10 },
      labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
    });

    // 7. Cryptographic Authentication Nodes (SPF, DKIM, DMARC)
    const spfStatus = effectiveAnalysis.authResults?.spf?.status || effectiveAnalysis.auth?.spf?.status || 'PASS';
    const dkimStatus = effectiveAnalysis.authResults?.dkim?.status || effectiveAnalysis.auth?.dkim?.status || 'PASS';
    const dmarcStatus = effectiveAnalysis.authResults?.dmarc?.status || effectiveAnalysis.auth?.dmarc?.status || 'PASS';
    const dmarcPolicy = effectiveAnalysis.authResults?.dmarc?.policy || domIntel?.dns?.dmarc_policy || 'p=none';

    newNodes.push({
      id: 'node-auth-spf',
      type: 'entity',
      position: { x: 1000, y: 60 },
      data: {
        type: 'auth_spf',
        label: `SPF: ${spfStatus}`,
        sublabel: effectiveAnalysis.auth?.spf?.record || 'Sender Policy Framework record',
        status: spfStatus
      }
    });

    newNodes.push({
      id: 'node-auth-dkim',
      type: 'entity',
      position: { x: 1000, y: 180 },
      data: {
        type: 'auth_dkim',
        label: `DKIM: ${dkimStatus}`,
        sublabel: 'Cryptographic DomainKeys Signature',
        status: dkimStatus
      }
    });

    newNodes.push({
      id: 'node-auth-dmarc',
      type: 'entity',
      position: { x: 1000, y: 300 },
      data: {
        type: 'auth_dmarc',
        label: `DMARC: ${dmarcStatus}`,
        sublabel: `Policy: ${dmarcPolicy}`,
        status: dmarcStatus
      }
    });

    newEdges.push(
      {
        id: 'edge-domain-spf',
        source: 'node-domain',
        target: 'node-auth-spf',
        label: 'SPF auth',
        type: 'smoothstep',
        style: { stroke: spfStatus === 'PASS' ? '#10b981' : '#f43f5e', strokeWidth: 1.5 },
        labelStyle: { fill: spfStatus === 'PASS' ? '#34d399' : '#fb7185', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      },
      {
        id: 'edge-domain-dkim',
        source: 'node-domain',
        target: 'node-auth-dkim',
        label: 'DKIM signature',
        type: 'smoothstep',
        style: { stroke: dkimStatus === 'PASS' ? '#10b981' : '#f43f5e', strokeWidth: 1.5 },
        labelStyle: { fill: dkimStatus === 'PASS' ? '#34d399' : '#fb7185', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      },
      {
        id: 'edge-domain-dmarc',
        source: 'node-domain',
        target: 'node-auth-dmarc',
        label: 'DMARC alignment',
        type: 'smoothstep',
        style: { stroke: dmarcStatus === 'PASS' ? '#10b981' : '#f43f5e', strokeWidth: 1.5 },
        labelStyle: { fill: dmarcStatus === 'PASS' ? '#34d399' : '#fb7185', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      }
    );

    // 8. Transmission Relay Hops
    let prevHopNodeId = 'node-sender';
    let currentY = 320;

    filteredHops.forEach((hop, idx) => {
      const hopNodeId = `node-hop-${hop.hopNumber || idx + 1}`;
      const hopIp = hop.fromIp || hop.fromHost || `hop-${idx + 1}`;
      const isOriginHop = hop.isOrigin || (idx === 0 && !hop.isPrivate);

      const hopX = 420;
      const hopY = currentY;
      currentY += 130;

      newNodes.push({
        id: hopNodeId,
        type: 'entity',
        position: { x: hopX, y: hopY },
        data: {
          type: 'relay_hop',
          label: hopIp,
          sublabel: hop.fromHost || (hop.isPrivate ? 'Internal Datacenter Gateway' : 'Public Transmission Node'),
          hopNumber: hop.hopNumber || idx + 1,
          isOrigin: isOriginHop,
          isPrivate: hop.isPrivate,
          city: hop.city,
          country: hop.countryCode || hop.country,
          asn: hop.asn,
          protocol: hop.protocol || 'ESMTP',
          delaySec: hop.delaySec,
          isTor: hop.is_tor,
          isVpn: hop.is_vpn,
          rawHop: hop
        }
      });

      const edgeLabel = hop.delaySec !== undefined 
        ? `Relay Hop #${hop.hopNumber || idx + 1} (+${hop.delaySec}s)` 
        : `Relay Hop #${hop.hopNumber || idx + 1}`;

      newEdges.push({
        id: `edge-relay-${prevHopNodeId}-${hopNodeId}`,
        source: prevHopNodeId,
        target: hopNodeId,
        label: edgeLabel,
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: isOriginHop ? '#f43f5e' : '#38bdf8' },
        style: { stroke: isOriginHop ? '#f43f5e' : '#38bdf8', strokeWidth: isOriginHop ? 2.5 : 2 },
        labelStyle: { fill: '#38bdf8', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#0f172a', stroke: '#0284c7' }
      });

      prevHopNodeId = hopNodeId;

      // ASN Node
      if (hop.asn && !hop.isPrivate) {
        const asnNodeId = `node-asn-${hop.asn.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!newNodes.some(n => n.id === asnNodeId)) {
          newNodes.push({
            id: asnNodeId,
            type: 'entity',
            position: { x: hopX + 280, y: hopY },
            data: {
              type: 'asn',
              label: hop.asn,
              sublabel: hop.org || hop.isp || 'Autonomous System Infrastructure',
              asn: hop.asn,
              isp: hop.isp
            }
          });

          newEdges.push({
            id: `edge-hop-asn-${hopNodeId}`,
            source: hopNodeId,
            target: asnNodeId,
            label: 'routed by',
            type: 'smoothstep',
            style: { stroke: '#a855f7', strokeWidth: 1.5 },
            labelStyle: { fill: '#c084fc', fontSize: 9 },
            labelBgStyle: { fill: '#0f172a', stroke: '#581c87' }
          });
        }
      }
    });

    // 9. Recipient Node
    const recipientEmail = effectiveAnalysis.headers?.to || effectiveAnalysis.to || 'recipient@company.com';
    newNodes.push({
      id: 'node-recipient',
      type: 'entity',
      position: { x: 420, y: currentY + 20 },
      data: {
        type: 'recipient',
        label: recipientEmail,
        sublabel: 'Target Recipient Mailbox / Ingress Delivery',
        riskLevel: 'CLEAN'
      }
    });

    newEdges.push({
      id: `edge-final-delivery`,
      source: prevHopNodeId,
      target: 'node-recipient',
      label: 'delivered to inbox',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
      style: { stroke: '#10b981', strokeWidth: 2 },
      labelStyle: { fill: '#34d399', fontSize: 10, fontWeight: 'bold' },
      labelBgStyle: { fill: '#0f172a', stroke: '#065f46' }
    });

    // 10. Observed Threat Artifacts / IOCs (URLs, Attachments)
    const urls = effectiveAnalysis.urls || [];
    urls.slice(0, 3).forEach((urlItem, idx) => {
      const urlNodeId = `node-url-${idx}`;
      newNodes.push({
        id: urlNodeId,
        type: 'entity',
        position: { x: -160, y: 520 + idx * 110 },
        data: {
          type: 'ioc_url',
          label: urlItem.domain || urlItem.url.slice(0, 24),
          sublabel: urlItem.defangedUrl || urlItem.url,
          status: urlItem.status || 'SUSPICIOUS',
          tag: urlItem.virustotalScore ? `VT: ${urlItem.virustotalScore}` : 'Extracted Link'
        }
      });

      newEdges.push({
        id: `edge-case-${urlNodeId}`,
        source: 'node-case',
        target: urlNodeId,
        label: 'payload link',
        type: 'smoothstep',
        style: { stroke: urlItem.status === 'MALICIOUS' ? '#f43f5e' : '#f59e0b', strokeWidth: 1.5 },
        labelStyle: { fill: urlItem.status === 'MALICIOUS' ? '#f43f5e' : '#f59e0b', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      });
    });

    const attachments = effectiveAnalysis.attachments || [];
    attachments.slice(0, 2).forEach((att, idx) => {
      const attNodeId = `node-att-${idx}`;
      newNodes.push({
        id: attNodeId,
        type: 'entity',
        position: { x: 120, y: 520 + idx * 110 },
        data: {
          type: 'ioc_attachment',
          label: att.filename || `payload-${idx + 1}.dat`,
          sublabel: `MIME: ${att.mimeType || 'unknown'} • ${att.size || 'N/A'}`,
          status: att.status || 'SUSPICIOUS',
          tag: att.sha256 ? `SHA: ${att.sha256.slice(0, 8)}...` : 'File Attachment'
        }
      });

      newEdges.push({
        id: `edge-case-${attNodeId}`,
        source: 'node-case',
        target: attNodeId,
        label: 'weaponized attachment',
        type: 'smoothstep',
        style: { stroke: att.status === 'MALICIOUS' ? '#f43f5e' : '#eab308', strokeWidth: 1.5 },
        labelStyle: { fill: att.status === 'MALICIOUS' ? '#f43f5e' : '#eab308', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      });
    });

    // 11. Threat Campaign & Attribution Node
    const campaignName = effectiveAnalysis.campaign_name || effectiveAnalysis.campaign_id || (effectiveAnalysis.correlationEvidence?.length ? 'CAMP-2026-OCT-01' : null);
    if (campaignName) {
      newNodes.push({
        id: 'node-campaign',
        type: 'entity',
        position: { x: 720, y: 440 },
        data: {
          type: 'threat_campaign',
          label: campaignName,
          sublabel: 'Active Threat Campaign Correlation Cluster',
          status: 'CORRELATED'
        }
      });

      newEdges.push({
        id: 'edge-case-campaign',
        source: 'node-case',
        target: 'node-campaign',
        label: 'part of campaign',
        type: 'smoothstep',
        style: { stroke: '#d946ef', strokeWidth: 2 },
        labelStyle: { fill: '#e879f9', fontSize: 9, fontWeight: 'bold' },
        labelBgStyle: { fill: '#0f172a', stroke: '#701a75' }
      });
    }

    // 12. MITRE ATT&CK Techniques
    const triggeredHeuristics = (effectiveAnalysis.heuristics || []).filter(h => h.triggered).slice(0, 2);
    triggeredHeuristics.forEach((heur, idx) => {
      const mitreNodeId = `node-mitre-${idx}`;
      newNodes.push({
        id: mitreNodeId,
        type: 'entity',
        position: { x: 1000, y: 440 + idx * 110 },
        data: {
          type: 'threat_mitre',
          label: heur.title || heur.id,
          sublabel: heur.description || 'MITRE ATT&CK Matrix Indicator',
          techniqueId: heur.id.startsWith('T') ? heur.id : `T1566.00${idx + 1}`
        }
      });

      newEdges.push({
        id: `edge-case-${mitreNodeId}`,
        source: 'node-case',
        target: mitreNodeId,
        label: 'exhibits technique',
        type: 'smoothstep',
        style: { stroke: '#f43f5e', strokeWidth: 1.5 },
        labelStyle: { fill: '#fb7185', fontSize: 9 },
        labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
      });
    });

    // 13. SOC Lead Analyst Attribution Node
    const analystName = effectiveAnalysis.assigned_user || effectiveAnalysis.assignedUser || effectiveAnalysis.user_email || 'Jayaram Sappa';
    newNodes.push({
      id: 'node-analyst',
      type: 'entity',
      position: { x: 720, y: 580 },
      data: {
        type: 'soc_analyst',
        label: analystName,
        sublabel: 'Lead Incident Investigator & Triage Lead',
        tag: effectiveAnalysis.status || 'TRIAGED / ACTIVE'
      }
    });

    newEdges.push({
      id: 'edge-case-analyst',
      source: 'node-case',
      target: 'node-analyst',
      label: 'triaged by',
      type: 'smoothstep',
      style: { stroke: '#38bdf8', strokeWidth: 1.5 },
      labelStyle: { fill: '#7dd3fc', fontSize: 9 },
      labelBgStyle: { fill: '#0f172a', stroke: '#1e293b' }
    });

    // Apply View Mode Filters
    let finalNodes = newNodes;
    let finalEdges = newEdges;

    if (viewMode === 'relay_pipeline') {
      const allowedTypes = ['sender', 'relay_hop', 'asn', 'recipient'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      finalEdges = newEdges.filter(e => e.id.startsWith('edge-relay-') || e.id.startsWith('edge-final-') || e.id.startsWith('edge-hop-asn-'));
    } else if (viewMode === 'iocs_threats') {
      const allowedTypes = ['case', 'ioc_url', 'ioc_attachment', 'ioc_qr', 'threat_campaign', 'threat_mitre'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      const allowedNodeIds = new Set(finalNodes.map(n => n.id));
      finalEdges = newEdges.filter(e => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target));
    } else if (viewMode === 'auth_identity') {
      const allowedTypes = ['case', 'sender', 'alias', 'return_path', 'reply_to', 'domain', 'auth_spf', 'auth_dkim', 'auth_dmarc', 'dns_mx'];
      finalNodes = newNodes.filter(n => allowedTypes.includes(String((n.data as any)?.type)));
      const allowedNodeIds = new Set(finalNodes.map(n => n.id));
      finalEdges = newEdges.filter(e => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target));
    }

    // Filter nodes based on search
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
    if (onSelectNode) onSelectNode(node.data);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEntity({ type: 'edge', data: edge.data, label: edge.label });
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

    const campaignCluster = effectiveAnalysis.campaign_name || effectiveAnalysis.campaign_id || (effectiveAnalysis.correlationEvidence?.length ? 'CAMP-2026-OCT-01' : 'Cluster: Standalone');
    const infraAsn = firstHop?.asn || 'AS208294';
    const relayCount = hops.length || 1;

    const verdict = effectiveAnalysis.threatVerdict || effectiveAnalysis.verdict || 'SUSPICIOUS';
    const score = effectiveAnalysis.threatScore ?? effectiveAnalysis.riskScore ?? 0;
    const subject = effectiveAnalysis.headers?.subject || effectiveAnalysis.subject || '(No Subject)';

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
        authStatus: `${effectiveAnalysis.authResults?.spf?.status || 'SPF:PASS'} • ${effectiveAnalysis.authResults?.dmarc?.status || 'DMARC:PASS'}`
      }
    };
  }, [effectiveAnalysis]);

  // Handle node selection in constellation
  const handleSelectConstellationNode = (nodeId: string) => {
    setActiveConstellationNode(nodeId);
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

  return (
    <div className="relative h-full min-h-[620px] bg-[#080d17] rounded-2xl border border-[#162338] overflow-hidden flex flex-col shadow-2xl">
      {/* Top Forensic Toolbar */}
      <div className="px-5 py-3 border-b border-[#162338] bg-[#0b1220]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/40">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Threat Infrastructure &amp; Evidence Graph</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/80 text-cyan-300 font-mono tracking-wider">
                {viewMode === 'constellation' ? '8 CONSTELLATION NODES' : `${nodes.length} EVIDENCE NODES • ${edges.length} RELATIONS`}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive relationship network connecting email entity, origin IPs, infrastructure, IOC indicators &amp; campaign clusters
            </p>
          </div>
        </div>

        {/* View Mode Switches & Search Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search evidence / IOCs..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44"
            />
          </div>

          {/* Toggle View Layout Preset */}
          <div className="flex items-center rounded-lg bg-[#0e1626] border border-[#1b2b44] p-0.5">
            <button
              onClick={() => setViewMode('constellation')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
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

          {/* Toggle Private LAN Hops in Topology */}
          {viewMode !== 'constellation' && (
            <button
              onClick={() => setHidePrivateHops(!hidePrivateHops)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                hidePrivateHops
                  ? 'bg-cyan-950/70 border-cyan-700 text-cyan-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Filter RFC 1918 Private Address Relays"
            >
              {hidePrivateHops ? 'Public Only' : 'Include RFC 1918'}
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area + Side Detail Inspector */}
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
                      r={isCenter ? 36 : 28}
                      fill={haloColor}
                      stroke={haloBorder}
                      strokeWidth={isSelected ? 2 : 1}
                      className={`transition-all duration-300 ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                    />

                    {/* Middle Pulse Ring */}
                    <circle
                      r={isCenter ? 22 : 17}
                      fill={isDanger ? 'rgba(244, 63, 94, 0.25)' : 'rgba(2, 132, 199, 0.28)'}
                      className={isDanger || isCenter ? 'animate-pulse' : ''}
                    />

                    {/* Core Solid Glowing Node Dot */}
                    <circle
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

              {/* Floating Summary Card Positioned in constellation (Matching Screenshot) */}
              <foreignObject x="250" y="270" width="160" height="110" className="overflow-visible pointer-events-auto">
                <div 
                  onClick={() => handleSelectConstellationNode('email')}
                  className="w-full h-full rounded-xl bg-[#0d1627]/85 backdrop-blur-md border border-[#223652] p-3 shadow-2xl flex flex-col justify-between hover:border-cyan-500/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 font-mono tracking-wide">Summary</span>
                    <span className={`w-2 h-2 rounded-full ${constellationData.summary.verdict.includes('MALICIOUS') ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`} />
                  </div>

                  {/* Clean Mock Placeholder Rows as seen in the reference visual */}
                  <div className="space-y-1.5 my-1">
                    <div className="h-1.5 rounded-full bg-cyan-900/60 w-full" />
                    <div className="h-1.5 rounded-full bg-cyan-900/40 w-4/5" />
                    <div className="h-1.5 rounded-full bg-cyan-900/30 w-3/5" />
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-[#1b2b44]">
                    <span className="truncate max-w-[90px]">{constellationData.summary.verdict}</span>
                    <span className="text-cyan-400 font-bold">{constellationData.summary.score}/100</span>
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
        {/* 2. REACTFLOW DETAILED CANVAS (For Topology & IOC Drilldown) */}
        {/* ======================================================== */}
        {viewMode !== 'constellation' && (
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
        {/* 3. SIDE TELEMETRY INSPECTOR DRAWER */}
        {/* ======================================================== */}
        {selectedEntity && (
          <div className="w-80 border-l border-[#1a293f] bg-[#0b1220]/95 backdrop-blur-md p-5 flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 shrink-0 z-30">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2b44] mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    {selectedEntity.type === 'node' ? 'Evidence Telemetry' : 'Evidence Link'}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    {selectedEntity.data.type || 'RELATIONSHIP'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEntity(null)} 
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#162338] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Entity Details Content */}
            <div className="space-y-3.5 text-xs text-slate-300 flex-1">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Identifier / Value</span>
                <span className="font-mono text-sm font-bold text-white break-all">
                  {selectedEntity.data.label || selectedEntity.label}
                </span>
              </div>

              {selectedEntity.data.sublabel && (
                <div className="p-2.5 rounded-lg bg-[#0e1726] border border-[#1b2b44]">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Forensic Details</span>
                  <p className="text-xs text-slate-300 leading-relaxed break-words">
                    {selectedEntity.data.sublabel}
                  </p>
                </div>
              )}

              {/* Status / Tag */}
              {selectedEntity.data.status && (
                <div className="p-2 rounded bg-[#0e1726] border border-[#1b2b44] flex justify-between items-center">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Status</span>
                  <span className="font-mono font-bold text-cyan-300">{selectedEntity.data.status}</span>
                </div>
              )}

              {/* Hop Details */}
              {selectedEntity.data.hopNumber !== undefined && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-[#0e1726] border border-[#1b2b44]">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Hop Index</span>
                    <span className="font-mono font-bold text-cyan-400">Hop #{selectedEntity.data.hopNumber}</span>
                  </div>
                  <div className="p-2 rounded bg-[#0e1726] border border-[#1b2b44]">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Delay</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedEntity.data.delaySec !== undefined ? `+${selectedEntity.data.delaySec}s` : '0s'}
                    </span>
                  </div>
                </div>
              )}

              {/* Geo / ASN Details */}
              {(selectedEntity.data.city || selectedEntity.data.asn) && (
                <div className="p-3 rounded-xl bg-[#0e1726] border border-[#1b2b44] space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Network &amp; Location Intelligence
                  </div>
                  {selectedEntity.data.city && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-slate-200 font-medium">
                        {selectedEntity.data.city}, {selectedEntity.data.country}
                      </span>
                    </div>
                  )}
                  {selectedEntity.data.asn && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Autonomous System:</span>
                      <span className="text-purple-300 font-mono font-semibold">{selectedEntity.data.asn}</span>
                    </div>
                  )}
                  {selectedEntity.data.isOrigin && (
                    <div className="mt-2 p-2 rounded bg-rose-950/70 border border-rose-800/80 text-[11px] text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Earliest reliable public source node identified in header chain.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 border-t border-[#1b2b44] space-y-2">
                <button
                  type="button"
                  onClick={() => handleCopyIdentifier(selectedEntity.data.label || selectedEntity.label)}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#142033] hover:bg-[#1c2c47] border border-[#223652] text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedId ? 'Copied to Clipboard!' : 'Copy Identifier'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RelationshipGraphView;
