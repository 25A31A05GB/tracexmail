import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  Mail, 
  Server, 
  Inbox, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  Globe, 
  Lock, 
  Unlock, 
  Play, 
  Pause, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  Download, 
  Copy, 
  Check, 
  Filter, 
  Activity, 
  X, 
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { EmailAnalysis, EmailHop } from '../types';

export type GraphLayoutMode = 'pipeline' | 'force' | 'radial';

export interface GraphActorNode extends d3.SimulationNodeDatum {
  id: string;
  role: 'sender' | 'relay' | 'recipient' | 'diverter' | 'return_path';
  label: string;
  sublabel: string;
  displayName: string;
  ip?: string;
  host?: string;
  asn?: string;
  isp?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  hopNumber?: number;
  totalHops?: number;
  delaySec?: number;
  protocol?: string;
  tlsEncrypted?: boolean;
  status: 'legitimate' | 'suspicious' | 'malicious' | 'neutral';
  isOrigin?: boolean;
  isDestination?: boolean;
  isPrivate?: boolean;
  isTor?: boolean;
  isVpn?: boolean;
  isAnomaly?: boolean;
  anomalyReason?: string;
  authSummary?: {
    spf?: string;
    dkim?: string;
    dmarc?: string;
  };
  rawHeader?: string;
  radius: number;
  color: string;
  borderColor: string;
  glowColor?: string;
  iconType: 'user' | 'mail' | 'server' | 'shield' | 'alert' | 'inbox' | 'repeat';
  targetX?: number;
  targetY?: number;
}

export interface GraphActorLink extends d3.SimulationLinkDatum<GraphActorNode> {
  id: string;
  source: string | GraphActorNode;
  target: string | GraphActorNode;
  type: 'hop_chain' | 'diverter' | 'return_path';
  label?: string;
  delaySec?: number;
  protocol?: string;
  encrypted?: boolean;
  isSuspicious?: boolean;
}

interface D3MailActorGraphProps {
  analysis: EmailAnalysis;
  height?: number;
  className?: string;
  onNavigateToGraph?: () => void;
  onNavigateToHopView?: () => void;
}

export function D3MailActorGraph({
  analysis,
  height = 500,
  className = '',
  onNavigateToGraph,
  onNavigateToHopView
}: D3MailActorGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Component state
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('pipeline');
  const [selectedNode, setSelectedNode] = useState<GraphActorNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filterExternalOnly, setFilterExternalOnly] = useState<boolean>(false);
  const [highlightAnomalies, setHighlightAnomalies] = useState<boolean>(false);
  const [isAnimationActive, setIsAnimationActive] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  // Handle clipboard copying
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Build actors & relationships graph model
  const { nodes, links, actorStats } = useMemo(() => {
    if (!analysis) {
      return { nodes: [], links: [], actorStats: { totalHops: 0, totalDelay: 0, anomaliesCount: 0 } };
    }

    const rawHops = Array.isArray(analysis.hops) ? analysis.hops : [];
    const fromEmail = analysis.headers?.fromEmail || analysis.from || 'unknown@sender.com';
    const fromName = analysis.headers?.fromName || analysis.from || 'Sender';
    const toEmail = analysis.headers?.to || analysis.to || 'recipient@domain.com';
    const replyTo = analysis.headers?.replyTo || analysis.replyTo;
    const returnPath = analysis.headers?.returnPath || analysis.returnPath;

    // Filter hops if external-only filter is on
    const effectiveHops = filterExternalOnly
      ? rawHops.filter(h => !h.isPrivate && !h.isRfc1918)
      : rawHops;

    const hopList = effectiveHops.length > 0 ? effectiveHops : rawHops;
    const totalDelay = hopList.reduce((acc, h) => acc + (h.delaySec || 0), 0);

    const generatedNodes: GraphActorNode[] = [];
    const generatedLinks: GraphActorLink[] = [];
    let anomaliesCount = 0;

    // 1. SENDER ACTOR NODE
    const senderIp = analysis.realSenderIp?.ip || hopList[0]?.fromIp || 'Origin IP';
    const senderAuthVerdict = analysis.auth?.spf?.status === 'PASS' && analysis.auth?.dkim?.status === 'PASS';
    const senderIsSuspicious = analysis.verdict === 'MALICIOUS PHISH' || analysis.verdict === 'SUSPICIOUS' || analysis.auth?.spf?.status === 'FAIL';
    
    generatedNodes.push({
      id: 'actor-sender',
      role: 'sender',
      label: 'Sender / Origin',
      displayName: fromName !== fromEmail ? `${fromName} <${fromEmail}>` : fromEmail,
      sublabel: senderIp,
      ip: senderIp,
      host: analysis.realSenderIp?.reverseDns || hopList[0]?.fromHost || fromEmail.split('@')[1],
      city: analysis.realSenderIp?.city || hopList[0]?.city,
      country: analysis.realSenderIp?.country || hopList[0]?.country,
      countryCode: analysis.realSenderIp?.countryCode || hopList[0]?.countryCode,
      asn: analysis.realSenderIp?.asn || hopList[0]?.asn,
      isp: analysis.realSenderIp?.isp || hopList[0]?.isp,
      status: senderIsSuspicious ? 'suspicious' : senderAuthVerdict ? 'legitimate' : 'neutral',
      isOrigin: true,
      authSummary: {
        spf: analysis.auth?.spf?.status || 'NONE',
        dkim: analysis.auth?.dkim?.status || 'NONE',
        dmarc: analysis.auth?.dmarc?.status || 'NONE',
      },
      radius: 28,
      color: senderIsSuspicious ? '#dc2626' : '#2563eb',
      borderColor: senderIsSuspicious ? '#f87171' : '#60a5fa',
      glowColor: senderIsSuspicious ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.35)',
      iconType: 'user'
    });

    // 2. RELAY SERVER NODES
    let previousNodeId = 'actor-sender';

    hopList.forEach((hop: EmailHop, index: number) => {
      const hopNumber = hop.hopNumber || index + 1;
      const hopNodeId = `actor-relay-${hopNumber}`;
      const isHighDelay = (hop.delaySec || 0) >= 5;
      const isTorOrVpn = Boolean(hop.isTorExitNode || hop.is_tor || hop.isProxyOrVpn || hop.is_vpn);
      const isRfc1918 = Boolean(hop.isPrivate || hop.isRfc1918);
      const isAnomaly = isHighDelay || isTorOrVpn || Boolean(hop.countryMismatch) || Boolean(hop.abuseScore && hop.abuseScore > 20);

      if (isAnomaly) anomaliesCount++;

      let roleLabel = 'Relay Hop';
      if (index === 0 && hop.isOrigin) roleLabel = 'Origin MTA';
      else if (index === hopList.length - 1) roleLabel = 'Ingress Gateway';
      else roleLabel = `Transit Hop #${hopNumber}`;

      const anomalyDesc = isTorOrVpn
        ? 'Tor / VPN Masking Detected'
        : isHighDelay
        ? `Latency Spike (+${hop.delaySec}s delay)`
        : hop.countryMismatch
        ? 'Geographic RIR Mismatch'
        : isRfc1918
        ? 'Internal LAN Subnet (RFC 1918)'
        : undefined;

      const isEncrypted = Boolean(
        hop.protocol?.toLowerCase().includes('s') || 
        hop.protocol?.toLowerCase().includes('tls') ||
        hop.protocol === 'ESMTPS'
      );

      generatedNodes.push({
        id: hopNodeId,
        role: 'relay',
        label: roleLabel,
        displayName: hop.fromHost || hop.byHost || hop.fromIp || `Hop #${hopNumber}`,
        sublabel: hop.fromIp || hop.asn || 'MTA Relay',
        ip: hop.fromIp,
        host: hop.fromHost || hop.byHost,
        asn: hop.asn,
        isp: hop.isp || hop.org,
        city: hop.city,
        country: hop.country,
        countryCode: hop.countryCode,
        hopNumber,
        totalHops: hopList.length,
        delaySec: hop.delaySec,
        protocol: hop.protocol || (isEncrypted ? 'ESMTPS (TLS)' : 'ESMTP'),
        tlsEncrypted: isEncrypted,
        status: isAnomaly ? 'suspicious' : 'legitimate',
        isPrivate: isRfc1918,
        isTor: Boolean(hop.isTorExitNode || hop.is_tor),
        isVpn: Boolean(hop.isProxyOrVpn || hop.is_vpn),
        isAnomaly,
        anomalyReason: anomalyDesc,
        radius: isAnomaly ? 26 : 22,
        color: isAnomaly ? '#b45309' : '#047857',
        borderColor: isAnomaly ? '#f59e0b' : '#34d399',
        glowColor: isAnomaly ? 'rgba(245, 158, 11, 0.4)' : 'rgba(52, 211, 153, 0.25)',
        iconType: 'server'
      });

      // Chain Link from previous actor
      generatedLinks.push({
        id: `link-${previousNodeId}-${hopNodeId}`,
        source: previousNodeId,
        target: hopNodeId,
        type: 'hop_chain',
        delaySec: hop.delaySec,
        protocol: hop.protocol || (isEncrypted ? 'TLS' : 'SMTP'),
        encrypted: isEncrypted,
        isSuspicious: isHighDelay || isTorOrVpn
      });

      previousNodeId = hopNodeId;
    });

    // 3. RECIPIENT ACTOR NODE
    const finalHop = hopList[hopList.length - 1];
    const recipientMx = finalHop?.byHost || toEmail.split('@')[1] || 'Corporate MX';

    generatedNodes.push({
      id: 'actor-recipient',
      role: 'recipient',
      label: 'Recipient / Ingress',
      displayName: toEmail,
      sublabel: recipientMx,
      ip: finalHop?.fromIp,
      host: recipientMx,
      city: finalHop?.city,
      country: finalHop?.country,
      status: 'legitimate',
      isDestination: true,
      radius: 28,
      color: '#6d28d9',
      borderColor: '#a78bfa',
      glowColor: 'rgba(167, 139, 250, 0.35)',
      iconType: 'inbox'
    });

    // Link from last relay to recipient
    generatedLinks.push({
      id: `link-${previousNodeId}-actor-recipient`,
      source: previousNodeId,
      target: 'actor-recipient',
      type: 'hop_chain',
      delaySec: 0,
      protocol: 'LMTP / Delivery',
      encrypted: true,
      isSuspicious: false
    });

    // 4. OPTIONAL ACTOR: REPLY-TO DIVERTER (Crucial for BEC & Spoofing detection)
    if (replyTo && replyTo.toLowerCase().trim() !== fromEmail.toLowerCase().trim()) {
      anomaliesCount++;
      const diverterId = 'actor-diverter';
      generatedNodes.push({
        id: diverterId,
        role: 'diverter',
        label: 'Reply Diverter (BEC)',
        displayName: replyTo,
        sublabel: 'Diverted Reply-To Header',
        status: 'malicious',
        isAnomaly: true,
        anomalyReason: 'Reply-To diverts mail responses away from From address',
        radius: 24,
        color: '#be123c',
        borderColor: '#fb7185',
        glowColor: 'rgba(251, 113, 133, 0.45)',
        iconType: 'repeat'
      });

      generatedLinks.push({
        id: `link-actor-sender-${diverterId}`,
        source: 'actor-sender',
        target: diverterId,
        type: 'diverter',
        label: 'Diverts Responses',
        isSuspicious: true
      });
    }

    // 5. OPTIONAL ACTOR: RETURN-PATH MISMATCH
    if (returnPath && !returnPath.includes(fromEmail.split('@')[1] || '')) {
      const returnPathId = 'actor-return-path';
      generatedNodes.push({
        id: returnPathId,
        role: 'return_path',
        label: 'Envelope Return-Path',
        displayName: returnPath,
        sublabel: 'Mismatched Bounce Address',
        status: 'suspicious',
        isAnomaly: true,
        anomalyReason: 'Envelope Return-Path domain mismatch',
        radius: 22,
        color: '#475569',
        borderColor: '#94a3b8',
        glowColor: 'rgba(148, 163, 184, 0.3)',
        iconType: 'shield'
      });

      generatedLinks.push({
        id: `link-actor-sender-${returnPathId}`,
        source: 'actor-sender',
        target: returnPathId,
        type: 'return_path',
        label: 'Envelope Sender',
        isSuspicious: false
      });
    }

    return {
      nodes: generatedNodes,
      links: generatedLinks,
      actorStats: {
        totalHops: hopList.length,
        totalDelay,
        anomaliesCount
      }
    };
  }, [analysis, filterExternalOnly]);

  // Compute layout coordinates based on mode
  const setupNodeTargetCoordinates = useCallback((width: number, h: number) => {
    if (nodes.length === 0) return;

    const relayNodes = nodes.filter(n => n.role === 'relay');
    const senderNode = nodes.find(n => n.role === 'sender');
    const recipientNode = nodes.find(n => n.role === 'recipient');
    const diverterNode = nodes.find(n => n.role === 'diverter');
    const returnPathNode = nodes.find(n => n.role === 'return_path');

    const centerY = h / 2;

    if (layoutMode === 'pipeline') {
      // Horizontal sequential pipeline
      const startX = width * 0.12;
      const endX = width * 0.88;
      const availableSpan = endX - startX;

      if (senderNode) {
        senderNode.targetX = startX;
        senderNode.targetY = centerY;
      }

      if (recipientNode) {
        recipientNode.targetX = endX;
        recipientNode.targetY = centerY;
      }

      const totalRelays = relayNodes.length;
      relayNodes.forEach((node, i) => {
        const step = (i + 1) / (totalRelays + 1);
        node.targetX = startX + availableSpan * step;
        // Alternating wave offset for visual clarity and avoiding overlap
        const yOffset = totalRelays > 3 ? (i % 2 === 0 ? -36 : 36) : 0;
        node.targetY = centerY + yOffset;
      });

      if (diverterNode) {
        diverterNode.targetX = startX + 60;
        diverterNode.targetY = centerY - 120;
      }

      if (returnPathNode) {
        returnPathNode.targetX = startX + 60;
        returnPathNode.targetY = centerY + 120;
      }
    } else if (layoutMode === 'radial') {
      // Radial ring layout: Recipient in center, relays inward, sender on outer ring
      const centerX = width / 2;
      const radiusStep = Math.min(width, h) * 0.35;

      if (recipientNode) {
        recipientNode.targetX = centerX;
        recipientNode.targetY = centerY;
      }

      const totalOuter = relayNodes.length + 1; // relays + sender
      if (senderNode) {
        const angle = -Math.PI; // 90 deg left
        senderNode.targetX = centerX + Math.cos(angle) * radiusStep;
        senderNode.targetY = centerY + Math.sin(angle) * (radiusStep * 0.8);
      }

      relayNodes.forEach((node, i) => {
        const angle = -Math.PI + ((i + 1) / totalOuter) * (Math.PI * 1.6);
        const r = radiusStep * (0.85 - (i / (relayNodes.length || 1)) * 0.4);
        node.targetX = centerX + Math.cos(angle) * r;
        node.targetY = centerY + Math.sin(angle) * (r * 0.8);
      });

      if (diverterNode) {
        diverterNode.targetX = centerX - 120;
        diverterNode.targetY = centerY - 130;
      }
      if (returnPathNode) {
        returnPathNode.targetX = centerX - 120;
        returnPathNode.targetY = centerY + 130;
      }
    } else {
      // Free Force layout: Gentle centering
      nodes.forEach(n => {
        n.targetX = width / 2;
        n.targetY = h / 2;
      });
    }
  }, [nodes, layoutMode]);

  // Main D3 Rendering Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const activeHeight = isFullscreen ? window.innerHeight - 80 : height;

    svg.attr('width', width).attr('height', activeHeight);

    // Compute target coordinates
    setupNodeTargetCoordinates(width, activeHeight);

    // Clear previous contents
    svg.selectAll('*').remove();

    // Setup SVG Definitions (Gradients, Filters, Markers)
    const defs = svg.append('defs');

    // Arrow markers for normal links
    defs.append('marker')
      .attr('id', 'arrow-head-normal')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#475569');

    // Arrow marker for active/selected links
    defs.append('marker')
      .attr('id', 'arrow-head-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#38bdf8');

    // Arrow marker for suspicious/diverted links
    defs.append('marker')
      .attr('id', 'arrow-head-warning')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 26)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', '#f43f5e');

    // Drop Shadow Glow filter
    const filter = defs.append('filter')
      .attr('id', 'cyber-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Grid pattern background
    const pattern = defs.append('pattern')
      .attr('id', 'graph-grid')
      .attr('width', 30)
      .attr('height', 30)
      .attr('patternUnits', 'userSpaceOnUse');
    pattern.append('circle')
      .attr('cx', 2)
      .attr('cy', 2)
      .attr('r', 1)
      .attr('fill', 'rgba(255, 255, 255, 0.05)');

    // Background rect with grid
    svg.append('rect')
      .attr('width', width)
      .attr('height', activeHeight)
      .attr('fill', '#0b0d12')
      .attr('pointer-events', 'all');

    svg.append('rect')
      .attr('width', width)
      .attr('height', activeHeight)
      .attr('fill', 'url(#graph-grid)')
      .attr('pointer-events', 'none');

    // Root zoom container
    const gRoot = svg.append('g').attr('class', 'zoom-root');

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3.5])
      .on('zoom', (event) => {
        gRoot.attr('transform', event.transform);
        setZoomTransform(event.transform);
      });

    svg.call(zoomBehavior);

    // Apply saved or initial zoom
    if (zoomTransform !== d3.zoomIdentity) {
      gRoot.attr('transform', zoomTransform.toString());
    }

    // Initialize D3 Force Simulation
    // Deep clone nodes and links so simulation doesn't mutate outer state unpredictably
    const simNodes: GraphActorNode[] = nodes.map(d => ({ ...d }));
    const simLinks: GraphActorLink[] = links.map(d => ({ ...d }));

    const simulation = d3.forceSimulation<GraphActorNode>(simNodes)
      .force('link', d3.forceLink<GraphActorNode, GraphActorLink>(simLinks)
        .id(d => d.id)
        .distance(link => {
          if (link.type === 'diverter' || link.type === 'return_path') return 110;
          return layoutMode === 'pipeline' ? 140 : 100;
        })
        .strength(link => (link.type === 'hop_chain' ? 0.7 : 0.4))
      )
      .force('charge', d3.forceManyBody().strength(layoutMode === 'force' ? -420 : -250))
      .force('collide', d3.forceCollide<GraphActorNode>().radius(d => d.radius + 24).iterations(2))
      .force('center', layoutMode === 'force' ? d3.forceCenter(width / 2, activeHeight / 2) : null);

    // Directional positioning forces for pipeline / radial alignment
    if (layoutMode === 'pipeline') {
      simulation
        .force('x', d3.forceX<GraphActorNode>(d => d.targetX || width / 2).strength(0.42))
        .force('y', d3.forceY<GraphActorNode>(d => d.targetY || activeHeight / 2).strength(0.38));
    } else if (layoutMode === 'radial') {
      simulation
        .force('x', d3.forceX<GraphActorNode>(d => d.targetX || width / 2).strength(0.35))
        .force('y', d3.forceY<GraphActorNode>(d => d.targetY || activeHeight / 2).strength(0.35));
    }

    // Layer groups
    const linkGroup = gRoot.append('g').attr('class', 'links-layer');
    const particlesGroup = gRoot.append('g').attr('class', 'particles-layer');
    const linkLabelsGroup = gRoot.append('g').attr('class', 'link-labels-layer');
    const nodeGroup = gRoot.append('g').attr('class', 'nodes-layer');

    // 1. RENDER LINKS
    const linkElements = linkGroup.selectAll<SVGPathElement, GraphActorLink>('path')
      .data(simLinks)
      .enter()
      .append('path')
      .attr('class', 'graph-link')
      .attr('stroke', d => {
        if (d.type === 'diverter') return '#f43f5e';
        if (d.type === 'return_path') return '#64748b';
        if (d.isSuspicious) return '#f59e0b';
        return '#334155';
      })
      .attr('stroke-width', d => (d.type === 'hop_chain' ? 2.5 : 1.75))
      .attr('stroke-dasharray', d => {
        if (d.type === 'diverter') return '6,4';
        if (d.type === 'return_path') return '3,3';
        return 'none';
      })
      .attr('fill', 'none')
      .attr('marker-end', d => {
        if (d.type === 'diverter') return 'url(#arrow-head-warning)';
        return 'url(#arrow-head-normal)';
      })
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        const sourceNode = simNodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source));
        const targetNode = simNodes.find(n => n.id === (typeof d.target === 'object' ? d.target.id : d.target));
        if (targetNode) setSelectedNode(targetNode);
        else if (sourceNode) setSelectedNode(sourceNode);
      });

    // 2. RENDER LINK LABELS (Transit delay & protocol)
    const linkLabelElements = linkLabelsGroup.selectAll<SVGTextElement, GraphActorLink>('g')
      .data(simLinks)
      .enter()
      .append('g')
      .attr('class', 'link-label')
      .style('pointer-events', 'none');

    linkLabelElements.append('rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#090b0e')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    linkLabelElements.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', d => (d.isSuspicious ? '#fbbf24' : '#94a3b8'))
      .text(d => {
        if (d.type === 'diverter') return '⚠️ Reply Diverted';
        if (d.type === 'return_path') return 'Envelope Return';
        if (d.delaySec != null && d.delaySec > 0) {
          return `+${d.delaySec.toFixed(1)}s · ${d.protocol || 'ESMTPS'}`;
        }
        return d.protocol || 'TLS 1.3';
      });

    // 3. RENDER NODES
    const nodeElements = nodeGroup.selectAll<SVGGElement, GraphActorNode>('g')
      .data(simNodes)
      .enter()
      .append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphActorNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Let them gently float or settle
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (_, d) => {
        setSelectedNode(d);
      })
      .on('mouseenter', (_, d) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

    // Outer Glow Ring
    nodeElements.append('circle')
      .attr('class', 'node-glow')
      .attr('r', d => d.radius + 6)
      .attr('fill', 'none')
      .attr('stroke', d => d.glowColor || 'rgba(59, 130, 246, 0.2)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)
      .attr('filter', 'url(#cyber-glow)');

    // Main Node Circle
    nodeElements.append('circle')
      .attr('class', 'node-core')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        if (d.role === 'sender') return '#0f172a';
        if (d.role === 'recipient') return '#1e1b4b';
        if (d.role === 'diverter') return '#311019';
        if (d.isAnomaly) return '#2e1905';
        return '#06281e';
      })
      .attr('stroke', d => d.borderColor)
      .attr('stroke-width', 2);

    // Inner Glyph Icon Representation
    nodeElements.each(function(d) {
      const g = d3.select(this);

      // Status indicator circle at top-right
      g.append('circle')
        .attr('cx', d.radius * 0.7)
        .attr('cy', -d.radius * 0.7)
        .attr('r', 4.5)
        .attr('fill', () => {
          if (d.status === 'malicious') return '#ef4444';
          if (d.status === 'suspicious') return '#f59e0b';
          if (d.status === 'legitimate') return '#10b981';
          return '#64748b';
        })
        .attr('stroke', '#0b0d12')
        .attr('stroke-width', 1.5);

      // Monogram or Icon in center
      const iconText = d.role === 'sender'
        ? 'ORIGIN'
        : d.role === 'recipient'
        ? 'DEST'
        : d.role === 'diverter'
        ? 'ALERT'
        : d.role === 'return_path'
        ? 'ENV'
        : `H#${d.hopNumber || '?'}`;

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('y', 0)
        .attr('font-size', d.role === 'relay' ? '10px' : '9px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, monospace')
        .attr('fill', d.borderColor)
        .text(iconText);
    });

    // Primary Text Label below node
    const textGroup = nodeElements.append('g')
      .attr('transform', d => `translate(0, ${d.radius + 16})`);

    textGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'system-ui, -apple-system, sans-serif')
      .attr('fill', '#f1f5f9')
      .text(d => {
        const full = d.displayName;
        return full.length > 20 ? full.slice(0, 18) + '…' : full;
      });

    // Secondary Sublabel (IP or City/Country)
    textGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 14)
      .attr('font-size', '9.5px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', d => (d.isAnomaly ? '#fbbf24' : '#94a3b8'))
      .text(d => {
        if (d.city && d.countryCode) return `${d.city}, ${d.countryCode}`;
        if (d.ip) return d.ip;
        if (d.sublabel) return d.sublabel.length > 18 ? d.sublabel.slice(0, 16) + '…' : d.sublabel;
        return '';
      });

    // 4. ANIMATED HOP TRANSMISSION PARTICLES (Packet pulse traveling along hops)
    const particleData = simLinks.filter(l => l.type === 'hop_chain');
    const particleElements = particlesGroup.selectAll<SVGCircleElement, GraphActorLink>('circle')
      .data(particleData)
      .enter()
      .append('circle')
      .attr('r', 3.5)
      .attr('fill', '#38bdf8')
      .attr('filter', 'url(#cyber-glow)')
      .style('opacity', isAnimationActive ? 0.9 : 0);

    // Simulation Tick Callback
    simulation.on('tick', () => {
      // Calculate curved or direct link paths
      linkElements.attr('d', d => {
        const source = d.source as GraphActorNode;
        const target = d.target as GraphActorNode;
        if (!source.x || !source.y || !target.x || !target.y) return '';

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        
        if (d.type === 'diverter' || d.type === 'return_path') {
          // Curved arc for branches
          const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
          return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
        }

        // Slight vertical bezier curve to avoid collision with nodes
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        return `M${source.x},${source.y} Q${midX},${midY} ${target.x},${target.y}`;
      });

      // Update link labels
      linkLabelElements.attr('transform', d => {
        const source = d.source as GraphActorNode;
        const target = d.target as GraphActorNode;
        if (!source.x || !source.y || !target.x || !target.y) return '';
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        return `translate(${midX}, ${midY})`;
      });

      // Update label background rects
      linkLabelElements.selectAll<SVGRectElement, GraphActorLink>('rect')
        .each(function() {
          const textEl = (this.parentNode as Element)?.querySelector('text');
          if (textEl) {
            const bbox = textEl.getBBox();
            d3.select(this)
              .attr('x', bbox.x - 6)
              .attr('y', bbox.y - 2)
              .attr('width', bbox.width + 12)
              .attr('height', bbox.height + 4);
          }
        });

      // Update node positions
      nodeElements.attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Animation loop for flowing packet particles
    if (isAnimationActive) {
      let startTime = performance.now();
      const animatePackets = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000;

        particleElements.each(function(d, index) {
          const source = d.source as GraphActorNode;
          const target = d.target as GraphActorNode;
          if (!source.x || !source.y || !target.x || !target.y) return;

          // Sequential wave: Each hop packet starts after the previous one
          const speed = 1.2; // loops per second
          const phaseOffset = index * 0.22;
          const progress = ((elapsed * speed) + phaseOffset) % 1;

          const currentX = source.x + (target.x - source.x) * progress;
          const currentY = source.y + (target.y - source.y) * progress;

          d3.select(this)
            .attr('cx', currentX)
            .attr('cy', currentY)
            .attr('opacity', Math.sin(progress * Math.PI) * 0.95);
        });

        animationFrameRef.current = requestAnimationFrame(animatePackets);
      };

      animationFrameRef.current = requestAnimationFrame(animatePackets);
    }

    return () => {
      simulation.stop();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes, links, layoutMode, isAnimationActive, isFullscreen, height, setupNodeTargetCoordinates]);

  // Dynamic Hover Highlighting
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!hoveredNodeId) {
      svg.selectAll('.graph-node').attr('opacity', 1);
      svg.selectAll('.graph-link').attr('opacity', 0.85).attr('stroke-width', d => ((d as any).type === 'hop_chain' ? 2.5 : 1.75));
      return;
    }

    // Dim non-connected nodes & links
    const connectedNodeIds = new Set<string>([hoveredNodeId]);
    links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sId === hoveredNodeId) connectedNodeIds.add(tId);
      if (tId === hoveredNodeId) connectedNodeIds.add(sId);
    });

    svg.selectAll<SVGGElement, GraphActorNode>('.graph-node')
      .attr('opacity', d => (connectedNodeIds.has(d.id) ? 1 : 0.25));

    svg.selectAll<SVGPathElement, GraphActorLink>('.graph-link')
      .attr('opacity', d => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        return (sId === hoveredNodeId || tId === hoveredNodeId) ? 1 : 0.15;
      })
      .attr('stroke-width', d => {
        const sId = typeof d.source === 'object' ? d.source.id : d.source;
        const tId = typeof d.target === 'object' ? d.target.id : d.target;
        return (sId === hoveredNodeId || tId === hoveredNodeId) ? 3.5 : 1.5;
      });
  }, [hoveredNodeId, links]);

  // Zoom control handlers
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(d3.zoom<SVGSVGElement, unknown>().scaleBy as any, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(400).call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity);
    setZoomTransform(d3.zoomIdentity);
  };

  // Export SVG Snapshot
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);

    // Add namespaces if missing
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracexmail-mail-hop-topology-${analysis.id || 'case'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full rounded-xl overflow-hidden border border-[#2a241b] bg-[#0b0d12] flex flex-col shadow-lg transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none h-screen' : ''
      } ${className}`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* Interactive Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#12100d] border-b border-[#262118] text-xs z-10">
        {/* Left: Title & Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-[#ede6d8] uppercase tracking-wider font-mono text-[11px]">
                D3 Mail Actor Topology &amp; Hop Path
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#8a8070] border-l border-[#262118] pl-3">
            <span>Actors: <strong className="text-[#ede6d8]">{nodes.length}</strong></span>
            <span>·</span>
            <span>Relay Hops: <strong className="text-blue-400">{actorStats.totalHops}</strong></span>
            <span>·</span>
            <span>Transit: <strong className="text-emerald-400">+{actorStats.totalDelay.toFixed(1)}s</strong></span>
            {actorStats.anomaliesCount > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-400 font-bold">⚠️ {actorStats.anomaliesCount} Anomaly</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Layout Switcher & Graph Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Layout Mode Segmented Control */}
          <div className="flex items-center bg-[#1c1813] border border-[#332b20] p-0.5 rounded-lg">
            <button
              onClick={() => setLayoutMode('pipeline')}
              title="Sequential Mail Pipeline Layout"
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                layoutMode === 'pipeline' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-[#8a8070] hover:text-[#ede6d8]'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setLayoutMode('force')}
              title="Dynamic Force-Directed Physics Layout"
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                layoutMode === 'force' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-[#8a8070] hover:text-[#ede6d8]'
              }`}
            >
              Force Physics
            </button>
            <button
              onClick={() => setLayoutMode('radial')}
              title="Concentric Radial Path Layout"
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                layoutMode === 'radial' ? 'bg-blue-600 text-white font-semibold shadow-sm' : 'text-[#8a8070] hover:text-[#ede6d8]'
              }`}
            >
              Radial
            </button>
          </div>

          {/* Filter: Hide Internal LAN */}
          <button
            onClick={() => setFilterExternalOnly(!filterExternalOnly)}
            title="Filter internal RFC1918 hops"
            className={`px-2 py-1 rounded text-[11px] border font-mono transition-colors flex items-center gap-1 cursor-pointer ${
              filterExternalOnly 
                ? 'bg-amber-950/60 border-amber-600 text-amber-300' 
                : 'bg-[#1c1813] border-[#332b20] text-[#8a8070] hover:text-[#ede6d8]'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>{filterExternalOnly ? 'External Only' : 'All Hops'}</span>
          </button>

          {/* Toggle Flow Animation */}
          <button
            onClick={() => setIsAnimationActive(!isAnimationActive)}
            title={isAnimationActive ? 'Pause packet animation' : 'Start packet animation'}
            className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
          >
            {isAnimationActive ? <Pause className="w-3.5 h-3.5 text-blue-400" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border-l border-[#262118] pl-2">
            <button
              onClick={() => handleZoom(1.25)}
              title="Zoom In"
              className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoom(0.8)}
              title="Zoom Out"
              className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Fit View / Reset Zoom"
              className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Snapshot & Fullscreen */}
          <div className="flex items-center gap-1 border-l border-[#262118] pl-2">
            <button
              onClick={handleExportSvg}
              title="Export Topology Graph as Vector SVG"
              className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
              className="p-1 rounded bg-[#1c1813] border border-[#332b20] text-[#8a8070] hover:text-[#ede6d8] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <svg 
          ref={svgRef} 
          className="w-full h-full block select-none touch-none"
        />

        {/* Legend Overlay at bottom-left */}
        <div className="absolute bottom-3 left-3 bg-[#110f0c]/90 backdrop-blur-md border border-[#262118] rounded-lg p-2.5 text-[10px] font-mono text-[#8a8070] shadow-md space-y-1.5 pointer-events-none hidden sm:block">
          <div className="text-[10px] font-bold text-[#ede6d8] uppercase tracking-wider mb-1">
            Actor Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-400" />
            <span>Sender Origin (MUA/Client)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-400" />
            <span>Verified Relay Server</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-1 ring-purple-400" />
            <span>Target Recipient / MX</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-400" />
            <span>Anomaly / Latency Spike (&gt;5s)</span>
          </div>
          {nodes.some(n => n.role === 'diverter') && (
            <div className="flex items-center gap-2 text-rose-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-rose-400" />
              <span>Reply-To Diverter (BEC Alert)</span>
            </div>
          )}
        </div>

        {/* Interactive Instruction Banner */}
        <div className="absolute top-3 left-3 bg-[#110f0c]/80 backdrop-blur-sm border border-[#262118] px-2.5 py-1 rounded text-[10px] font-mono text-[#8a8070] pointer-events-none">
          Click any actor node to inspect forensic headers · Drag nodes to test physics
        </div>

        {/* Selected Actor Forensic Telemetry Inspector Panel (Right Drawer) */}
        {selectedNode && (
          <div className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-[#12100d]/95 backdrop-blur-md border-l border-[#2e271c] p-4 flex flex-col shadow-2xl z-20 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Inspector Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#262118]">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: selectedNode.borderColor }}
                />
                <span className="font-bold text-xs uppercase tracking-wider text-[#ede6d8] font-mono">
                  {selectedNode.label}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#1f1a14] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actor Primary Identity */}
            <div className="py-3 space-y-2 border-b border-[#262118]">
              <div className="text-sm font-bold text-white font-mono break-all">
                {selectedNode.displayName}
              </div>
              {selectedNode.ip && (
                <div className="flex items-center justify-between bg-[#191510] border border-[#262118] p-2 rounded">
                  <div className="text-[11px] font-mono text-blue-400 font-semibold">
                    IP: {selectedNode.ip}
                  </div>
                  <button
                    onClick={() => handleCopy(selectedNode.ip || '', 'ip')}
                    className="text-[10px] text-[#8a8070] hover:text-white flex items-center gap-1 cursor-pointer font-mono"
                  >
                    {copiedKey === 'ip' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'ip' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Forensic Attribute Cards */}
            <div className="py-3 space-y-2.5 text-xs font-mono">
              {/* Geolocation */}
              {(selectedNode.city || selectedNode.country) && (
                <div className="bg-[#191510] border border-[#262118] p-2.5 rounded space-y-1">
                  <div className="text-[10px] text-[#8a8070] uppercase">Geographic Location</div>
                  <div className="text-[#ede6d8] font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {selectedNode.city ? `${selectedNode.city}, ` : ''}
                      {selectedNode.country || 'Unknown'} 
                      {selectedNode.countryCode ? ` (${selectedNode.countryCode})` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Network ASN / ISP */}
              {(selectedNode.asn || selectedNode.isp) && (
                <div className="bg-[#191510] border border-[#262118] p-2.5 rounded space-y-1">
                  <div className="text-[10px] text-[#8a8070] uppercase">Network &amp; Autonomous System</div>
                  <div className="text-[#ede6d8] font-semibold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    <span className="truncate">{selectedNode.asn || ''} {selectedNode.isp || ''}</span>
                  </div>
                </div>
              )}

              {/* Hop Transit & Latency */}
              {selectedNode.delaySec != null && (
                <div className="bg-[#191510] border border-[#262118] p-2.5 rounded space-y-1">
                  <div className="text-[10px] text-[#8a8070] uppercase">Hop Latency &amp; Encryption</div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[#ede6d8]">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>+{selectedNode.delaySec.toFixed(2)}s transit</span>
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      {selectedNode.tlsEncrypted ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-amber-400" />}
                      <span>{selectedNode.protocol || 'TLS'}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Sender Authentication Verification */}
              {selectedNode.authSummary && (
                <div className="bg-[#191510] border border-[#262118] p-2.5 rounded space-y-2">
                  <div className="text-[10px] text-[#8a8070] uppercase">Authentication Cryptography</div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className="p-1 rounded bg-[#110f0c] border border-[#262118]">
                      <div className="text-[#8a8070]">SPF</div>
                      <div className={`font-bold ${selectedNode.authSummary.spf === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedNode.authSummary.spf}
                      </div>
                    </div>
                    <div className="p-1 rounded bg-[#110f0c] border border-[#262118]">
                      <div className="text-[#8a8070]">DKIM</div>
                      <div className={`font-bold ${selectedNode.authSummary.dkim === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedNode.authSummary.dkim}
                      </div>
                    </div>
                    <div className="p-1 rounded bg-[#110f0c] border border-[#262118]">
                      <div className="text-[#8a8070]">DMARC</div>
                      <div className={`font-bold ${selectedNode.authSummary.dmarc === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedNode.authSummary.dmarc}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Anomaly Alerts */}
              {selectedNode.isAnomaly && (
                <div className="bg-amber-950/40 border border-amber-600/70 p-2.5 rounded space-y-1 text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Forensic Anomaly Detected</span>
                  </div>
                  <div className="text-[10px] text-amber-300">
                    {selectedNode.anomalyReason || 'Abnormal transmission parameter detected in header telemetry.'}
                  </div>
                </div>
              )}

              {/* Diverter Warning */}
              {selectedNode.role === 'diverter' && (
                <div className="bg-rose-950/40 border border-rose-600/70 p-2.5 rounded space-y-1 text-rose-200">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Critical Diverter Path (BEC)</span>
                  </div>
                  <div className="text-[10px] text-rose-300">
                    When victims reply to this message, answers are sent to this address instead of the authenticated From address.
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Navigation Deep Links */}
            <div className="mt-auto pt-3 border-t border-[#262118] flex items-center justify-between">
              {onNavigateToHopView && (
                <button
                  onClick={onNavigateToHopView}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Hop Details</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {onNavigateToGraph && (
                <button
                  onClick={onNavigateToGraph}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>Full Entity Graph</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default D3MailActorGraph;
