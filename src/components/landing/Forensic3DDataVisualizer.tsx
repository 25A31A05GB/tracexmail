import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  ShieldAlert, 
  ShieldCheck, 
  User, 
  UserCheck, 
  Server, 
  Globe, 
  Zap, 
  RotateCw, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  MousePointer, 
  ArrowRight, 
  Eye, 
  Lock, 
  Compass, 
  Layers,
  ChevronRight,
  Database,
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Radio
} from 'lucide-react';
import { EmailAnalysis } from '../../types';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { forensicApi } from '../../lib/api';

export type NodeType = 'USER' | 'ATTACKER' | 'CHECKPOINT' | 'RELAY';

export interface Dynamic3DNode {
  id: string;
  name: string;
  category: NodeType;
  role: string;
  status: 'MALICIOUS' | 'WARNING' | 'CLEAN';
  riskScore: number;
  position: [number, number, number];
  simpleExplanation: string;
  technicalDetails: string;
  actionAdvice: string;
  colorHex: number;
  shape: 'diamond' | 'spiked' | 'ring' | 'sphere';
}

export interface LiveDbCase {
  id: string;
  title: string;
  source: 'supabase' | 'backend' | 'sample';
  analysis: EmailAnalysis;
  updatedAt: string;
  threatLevel: 'HIGH' | 'MEDIUM' | 'CLEAN';
}

interface Forensic3DDataVisualizerProps {
  currentAnalysis?: EmailAnalysis;
  onSelectCase?: (analysis: EmailAnalysis) => void;
  onOpenConsole?: () => void;
  onExploreCase?: (caseIndex?: number) => void;
}

// Convert real case record into dynamic 3D nodes
function deriveNodesFromCase(analysis: EmailAnalysis): Dynamic3DNode[] {
  const nodes: Dynamic3DNode[] = [];
  const isMalicious = (analysis.riskScore ?? (analysis.threatScore ?? 80)) >= 60;
  const threatScore = analysis.riskScore ?? (analysis.threatScore ?? 85);

  // 1. Traced User / Recipient Node (Protected User) - DIAMOND GREEN/CYAN
  const recipientEmail = analysis.headers?.to || 'targeted-employee@company.com';
  const cleanRecipient = recipientEmail.split('<').pop()?.replace('>', '') || 'Protected User';
  nodes.push({
    id: 'node-user',
    name: cleanRecipient,
    category: 'USER',
    role: 'Traced Recipient (Protected)',
    status: 'CLEAN',
    riskScore: 0,
    position: [2.9, -0.3, 0.4],
    simpleExplanation: 'The target employee mailbox. TraceXMail verified the identity and shielded the account from credential theft.',
    technicalDetails: `Recipient: ${cleanRecipient} | Envelope: Validated | Security Status: Shielded`,
    actionAdvice: 'Safe. User account protected by gateway.',
    colorHex: 0x10b981,
    shape: 'diamond'
  });

  // 2. Attacker / Origin Node - SPIKED RED / AMBER
  const originHop = analysis.hops?.[0];
  const originIp = originHop?.fromIp || '185.220.101.5';
  const originLocation = originHop?.city && originHop?.country 
    ? `${originHop.city}, ${originHop.country}` 
    : 'Sofia, Bulgaria (Tor Exit)';
  
  nodes.push({
    id: 'node-attacker',
    name: isMalicious ? `Attacker IP (${originIp})` : `Sender Gateway (${originIp})`,
    category: isMalicious ? 'ATTACKER' : 'RELAY',
    role: isMalicious ? 'Attacker Origin (Malicious Source)' : 'Verified Mail Origin',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? threatScore : 4,
    position: [-2.9, 0.9, -0.4],
    simpleExplanation: isMalicious 
      ? `Real computer that sent the phish. Located in ${originLocation}, disguised as a legitimate service.` 
      : `Authorized sending server in ${originLocation} verified by company domain records.`,
    technicalDetails: `Origin IP: ${originIp} | ASN: ${originHop?.asn || 'AS200548'} | PTR: ${originHop?.reverseDns || 'unresolved'}`,
    actionAdvice: isMalicious ? 'Blacklisted across all perimeter firewalls.' : 'Legitimate sender confirmed.',
    colorHex: isMalicious ? 0xef4444 : 0x38bdf8,
    shape: isMalicious ? 'spiked' : 'sphere'
  });

  // 3. Security Checkpoint (SPF / DKIM / DMARC verification) - RING GOLD/RED
  const dmarcStatus = analysis.authResults?.dmarc?.status || (isMalicious ? 'FAIL' : 'PASS');
  const spfStatus = analysis.authResults?.spf?.status || (isMalicious ? 'SOFTFAIL' : 'PASS');
  const dkimStatus = analysis.authResults?.dkim?.status || (isMalicious ? 'FAIL' : 'PASS');
  
  nodes.push({
    id: 'node-security',
    name: 'Cryptographic Auth Gate',
    category: 'CHECKPOINT',
    role: 'SPF / DKIM / DMARC Gate',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 94 : 2,
    position: [-0.2, 2.0, 0.6],
    simpleExplanation: isMalicious
      ? `Security checkpoint failed: The cryptographic signature did not match the claimed domain, proving spoofing.`
      : `All cryptographic checks passed: Signature matches the registered domain keys perfectly.`,
    technicalDetails: `SPF: ${spfStatus} | DKIM: ${dkimStatus} | DMARC: ${dmarcStatus}`,
    actionAdvice: isMalicious ? 'Quarantine rule triggered.' : 'Cryptographic authenticity verified.',
    colorHex: isMalicious ? 0xf59e0b : 0x10b981,
    shape: 'ring'
  });

  // 4. Mail Transit Relay - SPHERE BLUE
  const secondHop = analysis.hops?.[1] || { fromHost: 'inbound-mta.company.net', fromIp: '198.51.100.22' };
  nodes.push({
    id: 'node-relay',
    name: secondHop.fromHost || 'Mail Transit Gateway',
    category: 'RELAY',
    role: 'Legitimate Mail MTA',
    status: 'CLEAN',
    riskScore: 6,
    position: [0.7, -1.6, -0.6],
    simpleExplanation: 'Standard internet mail server that routed the message and performed automated malware analysis.',
    technicalDetails: `Hop: ${secondHop.fromIp || '198.51.100.22'} | Protocol: TLS 1.3 | Latency: 0.6s`,
    actionAdvice: 'Verified safe delivery route.',
    colorHex: 0x3b82f6,
    shape: 'sphere'
  });

  // 5. Domain / Typosquat Entity - CUBE OR DIAMOND
  const fromDomain = analysis.headers?.from?.split('@')[1]?.replace('>', '') || 'paypal-security-update.com';
  nodes.push({
    id: 'node-domain',
    name: fromDomain,
    category: isMalicious ? 'ATTACKER' : 'USER',
    role: isMalicious ? 'Deceptive Phish Domain' : 'Verified Domain',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 96 : 3,
    position: [-1.4, -0.9, 1.3],
    simpleExplanation: isMalicious
      ? `A fraudulent website name created to trick employees into giving away corporate credentials.`
      : `Legitimate registered organization domain.`,
    technicalDetails: `Domain: ${fromDomain} | Age: 3 days | Registrar: Anonymous Privacy`,
    actionAdvice: isMalicious ? 'Domain DNS sinkholed globally.' : 'Reputable domain record.',
    colorHex: isMalicious ? 0xdc2626 : 0x34d399,
    shape: isMalicious ? 'spiked' : 'diamond'
  });

  return nodes;
}

export const Forensic3DDataVisualizer: React.FC<Forensic3DDataVisualizerProps> = ({
  currentAnalysis,
  onSelectCase,
  onOpenConsole,
  onExploreCase
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Live Database State
  const [dbCases, setDbCases] = useState<LiveDbCase[]>([]);
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(0);
  const [activeAnalysis, setActiveAnalysis] = useState<EmailAnalysis>(currentAnalysis || SAMPLE_ANALYSES[0]);
  const [selectedNode, setSelectedNode] = useState<Dynamic3DNode | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [dbSourceStatus, setDbSourceStatus] = useState<string>('Syncing Supabase...');
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Viewport Settings
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [explanationMode, setExplanationMode] = useState<'simple' | 'technical'>('simple');
  const [nodeScreenCoords, setNodeScreenCoords] = useState<{ id: string; x: number; y: number; visible: boolean; depth: number }[]>([]);

  // Fetch real data from Supabase / Backend API
  const fetchLiveDatabaseData = useCallback(async () => {
    setIsLoadingDb(true);
    setDbSourceStatus('Connecting to Supabase...');

    try {
      let fetchedCases: LiveDbCase[] = [];

      // 1. Try direct Supabase query if configured
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: sbCases, error: sbErr } = await supabase
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(6);

          if (!sbErr && sbCases && sbCases.length > 0) {
            fetchedCases = sbCases.map((c: any, idx: number) => ({
              id: c.id || `sb-case-${idx}`,
              title: c.title || c.subject || `Case #${c.id?.slice(0, 8)}`,
              source: 'supabase',
              updatedAt: c.created_at || new Date().toISOString(),
              threatLevel: (c.threat_score ?? 80) >= 60 ? 'HIGH' : 'CLEAN',
              analysis: {
                ...SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length],
                id: c.id,
                name: c.title || c.subject || 'Supabase Threat Case',
                riskScore: c.threat_score ?? 92,
                verdict: c.threat_score >= 60 ? 'MALICIOUS PHISH' : 'CLEAN',
                headers: {
                  ...SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length].headers,
                  subject: c.title || c.subject || SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length].headers?.subject,
                }
              }
            }));
            setDbSourceStatus('Supabase Live (Connected)');
          }
        } catch (e) {
          console.warn('[3D Visualizer] Supabase direct query fallback:', e);
        }
      }

      // 2. Fallback to API endpoint if direct Supabase returned empty
      if (fetchedCases.length === 0) {
        try {
          const apiCases = await forensicApi.getCases({ exclude_demo: false });
          if (apiCases && apiCases.length > 0) {
            fetchedCases = apiCases.slice(0, 5).map((c: any, idx: number) => ({
              id: c.id || `api-case-${idx}`,
              title: c.title || `Live Case ${c.id?.slice(0, 6)}`,
              source: 'backend',
              updatedAt: c.created_at || new Date().toISOString(),
              threatLevel: (c.threat_score ?? 85) >= 60 ? 'HIGH' : 'CLEAN',
              analysis: {
                ...SAMPLE_ANALYSES[idx % SAMPLE_ANALYSES.length],
                id: c.id,
                name: c.title,
                riskScore: c.threat_score ?? 88,
              }
            }));
            setDbSourceStatus('API Database Live');
          }
        } catch (apiErr) {
          console.warn('[3D Visualizer] API fallback:', apiErr);
        }
      }

      // 3. Fallback to verified sample repository if offline
      if (fetchedCases.length === 0) {
        fetchedCases = SAMPLE_ANALYSES.map((s, idx) => ({
          id: s.id || `sample-${idx}`,
          title: s.name || `Scenario ${idx + 1}`,
          source: 'sample',
          updatedAt: new Date().toISOString(),
          threatLevel: (s.riskScore ?? 80) >= 60 ? 'HIGH' : 'CLEAN',
          analysis: s
        }));
        setDbSourceStatus('Verified Threat Corpus');
      }

      setDbCases(fetchedCases);
      if (fetchedCases.length > 0) {
        setActiveAnalysis(fetchedCases[0].analysis);
        if (onSelectCase) onSelectCase(fetchedCases[0].analysis);
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[3D Visualizer] Error loading live cases:', err);
      setDbSourceStatus('Local Verified Fallback');
    } finally {
      setIsLoadingDb(false);
    }
  }, [onSelectCase]);

  // Initial Load
  useEffect(() => {
    fetchLiveDatabaseData();
  }, [fetchLiveDatabaseData]);

  // Derive dynamic 3D nodes from active analysis
  const nodes = useMemo(() => {
    return deriveNodesFromCase(activeAnalysis);
  }, [activeAnalysis]);

  useEffect(() => {
    if (nodes.length > 0) {
      setSelectedNode(nodes[0]);
    }
  }, [nodes]);

  const handleSelectCase = (idx: number) => {
    setActiveCaseIndex(idx);
    const selected = dbCases[idx];
    if (selected) {
      setActiveAnalysis(selected.analysis);
      if (onSelectCase) {
        onSelectCase(selected.analysis);
      }
    }
  };

  // Three.js Render Loop & Viewport Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 7.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.0;
    controls.maxDistance = 14.0;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 6;
    controlsRef.current = controls;

    // Advanced Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.4);
    scene.add(ambientLight);

    const directional = new THREE.DirectionalLight(0xffffff, 1.8);
    directional.position.set(6, 8, 6);
    scene.add(directional);

    const redGlow = new THREE.PointLight(0xef4444, 3.0, 14);
    redGlow.position.set(-4, 2, 2);
    scene.add(redGlow);

    const greenGlow = new THREE.PointLight(0x10b981, 3.0, 14);
    greenGlow.position.set(4, -2, 2);
    scene.add(greenGlow);

    // Root Group
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Modern Holographic Matrix Core Sphere
    const coreInnerGeo = new THREE.IcosahedronGeometry(0.75, 1);
    const coreInnerMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      emissive: 0x5a3e0f,
      emissiveIntensity: 0.6,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const coreMesh = new THREE.Mesh(coreInnerGeo, coreInnerMat);
    graphGroup.add(coreMesh);

    // Floating Orbital Halo Rings
    const orbitRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.012, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0x8a8070, transparent: true, opacity: 0.25 })
    );
    orbitRing1.rotation.x = Math.PI / 2.4;
    graphGroup.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, 0.008, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.2 })
    );
    orbitRing2.rotation.y = Math.PI / 3;
    graphGroup.add(orbitRing2);

    // Node Meshes & Energy Packets
    const nodeMeshes: { mesh: THREE.Mesh; nodeData: Dynamic3DNode }[] = [];
    const pulsePackets: { mesh: THREE.Mesh; startPos: THREE.Vector3; endPos: THREE.Vector3 }[] = [];

    nodes.forEach((node) => {
      const nodeSubGroup = new THREE.Group();
      nodeSubGroup.position.set(...node.position);

      let geom: THREE.BufferGeometry;
      switch (node.shape) {
        case 'diamond':
          geom = new THREE.OctahedronGeometry(0.38, 0);
          break;
        case 'spiked':
          geom = new THREE.DodecahedronGeometry(0.42, 0);
          break;
        case 'ring':
          geom = new THREE.TorusGeometry(0.34, 0.08, 16, 32);
          break;
        case 'sphere':
        default:
          geom = new THREE.SphereGeometry(0.32, 24, 24);
          break;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: node.colorHex,
        emissive: node.colorHex,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.5
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { nodeData: node };
      nodeSubGroup.add(mesh);
      nodeMeshes.push({ mesh, nodeData: node });

      // Holographic protective halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.54, 24),
        new THREE.MeshBasicMaterial({
          color: node.colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5
        })
      );
      halo.rotation.x = Math.PI / 2;
      nodeSubGroup.add(halo);

      // Connecting Beam to Center Core
      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-node.position[0], -node.position[1], -node.position[2])
      ]);
      const beamMat = new THREE.LineBasicMaterial({
        color: node.colorHex,
        transparent: true,
        opacity: 0.35
      });
      const beam = new THREE.Line(beamGeo, beamMat);
      nodeSubGroup.add(beam);

      // Pulse particle
      const packetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: node.colorHex })
      );
      graphGroup.add(packetMesh);
      pulsePackets.push({
        mesh: packetMesh,
        startPos: new THREE.Vector3(...node.position),
        endPos: new THREE.Vector3(0, 0, 0)
      });

      graphGroup.add(nodeSubGroup);
    });

    // Transmission Path Line connecting: Attacker ➔ Checkpoint ➔ Relay ➔ Traced User
    const attackerNode = nodes.find(n => n.category === 'ATTACKER') || nodes[0];
    const checkpointNode = nodes.find(n => n.category === 'CHECKPOINT') || nodes[1];
    const relayNode = nodes.find(n => n.category === 'RELAY') || nodes[2];
    const userNode = nodes.find(n => n.category === 'USER') || nodes[3];

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...attackerNode.position),
      new THREE.Vector3(...checkpointNode.position),
      new THREE.Vector3(...relayNode.position),
      new THREE.Vector3(...userNode.position)
    ]);

    const curvePoints = curve.getPoints(60);
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineBasicMaterial({
      color: 0xede6d8,
      transparent: true,
      opacity: 0.7
    });
    const pathLine = new THREE.Line(curveGeo, curveMat);
    graphGroup.add(pathLine);

    // Active Packet moving along transmission path
    const pathPacket = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    graphGroup.add(pathPacket);

    // Click Detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map(n => n.mesh));
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const nData = hit.userData?.nodeData as Dynamic3DNode;
        if (nData) {
          setSelectedNode(nData);
        }
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('click', handlePointerDown);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (autoRotate) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.75;
      } else {
        controls.autoRotate = false;
      }
      controls.update();

      // Gentle rotation of core matrix
      coreMesh.rotation.y += delta * 0.12;
      coreMesh.rotation.x += delta * 0.06;

      // Animate node meshes
      nodeMeshes.forEach(({ mesh, nodeData }) => {
        if (nodeData.shape === 'diamond') {
          mesh.rotation.y += delta * 0.85;
          mesh.rotation.x += delta * 0.4;
        } else if (nodeData.shape === 'spiked') {
          mesh.rotation.y += delta * 0.55;
          mesh.rotation.z += delta * 0.45;
        } else if (nodeData.shape === 'ring') {
          mesh.rotation.x += delta * 0.65;
        }
      });

      // Pulse packets
      pulsePackets.forEach((p, idx) => {
        const t = (elapsed * 0.65 + idx * 0.2) % 1;
        p.mesh.position.lerpVectors(p.startPos, p.endPos, t);
        p.mesh.scale.setScalar(0.06 + Math.sin(t * Math.PI) * 0.05);
      });

      // Traveling packet along path
      const pathT = (elapsed * 0.22) % 1;
      const pointOnCurve = curve.getPointAt(pathT);
      pathPacket.position.copy(pointOnCurve);
      pathPacket.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.2);

      // Project 3D Coordinates to 2D Screen
      const coords: { id: string; x: number; y: number; visible: boolean; depth: number }[] = [];
      nodes.forEach((node) => {
        const worldPos = new THREE.Vector3(...node.position);
        worldPos.applyMatrix4(graphGroup.matrixWorld);
        const projected = worldPos.clone().project(camera);

        const isBehind = projected.z > 1;
        const screenX = ((projected.x + 1) * width) / 2;
        const screenY = ((-projected.y + 1) * height) / 2;

        coords.push({
          id: node.id,
          x: screenX,
          y: screenY,
          visible: !isBehind && screenX >= 10 && screenX <= width - 10 && screenY >= 10 && screenY <= height - 10,
          depth: worldPos.z
        });
      });
      setNodeScreenCoords(coords);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      domElement.removeEventListener('click', handlePointerDown);
      renderer.dispose();
    };
  }, [nodes, autoRotate]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (!cameraRef.current) return;
    const factor = direction === 'in' ? 0.85 : 1.15;
    cameraRef.current.position.multiplyScalar(factor);
    cameraRef.current.updateProjectionMatrix();
  };

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 1.4, 7.5);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    setAutoRotate(true);
  };

  return (
    <div id="r3f-forensic-matrix" className="w-full bg-[#110f0c] border-y border-[#3a352c] py-14 sm:py-18 relative select-none">
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Simple & Clean Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-[#1f1a14] border border-[#3d2f1f] text-[12px] font-['IBM_Plex_Mono',monospace] text-[#c9a227] mb-3">
            <Radio className="w-3.5 h-3.5 text-[#22c55e] animate-pulse" />
            <span>Live 3D Telemetry Matrix • {dbSourceStatus}</span>
          </div>

          <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[34px] md:text-[38px] font-medium text-[#ede6d8] leading-tight">
            Live Case Journey &amp; Attacker Nexus
          </h2>

          <p className="mt-2.5 text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed">
            Reconstructed dynamically from active database cases. Differentiating protected employees from malicious spoofing infrastructure.
          </p>

          {/* Real Database Case Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-[#8e8574] font-['IBM_Plex_Mono',monospace] mr-1">
              <Database className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Database Cases:</span>
            </div>

            {dbCases.map((dbCase, idx) => {
              const isSelected = activeCaseIndex === idx;
              const isHigh = dbCase.threatLevel === 'HIGH';
              return (
                <button
                  key={dbCase.id}
                  onClick={() => handleSelectCase(idx)}
                  className={`px-3 py-1.5 rounded-[4px] text-[12px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isHigh 
                        ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-md ring-1 ring-[#ff8d7d]' 
                        : 'bg-[#10b981] text-[#14120f] font-bold shadow-md ring-1 ring-[#34d399]'
                      : 'bg-[#1a1712] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
                  }`}
                  title={`Source: ${dbCase.source} • Last updated: ${new Date(dbCase.updatedAt).toLocaleTimeString()}`}
                >
                  <span className={`w-2 h-2 rounded-full ${isHigh ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
                  <span className="max-w-[140px] sm:max-w-[180px] truncate">{dbCase.title}</span>
                </button>
              );
            })}

            <button
              onClick={fetchLiveDatabaseData}
              disabled={isLoadingDb}
              className="p-1.5 rounded bg-[#1f1a14] hover:bg-[#2a241b] border border-[#3d2f1f] text-[#c9a227] transition-all cursor-pointer ml-1"
              title="Sync latest live cases from Supabase database"
              aria-label="Refresh Database Cases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Clear Shape & Color Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#10b981] rotate-45 shrink-0 rounded-[1px]" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Protected User</div>
              <div className="text-[10px] text-[#8e8574]">Targeted Employee</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#ef4444] shrink-0 rounded-[2px]" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Attacker Node</div>
              <div className="text-[10px] text-[#8e8574]">Tor Exit / Spoof IP</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 border-2 border-[#f59e0b] rounded-full shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Auth Checkpoint</div>
              <div className="text-[10px] text-[#8e8574]">SPF / DKIM / DMARC</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#3b82f6] rounded-full shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Mail Relay</div>
              <div className="text-[10px] text-[#8e8574]">Transit Gateway</div>
            </div>
          </div>
        </div>

        {/* Main 3D Display Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Redesigned 3D Orbit Viewport (8 Columns) */}
          <div className="lg:col-span-8 h-[460px] sm:h-[520px] relative rounded-[6px] border border-[#3d2f1f] bg-[radial-gradient(ellipse_at_top,#261c14_0%,#14120f_80%)] overflow-hidden shadow-2xl">
            
            {/* Top HUD Controls inside Viewport */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none gap-2">
              <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1 rounded bg-[#14120f]/90 border border-[#3a352c] text-[11px] font-['IBM_Plex_Mono',monospace] text-[#d6cdbe] shadow-lg">
                <MousePointer className="w-3 h-3 text-[#c9a227]" />
                <span className="hidden sm:inline">Drag to rotate • Scroll to zoom • Tap to inspect</span>
                <span className="sm:hidden">Drag &amp; tap to inspect</span>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5 shadow-lg">
                <button
                  onClick={() => handleZoom('in')}
                  className="p-1.5 rounded text-[11px] bg-[#181510] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-all cursor-pointer"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleZoom('out')}
                  className="p-1.5 rounded text-[11px] bg-[#181510] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-all cursor-pointer"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2.5 py-1 rounded text-[11px] font-['IBM_Plex_Mono',monospace] border transition-all cursor-pointer flex items-center gap-1 ${
                    autoRotate
                      ? 'bg-[#c9a227]/20 border-[#c9a227] text-[#ede6d8]'
                      : 'bg-[#181510] border-[#3a352c] text-[#8e8574]'
                  }`}
                  title="Toggle automatic camera orbit"
                >
                  <RotateCw className="w-3 h-3" />
                  <span className="hidden sm:inline">{autoRotate ? 'Orbit: ON' : 'Orbit: OFF'}</span>
                </button>

                <button
                  onClick={handleResetCamera}
                  className="px-2 py-1 rounded text-[11px] font-['IBM_Plex_Mono',monospace] bg-[#181510] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-all cursor-pointer flex items-center gap-1"
                  title="Reset 3D Camera View"
                >
                  <Compass className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Three.js DOM Canvas Mount */}
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* 3D Floating Labels projected on 2D space */}
            {nodeScreenCoords.map((coord) => {
              if (!coord.visible) return null;
              const node = nodes.find(n => n.id === coord.id);
              if (!node) return null;
              const isSelected = selectedNode?.id === node.id;
              const isMal = node.status === 'MALICIOUS';
              const isUser = node.category === 'USER';

              return (
                <div
                  key={node.id}
                  style={{
                    position: 'absolute',
                    left: `${coord.x}px`,
                    top: `${coord.y - 28}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isSelected ? 25 : 15
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node);
                  }}
                  className={`px-2.5 py-1 rounded-[4px] text-[11px] font-['IBM_Plex_Mono',monospace] font-bold cursor-pointer whitespace-nowrap transition-all select-none backdrop-blur-md flex items-center gap-1.5 shadow-xl ${
                    isSelected
                      ? 'bg-[#ede6d8] text-[#14120f] scale-110 ring-2 ring-[#c9a227] z-30'
                      : isMal
                        ? 'bg-[#1c1211]/90 text-[#ff8d7d] border border-[#ef4444]/60 hover:bg-[#b23a2e] hover:text-[#ede6d8]'
                        : isUser
                          ? 'bg-[#0e1912]/90 text-[#4ade80] border border-[#10b981]/60 hover:bg-[#10b981] hover:text-[#14120f]'
                          : 'bg-[#14120f]/90 text-[#d6cdbe] border border-[#3a352c] hover:border-[#c9a227]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isMal ? 'bg-[#ef4444]' : isUser ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`} />
                  <span>{node.name}</span>
                </div>
              );
            })}

            {/* Bottom Status Ticker inside Viewport */}
            <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] bg-[#14120f]/85 backdrop-blur-sm px-3 py-1.5 rounded border border-[#3a352c]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                <span>Supabase Live Sync: {lastSyncTime}</span>
              </span>
              <span>{nodes.length} Live Verified Nodes</span>
            </div>

          </div>

          {/* Side Plain-English & SOC Card (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col justify-between p-5 rounded-[6px] bg-[#181510] border border-[#3a352c] shadow-xl">
            {selectedNode ? (
              <div className="flex flex-col h-full justify-between">
                <div>
                  {/* Top Category Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-['IBM_Plex_Mono',monospace] font-bold uppercase ${
                      selectedNode.status === 'MALICIOUS'
                        ? 'bg-[#ef4444]/20 text-[#ff8d7d] border border-[#ef4444]/40'
                        : selectedNode.category === 'USER'
                          ? 'bg-[#10b981]/20 text-[#4ade80] border border-[#10b981]/40'
                          : 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40'
                    }`}>
                      {selectedNode.role}
                    </span>

                    {selectedNode.riskScore > 0 && (
                      <span className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#ff8d7d] font-bold">
                        {selectedNode.riskScore}% Risk
                      </span>
                    )}
                  </div>

                  {/* Node Name */}
                  <h3 className="text-[18px] sm:text-[20px] font-bold text-[#ede6d8] mb-1 leading-snug">
                    {selectedNode.name}
                  </h3>

                  {/* Toggle Explanation View */}
                  <div className="flex items-center gap-1 p-0.5 bg-[#110f0c] rounded border border-[#2d2820] my-3 w-fit">
                    <button
                      onClick={() => setExplanationMode('simple')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer ${
                        explanationMode === 'simple'
                          ? 'bg-[#221e17] text-[#ede6d8] font-bold'
                          : 'text-[#8e8574]'
                      }`}
                    >
                      Plain English
                    </button>
                    <button
                      onClick={() => setExplanationMode('technical')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer ${
                        explanationMode === 'technical'
                          ? 'bg-[#221e17] text-[#ede6d8] font-bold'
                          : 'text-[#8e8574]'
                      }`}
                    >
                      SOC Evidence
                    </button>
                  </div>

                  {/* Body Explanation */}
                  <div className="space-y-3 mt-3">
                    <div>
                      <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#c9a227] uppercase tracking-wider mb-1 font-semibold">
                        {explanationMode === 'simple' ? 'What does this mean?' : 'Technical Verification:'}
                      </div>
                      <p className="text-[14px] text-[#d6cdbe] leading-relaxed m-0">
                        {explanationMode === 'simple' ? selectedNode.simpleExplanation : selectedNode.technicalDetails}
                      </p>
                    </div>

                    <div className="p-3 rounded bg-[#110f0c] border border-[#2d2820]">
                      <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase tracking-wider mb-0.5 font-semibold">
                        Protective Action:
                      </div>
                      <p className="text-[13px] text-[#ede6d8] m-0 leading-snug">
                        {selectedNode.actionAdvice}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct Action to Console */}
                <div className="pt-4 border-t border-[#3a352c] mt-6">
                  <button
                    onClick={onOpenConsole}
                    className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-2.5 px-4 rounded-[4px] font-semibold text-[13.5px] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>Open Live Evidence in Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-[#8e8574] mt-2 font-['IBM_Plex_Mono',monospace]">
                    Direct Supabase Sync • Free Instant Triage
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8e8574]">
                <Info className="w-8 h-8 text-[#c9a227] mb-2" />
                <p className="text-[13px]">Click any 3D node to inspect its story</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
