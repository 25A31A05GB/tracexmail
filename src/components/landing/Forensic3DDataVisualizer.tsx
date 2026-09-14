import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  Database
} from 'lucide-react';
import { EmailAnalysis } from '../../types';
import { SAMPLE_ANALYSES } from '../../data/samples';

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

interface Forensic3DDataVisualizerProps {
  currentAnalysis?: EmailAnalysis;
  onSelectCase?: (analysis: EmailAnalysis) => void;
  onOpenConsole?: () => void;
  onExploreCase?: (caseIndex?: number) => void;
}

// Convert any live EmailAnalysis into an intuitive 3D node network
function deriveNodesFromCase(analysis: EmailAnalysis): Dynamic3DNode[] {
  const nodes: Dynamic3DNode[] = [];
  const isMalicious = (analysis.riskScore ?? (analysis.threatScore ?? 80)) >= 60;
  const threatScore = analysis.riskScore ?? (analysis.threatScore ?? 85);

  // 1. Traced User / Recipient Node (Protected User) - DIAMOND GREEN/CYAN
  const recipientEmail = analysis.headers?.to || 'employee@yourcompany.com';
  nodes.push({
    id: 'node-user',
    name: recipientEmail.split('<').pop()?.replace('>', '') || 'Protected User',
    category: 'USER',
    role: 'Traced Recipient (Protected Inbox)',
    status: 'CLEAN',
    riskScore: 0,
    position: [2.8, -0.4, 0.5],
    simpleExplanation: 'This is the verified employee inbox targeted by the message. The user was safely protected from the attack.',
    technicalDetails: `Final destination mailbox. Envelope To: ${recipientEmail}. Endpoint identity verified.`,
    actionAdvice: 'Safe. No user credentials were leaked.',
    colorHex: 0x22c55e,
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
    name: isMalicious ? 'Threat Actor Gateway' : 'Legitimate Sender Gateway',
    category: isMalicious ? 'ATTACKER' : 'RELAY',
    role: isMalicious ? 'Attacker Origin (Hidden Relay)' : 'Verified Mail Origin',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? threatScore : 5,
    position: [-2.8, 0.8, -0.4],
    simpleExplanation: isMalicious 
      ? `The real computer that sent this email. It hid behind ${originLocation} while pretending to be someone else.` 
      : `The official mail server in ${originLocation} authorized by the sender organization.`,
    technicalDetails: `IP: ${originIp} | ASN: ${originHop?.asn || 'AS200548'} | PTR: ${originHop?.reverseDns || 'unresolved'}`,
    actionAdvice: isMalicious ? 'Permanently blocked at enterprise gateway.' : 'No action required; origin verified.',
    colorHex: isMalicious ? 0xef4444 : 0x38bdf8,
    shape: isMalicious ? 'spiked' : 'sphere'
  });

  // 3. Security Checkpoint (SPF / DKIM / DMARC verification) - RING GOLD/RED
  const dmarcStatus = analysis.authResults?.dmarc?.status || (isMalicious ? 'FAIL' : 'PASS');
  const spfStatus = analysis.authResults?.spf?.status || (isMalicious ? 'SOFTFAIL' : 'PASS');
  nodes.push({
    id: 'node-security',
    name: 'Authentication Checkpoint',
    category: 'CHECKPOINT',
    role: 'Cryptographic Security Gate',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 92 : 2,
    position: [-0.2, 1.8, 0.7],
    simpleExplanation: isMalicious
      ? `The digital security checkpoint failed. The sender's signature did not match the claimed brand domain.`
      : `All cryptographic checks passed! The sender signature perfectly matches the company domain.`,
    technicalDetails: `SPF: ${spfStatus} | DKIM: ${analysis.authResults?.dkim?.status || 'PASS'} | DMARC: ${dmarcStatus}`,
    actionAdvice: isMalicious ? 'Message flagged for spoofing attempt.' : 'Identity cryptographically validated.',
    colorHex: isMalicious ? 0xf59e0b : 0x10b981,
    shape: 'ring'
  });

  // 4. Mail Transit Relay (Intermediary MTA / Proofpoint / Google) - SPHERE BLUE
  const secondHop = analysis.hops?.[1] || { fromHost: 'mx.inbound-security.net', fromIp: '198.51.100.22' };
  nodes.push({
    id: 'node-relay',
    name: secondHop.fromHost || 'Inbound Mail Gateway',
    category: 'RELAY',
    role: 'Legitimate Mail Gateway',
    status: 'CLEAN',
    riskScore: 8,
    position: [0.6, -1.5, -0.6],
    simpleExplanation: 'Standard internet mail transit station that received the incoming packet and inspected its safety.',
    technicalDetails: `MTA Hop #2: ${secondHop.fromIp || '198.51.100.22'} | Time delay: 0.8s | TLS Encrypted`,
    actionAdvice: 'Verified safe delivery pipeline node.',
    colorHex: 0x60a5fa,
    shape: 'sphere'
  });

  // 5. Domain / Typosquat or Brand Entity - CUBE OR DIAMOND
  const fromDomain = analysis.headers?.from?.split('@')[1]?.replace('>', '') || 'paypal-account-security.com';
  nodes.push({
    id: 'node-domain',
    name: fromDomain,
    category: isMalicious ? 'ATTACKER' : 'USER',
    role: isMalicious ? 'Lookalike / Phishing Domain' : 'Verified Sender Domain',
    status: isMalicious ? 'MALICIOUS' : 'CLEAN',
    riskScore: isMalicious ? 95 : 4,
    position: [-1.2, -0.8, 1.2],
    simpleExplanation: isMalicious
      ? `A deceptive domain created by the attacker to trick the user into thinking this was an official email.`
      : `The official verified corporate domain for this sender organization.`,
    technicalDetails: `Domain: ${fromDomain} | Age: 3 days old | Registrar: Anonymous Privacy`,
    actionAdvice: isMalicious ? 'Blacklisted globally across all SOC DNS resolvers.' : 'Legitimate domain reputation.',
    colorHex: isMalicious ? 0xdc2626 : 0x34d399,
    shape: isMalicious ? 'spiked' : 'diamond'
  });

  return nodes;
}

export const Forensic3DDataVisualizer: React.FC<Forensic3DDataVisualizerProps> = ({
  currentAnalysis,
  onSelectCase,
  onOpenConsole
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [activeAnalysis, setActiveAnalysis] = useState<EmailAnalysis>(currentAnalysis || SAMPLE_ANALYSES[0]);
  const [selectedNode, setSelectedNode] = useState<Dynamic3DNode | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [explanationMode, setExplanationMode] = useState<'simple' | 'technical'>('simple');
  const [nodeScreenCoords, setNodeScreenCoords] = useState<{ id: string; x: number; y: number; visible: boolean; depth: number }[]>([]);

  // Update active analysis when sample preset is clicked
  const handleSelectPreset = (idx: number) => {
    setSelectedCaseIndex(idx);
    const sample = SAMPLE_ANALYSES[idx] || SAMPLE_ANALYSES[0];
    setActiveAnalysis(sample);
    if (onSelectCase) {
      onSelectCase(sample);
    }
  };

  // Derive dynamic 3D nodes from the active case
  const nodes = useMemo(() => {
    return deriveNodesFromCase(activeAnalysis);
  }, [activeAnalysis]);

  // Set default selected node on case change
  useEffect(() => {
    setSelectedNode(nodes[0]);
  }, [nodes]);

  // Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.5;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.minPolarAngle = Math.PI / 5;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 8, 5);
    scene.add(mainLight);

    const redAccent = new THREE.PointLight(0xef4444, 2.5, 12);
    redAccent.position.set(-4, 2, 2);
    scene.add(redAccent);

    const greenAccent = new THREE.PointLight(0x22c55e, 2.5, 12);
    greenAccent.position.set(4, -2, 2);
    scene.add(greenAccent);

    // Root Group
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    // Central Core Glow Grid Sphere
    const centralGeo = new THREE.SphereGeometry(0.7, 16, 16);
    const centralMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const centralMesh = new THREE.Mesh(centralGeo, centralMat);
    graphGroup.add(centralMesh);

    // Orbital Ring
    const orbitRingGeo = new THREE.TorusGeometry(2.8, 0.015, 16, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({ color: 0x8a8070, transparent: true, opacity: 0.3 });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2.3;
    graphGroup.add(orbitRing);

    // Create 3D Meshes for each dynamic node based on its unique Shape & Color
    const nodeMeshes: { mesh: THREE.Mesh; nodeData: Dynamic3DNode }[] = [];
    const pulsePackets: { mesh: THREE.Mesh; startPos: THREE.Vector3; endPos: THREE.Vector3 }[] = [];

    nodes.forEach((node) => {
      const nodeSubGroup = new THREE.Group();
      nodeSubGroup.position.set(...node.position);

      let geom: THREE.BufferGeometry;

      // Unique 3D Geometries to clearly differentiate roles:
      switch (node.shape) {
        case 'diamond': // Traced User / Recipient
          geom = new THREE.OctahedronGeometry(0.38, 0);
          break;
        case 'spiked': // Malicious Attacker Entity
          geom = new THREE.DodecahedronGeometry(0.42, 0);
          break;
        case 'ring': // Authentication Security Checkpoint
          geom = new THREE.TorusGeometry(0.34, 0.08, 16, 32);
          break;
        case 'sphere': // Mail Transit Relay
        default:
          geom = new THREE.SphereGeometry(0.32, 24, 24);
          break;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: node.colorHex,
        emissive: node.colorHex,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.6
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { nodeData: node };
      nodeSubGroup.add(mesh);
      nodeMeshes.push({ mesh, nodeData: node });

      // Halo ring around each node
      const haloGeo = new THREE.RingGeometry(0.46, 0.54, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: node.colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      nodeSubGroup.add(halo);

      // Connective Beam to Center Core
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

      // Packet Pulse along connection line
      const packetGeo = new THREE.SphereGeometry(0.07, 12, 12);
      const packetMat = new THREE.MeshBasicMaterial({ color: node.colorHex });
      const packetMesh = new THREE.Mesh(packetGeo, packetMat);
      graphGroup.add(packetMesh);
      pulsePackets.push({
        mesh: packetMesh,
        startPos: new THREE.Vector3(...node.position),
        endPos: new THREE.Vector3(0, 0, 0)
      });

      graphGroup.add(nodeSubGroup);
    });

    // Inter-node connection curve: Attacker ➔ Security Checkpoint ➔ Relay ➔ Traced User
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

    const curvePoints = curve.getPoints(50);
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const curveMat = new THREE.LineBasicMaterial({
      color: 0xede6d8,
      transparent: true,
      opacity: 0.6
    });
    const pathLine = new THREE.Line(curveGeo, curveMat);
    graphGroup.add(pathLine);

    // Traveling Phish Packet along the entire transmission path
    const pathPacketGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const pathPacketMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const pathPacket = new THREE.Mesh(pathPacketGeo, pathPacketMat);
    graphGroup.add(pathPacket);

    // Click Raycasting
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
        controls.autoRotateSpeed = 0.8;
      } else {
        controls.autoRotate = false;
      }
      controls.update();

      // Slow gentle rotation of core
      centralMesh.rotation.y += delta * 0.15;
      centralMesh.rotation.x += delta * 0.08;

      // Animate individual node meshes (spinning diamonds/dodecahedrons)
      nodeMeshes.forEach(({ mesh, nodeData }) => {
        if (nodeData.shape === 'diamond') {
          mesh.rotation.y += delta * 0.9;
          mesh.rotation.x += delta * 0.4;
        } else if (nodeData.shape === 'spiked') {
          mesh.rotation.y += delta * 0.6;
          mesh.rotation.z += delta * 0.5;
        } else if (nodeData.shape === 'ring') {
          mesh.rotation.x += delta * 0.7;
        }
      });

      // Packet pulses along radius rays
      pulsePackets.forEach((p, idx) => {
        const t = (elapsed * 0.7 + idx * 0.2) % 1;
        p.mesh.position.lerpVectors(p.startPos, p.endPos, t);
        p.mesh.scale.setScalar(0.06 + Math.sin(t * Math.PI) * 0.05);
      });

      // Path packet along transmission curve
      const pathT = (elapsed * 0.25) % 1;
      const pointOnCurve = curve.getPointAt(pathT);
      pathPacket.position.copy(pointOnCurve);
      pathPacket.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.2);

      // Project 3D Coordinates to 2D Screen for Friendly Floating Labels
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

  const handleResetCamera = () => {
    setAutoRotate(true);
  };

  return (
    <div id="r3f-forensic-matrix" className="w-full bg-[#110f0c] border-y border-[#3a352c] py-14 sm:py-18 relative select-none">
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Simple & Clean Header */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-[#1f1a14] border border-[#3d2f1f] text-[12px] font-['IBM_Plex_Mono',monospace] text-[#c9a227] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#c9a227]" />
            <span>Interactive 3D Email Journey Map</span>
          </div>

          <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[34px] md:text-[38px] font-medium text-[#ede6d8] leading-tight">
            See how the email traveled from attacker to your inbox
          </h2>

          <p className="mt-2.5 text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed">
            Every email is a journey across the internet. TraceXMail reconstructs each stop along the way, separating malicious attackers from protected users in real time.
          </p>

          {/* Preset Case Buttons to switch live database case structure */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <span className="text-[12px] text-[#8e8574] font-['IBM_Plex_Mono',monospace] mr-1">
              Select Live Case:
            </span>
            <button
              onClick={() => handleSelectPreset(0)}
              className={`px-3 py-1.5 rounded-[4px] text-[12.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCaseIndex === 0
                  ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-md'
                  : 'bg-[#1a1712] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>Nazario PayPal Phish</span>
            </button>

            <button
              onClick={() => handleSelectPreset(1)}
              className={`px-3 py-1.5 rounded-[4px] text-[12.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCaseIndex === 1
                  ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-md'
                  : 'bg-[#1a1712] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>CEO BEC Wire Fraud</span>
            </button>

            <button
              onClick={() => handleSelectPreset(2)}
              className={`px-3 py-1.5 rounded-[4px] text-[12.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCaseIndex === 2
                  ? 'bg-[#22c55e] text-[#14120f] font-bold shadow-md'
                  : 'bg-[#1a1712] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span>Safe GitHub Verification</span>
            </button>
          </div>
        </div>

        {/* Clear Shape & Color Legend for Non-Technical Users */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#22c55e] rotate-45 shrink-0 rounded-[1px]" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Protected User</div>
              <div className="text-[10px] text-[#8e8574]">Targeted Employee</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#ef4444] shrink-0 rounded-[2px]" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Attacker Node</div>
              <div className="text-[10px] text-[#8e8574]">Phishing / Spoofing</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 border-2 border-[#f59e0b] rounded-full shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Security Gate</div>
              <div className="text-[10px] text-[#8e8574]">SPF / DKIM / DMARC</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-[4px] bg-[#16130f] border border-[#2d2820]">
            <div className="w-3.5 h-3.5 bg-[#60a5fa] rounded-full shrink-0" />
            <div>
              <div className="text-[12px] font-bold text-[#ede6d8] leading-tight">Mail Relay</div>
              <div className="text-[10px] text-[#8e8574]">Transit Servers</div>
            </div>
          </div>
        </div>

        {/* Main 3D Display Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* 3D WebGL Canvas Viewport (8 Columns) */}
          <div className="lg:col-span-8 h-[440px] sm:h-[500px] relative rounded-[6px] border border-[#3d2f1f] bg-[radial-gradient(ellipse_at_top,#261c14_0%,#14120f_80%)] overflow-hidden shadow-2xl">
            
            {/* Top Bar inside Viewport */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1 rounded bg-[#14120f]/90 border border-[#3a352c] text-[11px] font-['IBM_Plex_Mono',monospace] text-[#d6cdbe]">
                <MousePointer className="w-3 h-3 text-[#c9a227]" />
                <span className="hidden sm:inline">Click any node or drag to rotate 3D view</span>
                <span className="sm:hidden">Tap nodes to inspect</span>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-2.5 py-1 rounded text-[11px] font-['IBM_Plex_Mono',monospace] border transition-all cursor-pointer flex items-center gap-1 ${
                    autoRotate
                      ? 'bg-[#c9a227]/20 border-[#c9a227] text-[#ede6d8]'
                      : 'bg-[#181510] border-[#3a352c] text-[#8e8574]'
                  }`}
                  title="Toggle continuous gentle rotation"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>{autoRotate ? 'Orbit: ON' : 'Orbit: PAUSED'}</span>
                </button>

                <button
                  onClick={handleResetCamera}
                  className="px-2.5 py-1 rounded text-[11px] font-['IBM_Plex_Mono',monospace] bg-[#181510] border border-[#3a352c] text-[#b9af9c] hover:text-[#ede6d8] transition-all cursor-pointer flex items-center gap-1"
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
                          ? 'bg-[#0e1912]/90 text-[#4ade80] border border-[#22c55e]/60 hover:bg-[#22c55e] hover:text-[#14120f]'
                          : 'bg-[#14120f]/90 text-[#d6cdbe] border border-[#3a352c] hover:border-[#c9a227]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isMal ? 'bg-[#ef4444]' : isUser ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
                  <span>{node.name}</span>
                </div>
              );
            })}

            {/* Bottom Status Ticker inside Viewport */}
            <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] bg-[#14120f]/80 backdrop-blur-sm px-3 py-1.5 rounded border border-[#3a352c]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping" />
                <span>Live Graph Synced to Active Case</span>
              </span>
              <span>{nodes.length} Verified Nodes</span>
            </div>

          </div>

          {/* Side Plain-English Explanation Card (4 Columns) */}
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
                          ? 'bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40'
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
                    <span>Open Full Evidence in Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-[#8e8574] mt-2 font-['IBM_Plex_Mono',monospace]">
                    Zero setup • Free instant verification
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8e8574]">
                <Info className="w-8 h-8 text-[#c9a227] mb-2" />
                <p className="text-[13px]">Click any 3D node to inspect its plain-English story</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
