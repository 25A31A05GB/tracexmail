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
  Maximize2
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';
import { API_URL } from '../lib/api';

// Custom Entity Node
const CustomGraphNode = ({ data }: any) => {
  const { 
    type, 
    label, 
    sublabel, 
    riskLevel, 
    isOrigin, 
    isDiverter, 
    isPrivate, 
    asn, 
    city, 
    country, 
    hopNumber,
    protocol,
    delaySec,
    isTor,
    isVpn,
    selected
  } = data;

  let Icon = FileText;
  let bgClass = "bg-slate-900";
  let borderClass = "border-slate-700";
  let textClass = "text-slate-200";
  let iconClass = "text-slate-400";
  let badgeColor = "bg-slate-800 text-slate-400";

  if (type === 'sender') {
    Icon = Mail;
    bgClass = "bg-blue-950/70";
    borderClass = "border-blue-500/80";
    iconClass = "text-blue-400";
    badgeColor = "bg-blue-900/60 text-blue-300";
  } else if (type === 'alias') {
    Icon = UserCheck;
    bgClass = "bg-amber-950/60";
    borderClass = "border-amber-500/70";
    iconClass = "text-amber-400";
    badgeColor = "bg-amber-900/60 text-amber-300";
  } else if (type === 'reply_to') {
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
  } else if (type === 'domain') {
    Icon = Globe;
    bgClass = "bg-indigo-950/70";
    borderClass = "border-indigo-500/60";
    iconClass = "text-indigo-400";
    badgeColor = "bg-indigo-900/60 text-indigo-300";
  } else if (type === 'ip') {
    Icon = Server;
    if (isOrigin) {
      bgClass = "bg-red-950/80";
      borderClass = "border-red-500/90";
      iconClass = "text-red-400";
      badgeColor = "bg-red-900/80 text-red-200 font-bold";
    } else if (isPrivate) {
      bgClass = "bg-slate-900/80";
      borderClass = "border-cyan-500/50";
      iconClass = "text-cyan-400";
      badgeColor = "bg-cyan-950/80 text-cyan-300";
    } else {
      bgClass = "bg-slate-900";
      borderClass = "border-slate-700";
      iconClass = "text-slate-300";
      badgeColor = "bg-slate-800 text-slate-400";
    }
  } else if (type === 'relay_hop') {
    Icon = Network;
    bgClass = isPrivate ? "bg-slate-950/90" : isOrigin ? "bg-red-950/80" : "bg-slate-900";
    borderClass = isOrigin ? "border-red-500" : isPrivate ? "border-cyan-600/70" : "border-slate-600";
    iconClass = isOrigin ? "text-red-400" : isPrivate ? "text-cyan-400" : "text-slate-300";
    badgeColor = "bg-slate-800 text-slate-300";
  } else if (type === 'asn') {
    Icon = Building2;
    bgClass = "bg-purple-950/70";
    borderClass = "border-purple-500/70";
    iconClass = "text-purple-400";
    badgeColor = "bg-purple-900/60 text-purple-300";
  } else if (type === 'recipient') {
    Icon = CheckCircle2;
    bgClass = "bg-emerald-950/70";
    borderClass = "border-emerald-500/80";
    iconClass = "text-emerald-400";
    badgeColor = "bg-emerald-900/60 text-emerald-300";
  }

  return (
    <div
      className={`relative px-3.5 py-2.5 rounded-xl border ${bgClass} ${borderClass} shadow-xl flex flex-col gap-1 min-w-[190px] max-w-[260px] transition-all duration-150 ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950 scale-105' : 'hover:scale-[1.02]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />

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

      {/* Geo / ASN / Protocol Pills */}
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

        {delaySec !== undefined && delaySec > 0 && (
          <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
            +{delaySec}s
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-blue-400 !border-slate-950" />
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
  const [viewMode, setViewMode] = useState<'relay_pipeline' | 'cluster'>('relay_pipeline');
  const [hidePrivateHops, setHidePrivateHops] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Extract from Analysis or default
  const effectiveAnalysis = analysis;

  // Synthesize Graph Model from EmailAnalysis
  useEffect(() => {
    if (!effectiveAnalysis) return;

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const hops = effectiveAnalysis.hops || [];
    const filteredHops = hidePrivateHops ? hops.filter(h => !h.isPrivate) : hops;

    // 1. Sender Node
    const senderEmail = effectiveAnalysis.from || 'sender@unknown.com';
    const senderMatch = senderEmail.match(/^(.*?)(?:<(.+?)>)?$/);
    const senderName = senderMatch && senderMatch[2] ? senderMatch[1].trim() : '';
    const cleanSenderAddr = senderMatch && senderMatch[2] ? senderMatch[2].trim() : senderEmail;
    const senderDomain = cleanSenderAddr.includes('@') ? cleanSenderAddr.split('@')[1] : 'unknown-domain.com';

    newNodes.push({
      id: 'node-sender',
      type: 'entity',
      position: { x: 300, y: 30 },
      data: {
        type: 'sender',
        label: cleanSenderAddr,
        sublabel: 'Header From / Envelope Sender',
        riskLevel: effectiveAnalysis.threatVerdict,
        raw: effectiveAnalysis.from
      }
    });

    // 2. Sender Alias / Claimed Identity Node
    if (senderName) {
      newNodes.push({
        id: 'node-alias',
        type: 'entity',
        position: { x: 40, y: 30 },
        data: {
          type: 'alias',
          label: senderName,
          sublabel: 'Claimed Display Name / Executive Alias',
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

    // 3. Sender Domain Node
    newNodes.push({
      id: 'node-domain',
      type: 'entity',
      position: { x: 580, y: 30 },
      data: {
        type: 'domain',
        label: senderDomain,
        sublabel: effectiveAnalysis.domain_intelligence?.registrar || 'Sender Registered Domain',
        registrar: effectiveAnalysis.domain_intelligence?.registrar,
        domainAge: effectiveAnalysis.domain_intelligence?.domain_age_days
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

    // 4. Reply-To Node (Check for Deceptive Diverter)
    const effectiveReplyTo = effectiveAnalysis.replyTo || effectiveAnalysis.headers?.replyTo;
    if (effectiveReplyTo && effectiveReplyTo !== effectiveAnalysis.from) {
      const isDiverted = effectiveReplyTo.toLowerCase() !== cleanSenderAddr.toLowerCase();
      newNodes.push({
        id: 'node-replyto',
        type: 'entity',
        position: { x: 40, y: 150 },
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
        label: isDiverted ? 'HIJACKED REPLY CHAIN' : 'replies to',
        type: 'smoothstep',
        animated: isDiverted,
        style: { stroke: isDiverted ? '#f43f5e' : '#94a3b8', strokeWidth: isDiverted ? 2.5 : 1, strokeDasharray: isDiverted ? '5,5' : undefined },
        labelStyle: { fill: isDiverted ? '#f43f5e' : '#94a3b8', fontSize: 10, fontWeight: isDiverted ? 'bold' : 'normal' },
        labelBgStyle: { fill: '#0f172a', stroke: isDiverted ? '#881337' : '#1e293b' }
      });
    }

    // 5. Sequential Relay Transmission Path Hops
    let prevHopNodeId = 'node-sender';
    let currentY = 160;

    filteredHops.forEach((hop, idx) => {
      const hopNodeId = `node-hop-${hop.hopNumber || idx + 1}`;
      const hopIp = hop.fromIp || hop.fromHost || `hop-${idx + 1}`;
      const isOriginHop = hop.isOrigin || (idx === 0 && !hop.isPrivate);

      // Layout positioning
      const hopX = viewMode === 'relay_pipeline' ? 300 : (idx % 2 === 0 ? 200 : 420);
      const hopY = currentY;
      currentY += 120;

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

      // Edge from previous node
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

      // If hop has an ASN and it's a public node, add ASN node
      if (hop.asn && !hop.isPrivate) {
        const asnNodeId = `node-asn-${hop.asn.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!newNodes.some(n => n.id === asnNodeId)) {
          newNodes.push({
            id: asnNodeId,
            type: 'entity',
            position: { x: hopX + 240, y: hopY },
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

    // 6. Recipient Mailbox Node
    const recipientEmail = effectiveAnalysis.to || 'recipient@company.com';
    newNodes.push({
      id: 'node-recipient',
      type: 'entity',
      position: { x: 300, y: currentY + 20 },
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

    // Filter nodes based on search
    const filteredNodes = searchFilter.trim() 
      ? newNodes.filter(n => 
          String(n.data?.label || '').toLowerCase().includes(searchFilter.toLowerCase()) || 
          String(n.data?.sublabel || '').toLowerCase().includes(searchFilter.toLowerCase())
        )
      : newNodes;

    setNodes(filteredNodes);
    setEdges(newEdges);
  }, [effectiveAnalysis, viewMode, hidePrivateHops, searchFilter]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedEntity({ type: 'node', data: node.data });
    if (onSelectNode) onSelectNode(node.data);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setSelectedEntity({ type: 'edge', data: edge.data, label: edge.label });
  };

  return (
    <div className="relative h-full min-h-[600px] bg-[#0B1120] rounded-2xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
      {/* Top Toolbar */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Threat Infrastructure &amp; Relay Path Graph</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-300 font-mono">
                {nodes.length} ENTITIES • {edges.length} RELATIONS
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Correlating sender domains, IP hops, aliases, reply diverters &amp; autonomous system paths
            </p>
          </div>
        </div>

        {/* Filters & View Switches */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search entities / IPs..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
            />
          </div>

          {/* Toggle View Layout */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('relay_pipeline')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'relay_pipeline'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Relay Pipeline
            </button>
            <button
              onClick={() => setViewMode('cluster')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'cluster'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cluster View
            </button>
          </div>

          {/* Toggle Private LAN Hops */}
          <button
            onClick={() => setHidePrivateHops(!hidePrivateHops)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              hidePrivateHops
                ? 'bg-cyan-950/70 border-cyan-700 text-cyan-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Filter RFC 1918 Private Address Relays"
          >
            {hidePrivateHops ? 'Showing: Public Only' : 'Include RFC 1918'}
          </button>
        </div>
      </div>

      {/* Main Canvas + Side Detail Inspector */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* ReactFlow Canvas */}
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
          <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-xs backdrop-blur-md shadow-xl max-w-xs pointer-events-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Entity Legend &amp; Relay Flow</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-slate-300">Sender / Envelope</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-300 font-medium">Origin IP / Tor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-amber-300">Claimed Alias</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-rose-300 font-medium">Reply Diverter</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-cyan-300">Transit Relay Hop</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-purple-300">ASN / ISP Provider</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-300">Target Inbox</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400" />
                <span className="text-slate-400 font-mono">Numbered Hop</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inspector Side Drawer */}
        {selectedEntity && (
          <div className="w-80 border-l border-slate-800 bg-slate-950/95 backdrop-blur-md p-5 flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200 shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    {selectedEntity.type === 'node' ? 'Entity Telemetry' : 'Relay Relationship'}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {selectedEntity.data.type || 'HOP_LINK'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEntity(null)} 
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Role / Function</span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedEntity.data.sublabel}
                  </p>
                </div>
              )}

              {/* Hop Details */}
              {selectedEntity.data.hopNumber !== undefined && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Hop Index</span>
                    <span className="font-mono font-bold text-cyan-400">Hop #{selectedEntity.data.hopNumber}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Delay</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedEntity.data.delaySec !== undefined ? `+${selectedEntity.data.delaySec}s` : '0s'}
                    </span>
                  </div>
                </div>
              )}

              {/* Geo / ASN Details */}
              {(selectedEntity.data.city || selectedEntity.data.asn) && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Geographic &amp; Network Attribution
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
                    <div className="mt-2 p-2 rounded bg-red-950/70 border border-red-800/80 text-[11px] text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Earliest reliable public source node identified in header chain.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedEntity.data.label || selectedEntity.label);
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Copy Identifier</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
