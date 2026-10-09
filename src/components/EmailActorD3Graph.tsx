import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  Server, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play, 
  Pause, 
  Search, 
  Info, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  Shield, 
  Activity, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';

export interface D3ActorNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'sender' | 'relay' | 'recipient';
  label: string;
  sublabel: string;
  ip?: string;
  host?: string;
  email?: string;
  hopIndex?: number;
  totalHops?: number;
  delaySec?: number;
  cumulativeDelay?: number;
  city?: string;
  country?: string;
  countryCode?: string;
  asn?: string;
  org?: string;
  isp?: string;
  protocol?: string;
  reverseDns?: string;
  isOrigin?: boolean;
  isGateway?: boolean;
  isPrivate?: boolean;
  isProxyOrVpn?: boolean;
  isTor?: boolean;
  isCountryMismatch?: boolean;
  authStatus?: {
    spf?: string;
    dkim?: string;
    dmarc?: string;
  };
  clientSoftware?: string;
  riskSeverity: 'clean' | 'suspicious' | 'malicious' | 'neutral';
  anomalies: string[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3ActorLink extends d3.SimulationLinkDatum<D3ActorNode> {
  id: string;
  source: string | D3ActorNode;
  target: string | D3ActorNode;
  hopIndex?: number;
  delaySec?: number;
  protocol?: string;
  isEncrypted?: boolean;
}

interface EmailActorD3GraphProps {
  analysis: EmailAnalysis;
  onNavigateToHeaders?: () => void;
  className?: string;
}

export const EmailActorD3Graph: React.FC<EmailActorD3GraphProps> = ({
  analysis,
  onNavigateToHeaders,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3ActorNode, D3ActorLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<'pipeline' | 'force'>('pipeline');
  const [isSimulating, setIsSimulating] = useState(true);
  const [showLatencyLabels, setShowLatencyLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Build actor nodes and links from EmailAnalysis
  const { nodes, links, stats } = useMemo(() => {
    const rawHops = Array.isArray(analysis.hops) ? [...analysis.hops] : [];
    // Sort hops by hopNumber ascending
    const sortedHops = rawHops.sort((a, b) => (a.hopNumber || 0) - (b.hopNumber || 0));

    const actorNodes: D3ActorNode[] = [];
    const actorLinks: D3ActorLink[] = [];

    // Calculate total delay & cumulative delays
    let totalDelay = 0;
    let anomalousCount = 0;

    // 1. Sender Actor
    const senderIp = analysis.realSenderIp?.ip || sortedHops[0]?.fromIp;
    const senderHost = analysis.realSenderIp?.clientSoftware || sortedHops[0]?.fromHost || 'Origin Mail Client';
    const senderAnomalies: string[] = [];

    const spfStatus = analysis.authResults?.spf?.status || 'NONE';
    const dkimStatus = analysis.authResults?.dkim?.status || 'NONE';
    const dmarcStatus = analysis.authResults?.dmarc?.status || 'NONE';

    if (spfStatus === 'FAIL' || spfStatus === 'SOFTFAIL') senderAnomalies.push(`SPF ${spfStatus}`);
    if (dkimStatus === 'FAIL' || dkimStatus === 'INVALID') senderAnomalies.push(`DKIM ${dkimStatus}`);
    if (dmarcStatus === 'FAIL' || dmarcStatus === 'REJECT') senderAnomalies.push(`DMARC ${dmarcStatus}`);
    if (analysis.realSenderIp?.isProxyOrVpn) senderAnomalies.push('Sender IP flagged as Proxy/VPN');

    const senderRisk: 'clean' | 'suspicious' | 'malicious' | 'neutral' = 
      senderAnomalies.length >= 2 ? 'malicious' : senderAnomalies.length === 1 ? 'suspicious' : 'clean';

    const senderNode: D3ActorNode = {
      id: 'actor-sender',
      type: 'sender',
      label: analysis.headers.from || analysis.from || 'Origin Sender',
      sublabel: senderIp || 'Originating Client MUA',
      ip: senderIp,
      host: senderHost,
      email: analysis.headers.from || analysis.from,
      city: analysis.realSenderIp?.city || sortedHops[0]?.city,
      country: analysis.realSenderIp?.country || sortedHops[0]?.country,
      countryCode: analysis.realSenderIp?.countryCode || sortedHops[0]?.countryCode,
      asn: analysis.realSenderIp?.asn || sortedHops[0]?.asn,
      org: analysis.realSenderIp?.org || sortedHops[0]?.org,
      isp: analysis.realSenderIp?.isp || sortedHops[0]?.isp,
      reverseDns: analysis.realSenderIp?.reverseDns || sortedHops[0]?.reverseDns,
      authStatus: {
        spf: spfStatus,
        dkim: dkimStatus,
        dmarc: dmarcStatus
      },
      clientSoftware: analysis.realSenderIp?.clientSoftware,
      riskSeverity: senderRisk,
      anomalies: senderAnomalies
    };
    actorNodes.push(senderNode);

    // 2. Relay MTA Actors
    let cumulative = 0;
    sortedHops.forEach((hop, index) => {
      const hopDelay = typeof hop.delaySec === 'number' && !isNaN(hop.delaySec) ? hop.delaySec : 0;
      cumulative += hopDelay;
      totalDelay += hopDelay;

      const anomalies: string[] = [];
      if (hop.isTorExitNode || hop.is_tor) anomalies.push('Tor Exit Relay');
      if (hop.isProxyOrVpn || hop.is_vpn) anomalies.push('VPN / Anonymous Proxy');
      if (hop.countryMismatch) anomalies.push('Geo Routing Diverter / Mismatch');
      if (hop.isPrivate || hop.isRfc1918) anomalies.push('Private RFC1918 Subnet');
      if (hop.isBlacklisted) anomalies.push('IP on DNS Blacklist');
      if (hopDelay > 15) anomalies.push(`High Transit Delay (${hopDelay.toFixed(1)}s)`);

      if (anomalies.length > 0) anomalousCount++;

      let relayRisk: 'clean' | 'suspicious' | 'malicious' | 'neutral' = 'clean';
      if (hop.isTorExitNode || hop.is_tor || hop.isBlacklisted) relayRisk = 'malicious';
      else if (anomalies.length > 0) relayRisk = 'suspicious';

      const relayNode: D3ActorNode = {
        id: `actor-relay-${hop.hopNumber || index + 1}`,
        type: 'relay',
        label: hop.byHost || hop.fromHost || `Relay MTA #${hop.hopNumber || index + 1}`,
        sublabel: hop.fromIp || hop.reverseDns || `MTA Hop ${hop.hopNumber || index + 1}`,
        ip: hop.fromIp,
        host: hop.byHost || hop.fromHost,
        hopIndex: hop.hopNumber || index + 1,
        totalHops: sortedHops.length,
        delaySec: hopDelay,
        cumulativeDelay: cumulative,
        city: hop.city,
        country: hop.country,
        countryCode: hop.countryCode,
        asn: hop.asn,
        org: hop.org,
        isp: hop.isp,
        protocol: hop.protocol || 'ESMTPS',
        reverseDns: hop.reverseDns,
        isOrigin: hop.isOrigin || hop.hopRole === 'INTERNAL_ORIGIN' || hop.hopRole === 'EXTERNAL_ORIGIN',
        isGateway: hop.isPublicGateway || hop.hopRole === 'INGRESS_GATEWAY' || index === sortedHops.length - 1,
        isPrivate: hop.isPrivate || hop.isRfc1918,
        isProxyOrVpn: hop.isProxyOrVpn || hop.is_vpn,
        isTor: hop.isTorExitNode || hop.is_tor,
        isCountryMismatch: hop.countryMismatch,
        riskSeverity: relayRisk,
        anomalies
      };
      actorNodes.push(relayNode);
    });

    // 3. Recipient Actor
    const lastHop = sortedHops[sortedHops.length - 1];
    const recipientNode: D3ActorNode = {
      id: 'actor-recipient',
      type: 'recipient',
      label: analysis.headers.to || analysis.to || 'Recipient Mailbox',
      sublabel: lastHop?.byHost ? `Delivered via ${lastHop.byHost}` : 'Destination MX',
      email: analysis.headers.to || analysis.to,
      host: lastHop?.byHost || 'Recipient MX Server',
      ip: lastHop?.fromIp,
      city: lastHop?.city,
      country: lastHop?.country,
      countryCode: lastHop?.countryCode,
      asn: lastHop?.asn,
      org: lastHop?.org,
      riskSeverity: 'clean',
      anomalies: []
    };
    actorNodes.push(recipientNode);

    // 4. Construct sequential links
    if (sortedHops.length === 0) {
      // Direct link from sender to recipient
      actorLinks.push({
        id: 'link-sender-recipient',
        source: 'actor-sender',
        target: 'actor-recipient',
        hopIndex: 1,
        delaySec: 0,
        protocol: 'Direct SMTP',
        isEncrypted: true
      });
    } else {
      // Sender -> Hop 1
      actorLinks.push({
        id: `link-sender-to-relay-1`,
        source: 'actor-sender',
        target: `actor-relay-${sortedHops[0].hopNumber || 1}`,
        hopIndex: 1,
        delaySec: sortedHops[0].delaySec || 0,
        protocol: sortedHops[0].protocol || 'ESMTPA',
        isEncrypted: (sortedHops[0].protocol || '').toUpperCase().includes('S')
      });

      // Hop i -> Hop i+1
      for (let i = 0; i < sortedHops.length - 1; i++) {
        const fromHop = sortedHops[i];
        const toHop = sortedHops[i + 1];
        actorLinks.push({
          id: `link-relay-${fromHop.hopNumber || i + 1}-to-${toHop.hopNumber || i + 2}`,
          source: `actor-relay-${fromHop.hopNumber || i + 1}`,
          target: `actor-relay-${toHop.hopNumber || i + 2}`,
          hopIndex: toHop.hopNumber || i + 2,
          delaySec: toHop.delaySec || 0,
          protocol: toHop.protocol || 'ESMTPS',
          isEncrypted: (toHop.protocol || '').toUpperCase().includes('S') || (toHop.protocol || '').toUpperCase().includes('TLS')
        });
      }

      // Last Hop -> Recipient
      const finalHop = sortedHops[sortedHops.length - 1];
      actorLinks.push({
        id: `link-relay-${finalHop.hopNumber || sortedHops.length}-to-recipient`,
        source: `actor-relay-${finalHop.hopNumber || sortedHops.length}`,
        target: 'actor-recipient',
        hopIndex: (finalHop.hopNumber || sortedHops.length) + 1,
        delaySec: 0,
        protocol: 'Local Ingress Delivery',
        isEncrypted: true
      });
    }

    return {
      nodes: actorNodes,
      links: actorLinks,
      stats: {
        totalActors: actorNodes.length,
        relayHops: sortedHops.length,
        totalDelaySec: totalDelay,
        anomalousCount
      }
    };
  }, [analysis]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  // Filtered nodes matching search query
  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    nodes.forEach(n => {
      if (
        n.label.toLowerCase().includes(q) ||
        n.sublabel.toLowerCase().includes(q) ||
        (n.ip && n.ip.toLowerCase().includes(q)) ||
        (n.host && n.host.toLowerCase().includes(q)) ||
        (n.email && n.email.toLowerCase().includes(q)) ||
        (n.city && n.city.toLowerCase().includes(q)) ||
        (n.country && n.country.toLowerCase().includes(q)) ||
        (n.asn && n.asn.toLowerCase().includes(q))
      ) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [nodes, searchQuery]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // D3 Visualization Render Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth || 900;
    const height = 480;

    svg.attr('width', width).attr('height', height);

    // Clear previous contents
    svg.selectAll('*').remove();

    // Defs for gradients, arrowheads, and glow filters
    const defs = svg.append('defs');

    // Arrowhead marker
    defs.append('marker')
      .attr('id', 'actor-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 38)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#6366f1')
      .attr('opacity', 0.85);

    // Alert arrowhead marker
    defs.append('marker')
      .attr('id', 'actor-arrow-alert')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 38)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#f59e0b')
      .attr('opacity', 0.95);

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'actor-glow')
      .attr('x', '-30%')
      .attr('y', '-30%')
      .attr('width', '160%')
      .attr('height', '160%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Gradients for node cards
    const senderGrad = defs.append('linearGradient')
      .attr('id', 'grad-sender')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    senderGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1e293b');
    senderGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a');

    const relayGrad = defs.append('linearGradient')
      .attr('id', 'grad-relay')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    relayGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1e1b4b');
    relayGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a');

    const recipientGrad = defs.append('linearGradient')
      .attr('id', 'grad-recipient')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    recipientGrad.append('stop').attr('offset', '0%').attr('stop-color', '#064e3b');
    recipientGrad.append('stop').attr('offset', '100%').attr('stop-color', '#022c22');

    // Main Zoom Container Group
    const g = svg.append('g').attr('class', 'main-scene');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Clone data for D3 simulation to prevent direct mutation issues
    const simNodes: D3ActorNode[] = nodes.map((d, index) => {
      // In pipeline mode, preset initial positions sequentially from left to right
      const total = nodes.length;
      const stepX = (width - 180) / Math.max(1, total - 1);
      const targetX = 90 + index * stepX;
      // Stagger Y slightly if there are many hops to avoid overcrowding
      const staggerY = height / 2 + (index % 2 === 1 ? 25 : -25);
      return {
        ...d,
        x: targetX,
        y: staggerY
      };
    });

    const simLinks: D3ActorLink[] = links.map(l => ({ ...l }));

    // Setup Simulation
    const simulation = d3.forceSimulation<D3ActorNode, D3ActorLink>(simNodes);

    if (layoutMode === 'pipeline') {
      // Pipeline Force Layout: strongly pulls nodes along ordered horizontal sequence
      const total = simNodes.length;
      const stepX = (width - 180) / Math.max(1, total - 1);

      simulation
        .force('link', d3.forceLink<D3ActorNode, D3ActorLink>(simLinks)
          .id(d => d.id)
          .distance(stepX)
          .strength(0.8)
        )
        .force('charge', d3.forceManyBody().strength(-200))
        .force('collide', d3.forceCollide().radius(50))
        .force('x', d3.forceX<D3ActorNode>((d, i) => 90 + i * stepX).strength(0.9))
        .force('y', d3.forceY(height / 2).strength(0.3));
    } else {
      // Organic Dynamic Force Layout
      simulation
        .force('link', d3.forceLink<D3ActorNode, D3ActorLink>(simLinks)
          .id(d => d.id)
          .distance(150)
          .strength(0.6)
        )
        .force('charge', d3.forceManyBody().strength(-550))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius(55));
    }

    simulationRef.current = simulation;

    // Draw Links
    const linkGroup = g.append('g').attr('class', 'links');
    const linkPaths = linkGroup.selectAll<SVGPathElement, D3ActorLink>('path')
      .data(simLinks)
      .enter()
      .append('path')
      .attr('stroke', d => (d.delaySec && d.delaySec > 5) ? '#f59e0b' : '#6366f1')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.65)
      .attr('stroke-dasharray', d => d.isEncrypted ? 'none' : '4,3')
      .attr('fill', 'none')
      .attr('marker-end', d => (d.delaySec && d.delaySec > 5) ? 'url(#actor-arrow-alert)' : 'url(#actor-arrow)');

    // Link Text Labels (Transit Delay & Protocol)
    const linkLabelGroup = g.append('g').attr('class', 'link-labels');
    const linkLabels = linkLabelGroup.selectAll<SVGTextElement, D3ActorLink>('text')
      .data(simLinks)
      .enter()
      .append('text')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('fill', d => (d.delaySec && d.delaySec > 5) ? '#fbbf24' : '#94a3b8')
      .attr('text-anchor', 'middle')
      .attr('dy', -6)
      .attr('display', showLatencyLabels ? 'inline' : 'none')
      .text(d => {
        const parts: string[] = [];
        if (typeof d.delaySec === 'number' && d.delaySec > 0) {
          parts.push(`+${d.delaySec.toFixed(1)}s`);
        }
        if (d.protocol) {
          parts.push(d.protocol);
        }
        return parts.join(' • ');
      });

    // Draw Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup.selectAll<SVGGElement, D3ActorNode>('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'actor-node-item')
      .attr('cursor', 'grab')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNodeId(prev => prev === d.id ? null : d.id);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

    // Node Outer Glow / Selection Ring
    nodeElements.append('circle')
      .attr('r', 34)
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('stroke', d => {
        if (d.riskSeverity === 'malicious') return '#ef4444';
        if (d.riskSeverity === 'suspicious') return '#f59e0b';
        if (d.type === 'sender') return '#38bdf8';
        if (d.type === 'recipient') return '#10b981';
        return '#818cf8';
      })
      .attr('stroke-dasharray', d => d.anomalies.length > 0 ? '4,2' : 'none')
      .attr('opacity', d => (d.id === selectedNodeId || d.id === hoveredNodeId) ? 1 : 0.4);

    // Node Main Circle Body
    nodeElements.append('circle')
      .attr('r', 28)
      .attr('fill', d => {
        if (d.type === 'sender') return 'url(#grad-sender)';
        if (d.type === 'recipient') return 'url(#grad-recipient)';
        return 'url(#grad-relay)';
      })
      .attr('stroke', d => {
        if (d.id === selectedNodeId) return '#ffffff';
        if (d.riskSeverity === 'malicious') return '#ef4444';
        if (d.riskSeverity === 'suspicious') return '#f59e0b';
        if (d.type === 'sender') return '#38bdf8';
        if (d.type === 'recipient') return '#10b981';
        return '#6366f1';
      })
      .attr('stroke-width', d => d.id === selectedNodeId ? 2.5 : 1.5);

    // Node Icon / Symbol (SVG Text or Shape)
    nodeElements.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '14px')
      .attr('fill', d => {
        if (d.riskSeverity === 'malicious') return '#fca5a5';
        if (d.riskSeverity === 'suspicious') return '#fde047';
        if (d.type === 'sender') return '#7dd3fc';
        if (d.type === 'recipient') return '#6ee7b7';
        return '#c7d2fe';
      })
      .text(d => {
        if (d.type === 'sender') return '✉';
        if (d.type === 'recipient') return '📥';
        return `H${d.hopIndex || ''}`;
      });

    // Badge Pill Above Node (Role or Hop Index)
    nodeElements.append('rect')
      .attr('x', -24)
      .attr('y', -42)
      .attr('width', 48)
      .attr('height', 14)
      .attr('rx', 7)
      .attr('fill', d => {
        if (d.type === 'sender') return '#0284c7';
        if (d.type === 'recipient') return '#059669';
        if (d.riskSeverity === 'malicious') return '#dc2626';
        if (d.riskSeverity === 'suspicious') return '#d97706';
        return '#4338ca';
      })
      .attr('opacity', 0.9);

    nodeElements.append('text')
      .attr('x', 0)
      .attr('y', -32)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'sans-serif')
      .attr('fill', '#ffffff')
      .text(d => {
        if (d.type === 'sender') return 'SENDER';
        if (d.type === 'recipient') return 'TARGET';
        return `HOP #${d.hopIndex}`;
      });

    // Primary Label (Title)
    nodeElements.append('text')
      .attr('x', 0)
      .attr('y', 42)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif')
      .attr('fill', '#f1f5f9')
      .text(d => {
        const str = d.label || d.host || 'Actor';
        return str.length > 20 ? str.slice(0, 18) + '…' : str;
      });

    // Sublabel (IP Address or Geo)
    nodeElements.append('text')
      .attr('x', 0)
      .attr('y', 55)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('fill', '#94a3b8')
      .text(d => {
        if (d.ip) {
          const geo = d.countryCode ? ` [${d.countryCode}]` : '';
          return `${d.ip}${geo}`;
        }
        return d.sublabel.length > 22 ? d.sublabel.slice(0, 20) + '…' : d.sublabel;
      });

    // Auth Pill Indicator for Sender Node
    nodeElements.filter(d => d.type === 'sender' && !!d.authStatus)
      .append('text')
      .attr('x', 0)
      .attr('y', 67)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('fill', d => {
        const s = d.authStatus?.spf;
        const dk = d.authStatus?.dkim;
        const dm = d.authStatus?.dmarc;
        if (s === 'PASS' && dk === 'PASS' && dm === 'PASS') return '#34d399';
        if (s === 'FAIL' || dk === 'FAIL' || dm === 'FAIL') return '#f87171';
        return '#fbbf24';
      })
      .text(d => `SPF:${d.authStatus?.spf || '—'} DKIM:${d.authStatus?.dkim || '—'}`);

    // Drag behavior
    const drag = d3.drag<SVGGElement, D3ActorNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent.target).attr('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // keep node pinned where user dropped it or unpin in force mode
        if (layoutMode === 'force') {
          d.fx = null;
          d.fy = null;
        }
        d3.select(event.sourceEvent.target).attr('cursor', 'grab');
      });

    nodeElements.call(drag);

    // Click background to deselect
    svg.on('click', () => {
      setSelectedNodeId(null);
    });

    // Simulation Tick Callback
    simulation.on('tick', () => {
      // Update link curves
      linkPaths.attr('d', d => {
        const source = d.source as D3ActorNode;
        const target = d.target as D3ActorNode;
        if (!source.x || !source.y || !target.x || !target.y) return '';

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        // Mild curvature for aesthetic fluid graph arcs
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
      });

      // Update link labels
      linkLabels
        .attr('x', d => {
          const source = d.source as D3ActorNode;
          const target = d.target as D3ActorNode;
          return (source.x! + target.x!) / 2;
        })
        .attr('y', d => {
          const source = d.source as D3ActorNode;
          const target = d.target as D3ActorNode;
          // Arch slightly above center
          return (source.y! + target.y!) / 2 - 12;
        });

      // Update node positions
      nodeElements.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Initial Zoom Fit
    const fitView = () => {
      const bounds = g.node()?.getBBox();
      if (!bounds || bounds.width === 0 || bounds.height === 0) return;

      const fullWidth = width;
      const fullHeight = height;
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      const scale = Math.min(0.9, 0.85 / Math.max(bounds.width / fullWidth, bounds.height / fullHeight));
      const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

      svg.transition()
        .duration(600)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
    };

    // Auto fit after simulation warms up
    const timer = setTimeout(fitView, 350);

    return () => {
      clearTimeout(timer);
      simulation.stop();
    };
  }, [nodes, links, layoutMode, showLatencyLabels, selectedNodeId, hoveredNodeId]);

  // Pause / Resume simulation
  const toggleSimulation = () => {
    if (!simulationRef.current) return;
    if (isSimulating) {
      simulationRef.current.stop();
      setIsSimulating(false);
    } else {
      simulationRef.current.alpha(0.3).restart();
      setIsSimulating(true);
    }
  };

  // Zoom Controls
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
  };

  const handleResetView = () => {
    if (!svgRef.current || !zoomBehaviorRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select('.main-scene');
    const bounds = (g.node() as SVGGElement)?.getBBox();
    if (!bounds || bounds.width === 0) return;

    const width = containerRef.current.clientWidth || 900;
    const height = 480;
    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;
    const scale = Math.min(0.9, 0.85 / Math.max(bounds.width / width, bounds.height / height));
    const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

    svg.transition().duration(400).call(
      zoomBehaviorRef.current.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  };

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col bg-[#0b0f19] border border-slate-800 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : 'h-[540px]'
      } ${className}`}
    >
      {/* Top Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 text-xs text-slate-300 z-10">
        {/* Left: Title & Actor Summary Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
              <Activity className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-slate-100 tracking-wide">
              D3 Interactive Actor Flow Graph
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-700/60 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300">
              Sender: 1
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300">
              Relay MTAs: {stats.relayHops}
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
              Recipient: 1
            </span>
            {stats.totalDelaySec > 0 && (
              <span className="hidden md:inline-flex px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                <Clock className="w-3 h-3 mr-1 inline self-center text-amber-400" />
                {stats.totalDelaySec.toFixed(1)}s transit
              </span>
            )}
            {stats.anomalousCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700 text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.anomalousCount} Anomalies
              </span>
            )}
          </div>
        </div>

        {/* Right: Controls & Search */}
        <div className="flex items-center gap-2">
          {/* Quick Filter Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search IP, host, actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 w-32 sm:w-44 text-xs bg-slate-900/80 border border-slate-700/80 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Layout Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-md border border-slate-800">
            <button
              onClick={() => setLayoutMode('pipeline')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                layoutMode === 'pipeline'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Sequential Mail Hop Pipeline Layout"
            >
              Pipeline
            </button>
            <button
              onClick={() => setLayoutMode('force')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                layoutMode === 'force'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Organic Force-Directed Simulation Layout"
            >
              Dynamic
            </button>
          </div>

          {/* Toggle Latency Labels */}
          <button
            onClick={() => setShowLatencyLabels(!showLatencyLabels)}
            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
              showLatencyLabels 
                ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Transit Latency Labels"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Physics */}
          <button
            onClick={toggleSimulation}
            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
              isSimulating 
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100' 
                : 'bg-amber-950/70 border-amber-700 text-amber-300'
            }`}
            title={isSimulating ? 'Freeze Physics Simulation' : 'Unfreeze Simulation'}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive D3 SVG Canvas */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-radial from-[#131b2e] via-[#0b0f19] to-[#07090e]">
        <svg 
          ref={svgRef} 
          className="w-full h-full select-none cursor-grab active:cursor-grabbing"
        />

        {/* Floating Quick Legend / Guide */}
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 p-2 bg-[#090d16]/85 backdrop-blur-md rounded-lg border border-slate-800 text-[10px] text-slate-400 pointer-events-none select-none z-10">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Sender</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            <span>Relay MTA</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Recipient</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Anomaly / Diverter</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Drag nodes • Scroll to zoom • Click for telemetry</span>
        </div>

        {/* Selected Actor Deep Telemetry Drawer */}
        {selectedNode && (
          <div className="absolute top-3 right-3 w-80 max-h-[calc(100%-1.5rem)] overflow-y-auto bg-[#0f172a]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-4 shadow-2xl text-xs text-slate-300 z-20 transition-all duration-200 animate-in fade-in slide-in-from-right-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border ${
                  selectedNode.type === 'sender'
                    ? 'bg-blue-950/70 border-blue-700 text-blue-400'
                    : selectedNode.type === 'recipient'
                    ? 'bg-emerald-950/70 border-emerald-700 text-emerald-400'
                    : 'bg-indigo-950/70 border-indigo-700 text-indigo-400'
                }`}>
                  {selectedNode.type === 'sender' ? <Mail className="w-4 h-4" /> : selectedNode.type === 'recipient' ? <ShieldCheck className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                </span>
                <div>
                  <div className="font-semibold text-slate-100 uppercase text-[10px] tracking-wider text-slate-400">
                    {selectedNode.type === 'sender' ? 'Email Origin Sender' : selectedNode.type === 'recipient' ? 'Final Recipient Mailbox' : `Relay MTA Hop #${selectedNode.hopIndex}`}
                  </div>
                  <div className="font-medium text-slate-200 truncate max-w-[190px]" title={selectedNode.label}>
                    {selectedNode.label}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Risk / Anomaly Alert if present */}
            {selectedNode.anomalies.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Detected Hop Anomalies</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px] text-amber-300/90 pl-1">
                  {selectedNode.anomalies.map((anom, idx) => (
                    <li key={idx}>{anom}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Telemetry Attributes */}
            <div className="mt-3 space-y-2 font-mono text-[11px]">
              {selectedNode.ip && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">IP Address</span>
                  <div className="flex items-center gap-1">
                    <span className="text-indigo-300 font-semibold">{selectedNode.ip}</span>
                    <button
                      onClick={() => handleCopy(selectedNode.ip!, 'ip')}
                      className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Copy IP"
                    >
                      {copiedText === 'ip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              {selectedNode.host && (
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800 space-y-0.5">
                  <div className="text-slate-400 text-[10px]">Host / Identified Name</div>
                  <div className="text-slate-200 break-all">{selectedNode.host}</div>
                </div>
              )}

              {(selectedNode.city || selectedNode.country) && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Location</span>
                  <span className="text-slate-200 font-sans">
                    {selectedNode.city ? `${selectedNode.city}, ` : ''}{selectedNode.country || 'Unknown'} {selectedNode.countryCode ? `(${selectedNode.countryCode})` : ''}
                  </span>
                </div>
              )}

              {selectedNode.asn && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">ASN / ISP</span>
                  <span className="text-slate-300 truncate max-w-[150px]" title={`${selectedNode.asn} ${selectedNode.isp || ''}`}>
                    {selectedNode.asn}
                  </span>
                </div>
              )}

              {typeof selectedNode.delaySec === 'number' && selectedNode.delaySec > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Hop Delay</span>
                  <span className="text-amber-400 font-semibold">
                    +{selectedNode.delaySec.toFixed(2)} seconds
                  </span>
                </div>
              )}

              {typeof selectedNode.cumulativeDelay === 'number' && selectedNode.cumulativeDelay > 0 && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Cumulative Time</span>
                  <span className="text-slate-300">
                    +{selectedNode.cumulativeDelay.toFixed(2)}s elapsed
                  </span>
                </div>
              )}

              {selectedNode.protocol && (
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Protocol</span>
                  <span className="text-emerald-400">{selectedNode.protocol}</span>
                </div>
              )}

              {selectedNode.authStatus && (
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[10px]">Authentication Verdicts</div>
                  <div className="grid grid-cols-3 gap-1 text-center font-bold text-[10px]">
                    <div className={`p-1 rounded ${selectedNode.authStatus.spf === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                      SPF: {selectedNode.authStatus.spf || 'NONE'}
                    </div>
                    <div className={`p-1 rounded ${selectedNode.authStatus.dkim === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                      DKIM: {selectedNode.authStatus.dkim || 'NONE'}
                    </div>
                    <div className={`p-1 rounded ${selectedNode.authStatus.dmarc === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                      DMARC: {selectedNode.authStatus.dmarc || 'NONE'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {onNavigateToHeaders && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <button
                  onClick={onNavigateToHeaders}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  <span>Inspect in Raw RFC822 Headers</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
