import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Globe2, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Layers, 
  Zap, 
  Sparkles, 
  Terminal, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  RotateCw,
  Maximize2,
  FileCode,
  Activity,
  Cpu,
  Fingerprint
} from 'lucide-react';
import { SAMPLE_ANALYSES, EMPTY_ANALYSIS } from '../../data/samples';
import { EmailAnalysis, EmailHop } from '../../types';

interface CompleteProject3DShowcaseProps {
  onOpenConsole: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

type ShowcaseMode = 'globe' | 'crypto' | 'mime' | 'reactor';

interface ModeConfig {
  id: ShowcaseMode;
  label: string;
  badge: string;
  title: string;
  description: string;
  icon: any;
  metric: string;
  metricLabel: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'globe',
    label: 'Global Hop Trajectory',
    badge: 'STAGE 1: SOCKET & ASN TRACE',
    title: '3D Spherical BGP Transit & Geolocation Tracker',
    description: 'Track the physical transit route of an email across planetary networks. TraceXMail maps the original socket IP, isolates intermediate MTAs, and unmasks Tor exit relays and bulletproof hosting autonomous systems (ASNs).',
    icon: Globe2,
    metric: '3,840 km',
    metricLabel: 'PHYSICAL TRANSIT DISTANCE'
  },
  {
    id: 'crypto',
    label: 'Cryptographic Auth Reactor',
    badge: 'STAGE 2: MATHEMATICAL VERIFICATION',
    title: '3D Interlocking SPF, DKIM & DMARC Gate',
    description: 'Inspect cryptographic digital signatures in full three-dimensional space. The reactor validates 2048-bit RSA keys (DKIM), queries sender DNS netblocks (SPF), and tests strict domain alignment policies (DMARC).',
    icon: Lock,
    metric: '2048-bit',
    metricLabel: 'RSA SIGNATURE STRENGTH'
  },
  {
    id: 'mime',
    label: 'MIME Payload Sandbox',
    badge: 'STAGE 3: PAYLOAD DISSECTION',
    title: '3D Boundary Unsealer & Attachment Scanner',
    description: 'Peel back RFC 2046 multi-part boundaries to inspect encoded payloads, hidden tracking pixels, and malicious double extensions (.pdf.exe) with Shannon entropy analysis.',
    icon: FileCode,
    metric: '7.94 bits',
    metricLabel: 'ENTROPY RISK INDEX'
  },
  {
    id: 'reactor',
    label: 'Evidence Custody Vault',
    badge: 'STAGE 4: COURT-READY DEFENSE',
    title: '3D Immutable SHA-256 Evidentiary Block',
    description: 'Mint a cryptographically stamped evidence dossier. Once an attack is deconstructed, TraceXMail creates a tamper-proof SHA-256 hash and audit package ready for law enforcement and SOC briefings.',
    icon: Fingerprint,
    metric: 'SHA-256',
    metricLabel: 'CRYPTOGRAPHIC INTEGRITY'
  }
];

export const CompleteProject3DShowcase: React.FC<CompleteProject3DShowcaseProps> = ({
  onOpenConsole,
  onSelectCase
}) => {
  const [activeMode, setActiveMode] = useState<ShowcaseMode>('globe');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [threatIntensity, setThreatIntensity] = useState<number>(85);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(0);

  const mountRef = useRef<HTMLDivElement>(null);
  const currentCase = SAMPLE_ANALYSES[selectedCaseIdx] || SAMPLE_ANALYSES[0] || EMPTY_ANALYSIS;
  const isMalicious = (currentCase.riskScore ?? 80) >= 70;

  // 3D Three.js Visualizer Engine
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 600;
    let height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.8);
    mainLight.position.set(5, 6, 8);
    scene.add(mainLight);

    const accentColor = isMalicious ? 0xb23a2e : 0x22c55e;
    const accentLight = new THREE.PointLight(accentColor, 3.2, 20);
    accentLight.position.set(-4, -2, 4);
    scene.add(accentLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Mode-specific 3D Geometries & Objects
    let animObjects: {
      update: (time: number) => void;
      dispose: () => void;
    } | null = null;

    // --- MODE 1: 3D SPHERICAL BGP GLOBE ---
    if (activeMode === 'globe') {
      const globeRadius = 1.85;
      const globeGeo = new THREE.SphereGeometry(globeRadius, 36, 36);
      const globeMat = new THREE.MeshStandardMaterial({
        color: 0x1e1914,
        roughness: 0.7,
        metalness: 0.2,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const globeMesh = new THREE.Mesh(globeGeo, globeMat);
      rootGroup.add(globeMesh);

      // Inner glow sphere
      const innerGeo = new THREE.SphereGeometry(globeRadius * 0.96, 24, 24);
      const innerMat = new THREE.MeshBasicMaterial({
        color: isMalicious ? 0x7f1d1d : 0x064e3b,
        transparent: true,
        opacity: 0.25
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      rootGroup.add(innerMesh);

      // Spherical coordinate mapper
      const toVector3 = (lat: number, lng: number, r: number) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);
        return new THREE.Vector3(
          -r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
      };

      // Hop Nodes: Origin (Sofia), Transit (Frankfurt), Target (New York)
      const p1 = toVector3(42.6977, 23.3219, globeRadius + 0.05); // Sofia
      const p2 = toVector3(50.1109, 8.6821, globeRadius + 0.05);  // Frankfurt
      const p3 = toVector3(40.7128, -74.0060, globeRadius + 0.05); // New York

      const pinGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const originMat = new THREE.MeshBasicMaterial({ color: isMalicious ? 0xef4444 : 0x38bdf8 });
      const transitMat = new THREE.MeshBasicMaterial({ color: 0xc9a227 });
      const targetMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

      const pin1 = new THREE.Mesh(pinGeo, originMat); pin1.position.copy(p1);
      const pin2 = new THREE.Mesh(pinGeo, transitMat); pin2.position.copy(p2);
      const pin3 = new THREE.Mesh(pinGeo, targetMat); pin3.position.copy(p3);
      rootGroup.add(pin1, pin2, pin3);

      // Arcs connecting hops with ballistic elevation
      const createArc = (start: THREE.Vector3, end: THREE.Vector3) => {
        const mid = start.clone().add(end).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(globeRadius * 1.35); // elevate above surface
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.025, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: isMalicious ? 0xef4444 : 0x38bdf8,
          transparent: true,
          opacity: 0.85
        });
        return new THREE.Mesh(tubeGeo, tubeMat);
      };

      const arc1 = createArc(p1, p2);
      const arc2 = createArc(p2, p3);
      rootGroup.add(arc1, arc2);

      // Packet traveling on arc
      const packetGeo = new THREE.SphereGeometry(0.05, 12, 12);
      const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const packetMesh = new THREE.Mesh(packetGeo, packetMat);
      rootGroup.add(packetMesh);

      let progress = 0;
      animObjects = {
        update: () => {
          rootGroup.rotation.y += 0.004;
          progress = (progress + 0.008) % 1;
          const curve = progress < 0.5 
            ? new THREE.QuadraticBezierCurve3(p1, p1.clone().add(p2).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius * 1.35), p2)
            : new THREE.QuadraticBezierCurve3(p2, p2.clone().add(p3).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius * 1.35), p3);
          const t = (progress % 0.5) * 2;
          packetMesh.position.copy(curve.getPoint(t));
        },
        dispose: () => {
          globeGeo.dispose();
          innerGeo.dispose();
          pinGeo.dispose();
          packetGeo.dispose();
        }
      };
    }

    // --- MODE 2: 3D CRYPTOGRAPHIC SECURITY REACTOR ---
    else if (activeMode === 'crypto') {
      const ringGroup = new THREE.Group();
      rootGroup.add(ringGroup);

      // 3 Concentric Interlocking Rings: SPF, DKIM, DMARC
      const r1 = new THREE.TorusGeometry(2.1, 0.05, 16, 64);
      const r2 = new THREE.TorusGeometry(1.6, 0.06, 16, 64);
      const r3 = new THREE.TorusGeometry(1.1, 0.07, 16, 64);

      const m1 = new THREE.MeshStandardMaterial({ color: isMalicious ? 0xef4444 : 0x22c55e, metalness: 0.8, roughness: 0.2 });
      const m2 = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.2 });
      const m3 = new THREE.MeshStandardMaterial({ color: isMalicious ? 0xd97706 : 0x38bdf8, metalness: 0.8, roughness: 0.2 });

      const ring1 = new THREE.Mesh(r1, m1);
      const ring2 = new THREE.Mesh(r2, m2);
      const ring3 = new THREE.Mesh(r3, m3);

      ringGroup.add(ring1, ring2, ring3);

      // Central Cryptographic Vault Core
      const coreGeo = new THREE.IcosahedronGeometry(0.65, 1);
      const coreMat = new THREE.MeshStandardMaterial({
        color: isMalicious ? 0xef4444 : 0x22c55e,
        roughness: 0.3,
        metalness: 0.7,
        wireframe: false
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      ringGroup.add(coreMesh);

      // Particle Cloud around core
      const particleCount = 60;
      const partGeo = new THREE.BufferGeometry();
      const partPos = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        partPos[i] = (Math.random() - 0.5) * 4;
        partPos[i + 1] = (Math.random() - 0.5) * 4;
        partPos[i + 2] = (Math.random() - 0.5) * 4;
      }
      partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
      const partMat = new THREE.PointsMaterial({ color: 0xc9a227, size: 0.05, transparent: true, opacity: 0.8 });
      const partPoints = new THREE.Points(partGeo, partMat);
      ringGroup.add(partPoints);

      animObjects = {
        update: (time) => {
          ring1.rotation.x = time * 0.4;
          ring1.rotation.y = time * 0.2;
          ring2.rotation.y = time * 0.5;
          ring2.rotation.z = time * 0.3;
          ring3.rotation.x = time * 0.6;
          ring3.rotation.z = time * 0.4;
          coreMesh.rotation.y += 0.01;
          coreMesh.rotation.x += 0.008;
          partPoints.rotation.y = time * 0.15;
        },
        dispose: () => {
          r1.dispose(); r2.dispose(); r3.dispose(); coreGeo.dispose(); partGeo.dispose();
        }
      };
    }

    // --- MODE 3: 3D MIME PAYLOAD & ATTACHMENT SANDBOX ---
    else if (activeMode === 'mime') {
      const mimeGroup = new THREE.Group();
      rootGroup.add(mimeGroup);

      // Boundary Hexagonal Cylinder Cage
      const cageGeo = new THREE.CylinderGeometry(1.8, 1.8, 3.2, 6, 1, true);
      const cageMat = new THREE.MeshBasicMaterial({
        color: 0x3a352c,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      const cageMesh = new THREE.Mesh(cageGeo, cageMat);
      mimeGroup.add(cageMesh);

      // Floating Payload Data Blocks (Dissected Attachments & Text Parts)
      const blockGeo = new THREE.BoxGeometry(0.8, 0.4, 0.6);
      const blocks: THREE.Mesh[] = [];

      for (let i = 0; i < 4; i++) {
        const isMalBlock = i === 1 && isMalicious;
        const bMat = new THREE.MeshStandardMaterial({
          color: isMalBlock ? 0xef4444 : 0x7fa3ba,
          metalness: 0.5,
          roughness: 0.3
        });
        const mesh = new THREE.Mesh(blockGeo, bMat);
        mesh.position.set((i % 2 === 0 ? -1 : 1) * 0.7, (i - 1.5) * 0.75, (i > 1 ? 0.3 : -0.3));
        mimeGroup.add(mesh);
        blocks.push(mesh);
      }

      // Rotating Scanning Laser Disc
      const discGeo = new THREE.CylinderGeometry(1.7, 1.7, 0.04, 32);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const disc = new THREE.Mesh(discGeo, discMat);
      mimeGroup.add(disc);

      let discY = 1.4;
      let discDir = -1;

      animObjects = {
        update: (time) => {
          mimeGroup.rotation.y += 0.005;
          discY += discDir * 0.02;
          if (discY < -1.4 || discY > 1.4) discDir *= -1;
          disc.position.y = discY;

          blocks.forEach((b, idx) => {
            b.rotation.y = Math.sin(time + idx) * 0.2;
            b.position.y += Math.cos(time * 2 + idx) * 0.003;
          });
        },
        dispose: () => {
          cageGeo.dispose();
          blockGeo.dispose();
          discGeo.dispose();
        }
      };
    }

    // --- MODE 4: 3D EVIDENCE CUSTODY VAULT ---
    else {
      const vaultGroup = new THREE.Group();
      rootGroup.add(vaultGroup);

      // Octagonal Cryptographic Pillar
      const pillarGeo = new THREE.CylinderGeometry(1.4, 1.4, 3.4, 8);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x1a1712,
        metalness: 0.8,
        roughness: 0.25,
        wireframe: false
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      vaultGroup.add(pillar);

      // Glowing Data Rings on pillar
      const ringGeo = new THREE.TorusGeometry(1.5, 0.04, 16, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.7 });
      for (let r = -1.2; r <= 1.2; r += 0.6) {
        const rMesh = new THREE.Mesh(ringGeo, ringMat);
        rMesh.rotation.x = Math.PI / 2;
        rMesh.position.y = r;
        vaultGroup.add(rMesh);
      }

      // Outer floating hash satellites
      const satGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const satMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.1 });
      const sats: THREE.Mesh[] = [];
      for (let s = 0; s < 6; s++) {
        const sMesh = new THREE.Mesh(satGeo, satMat);
        vaultGroup.add(sMesh);
        sats.push(sMesh);
      }

      animObjects = {
        update: (time) => {
          vaultGroup.rotation.y = time * 0.2;
          sats.forEach((s, idx) => {
            const angle = (idx / 6) * Math.PI * 2 + time * 0.5;
            s.position.set(Math.cos(angle) * 2.2, Math.sin(time + idx) * 0.6, Math.sin(angle) * 2.2);
            s.rotation.x += 0.02;
            s.rotation.y += 0.03;
          });
        },
        dispose: () => {
          pillarGeo.dispose();
          ringGeo.dispose();
          satGeo.dispose();
        }
      };
    }

    // Interactive Drag Controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let targetRotY = 0.3;
    let targetRotX = 0.2;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      targetRotY += dx * 0.006;
      targetRotX += dy * 0.006;
      targetRotX = Math.max(-0.6, Math.min(0.6, targetRotX));
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 600;
      height = container.clientHeight || 480;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!isDragging) {
        targetRotY += 0.002;
      }
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.08;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.08;

      if (animObjects) {
        animObjects.update(elapsed);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      if (animObjects) animObjects.dispose();
    };
  }, [activeMode, selectedCaseIdx, isMalicious]);

  const activeModeConfig = MODES.find(m => m.id === activeMode) || MODES[0];

  // Simulation Sequence Trigger
  const handleTriggerSimulation = () => {
    setIsSimulating(true);
    setSimStep(1);
    setActiveMode('globe');

    setTimeout(() => {
      setSimStep(2);
      setActiveMode('crypto');
    }, 1800);

    setTimeout(() => {
      setSimStep(3);
      setActiveMode('mime');
    }, 3600);

    setTimeout(() => {
      setSimStep(4);
      setActiveMode('reactor');
      setIsSimulating(false);
    }, 5400);
  };

  const handleLaunchFullAnalysis = () => {
    if (onSelectCase) {
      onSelectCase(currentCase);
    }
    onOpenConsole();
  };

  return (
    <section id="project-3d-showcase" className="py-16 sm:py-20 lg:py-24 border-b border-[#3a352c] bg-[radial-gradient(ellipse_1000px_500px_at_50%_0%,rgba(178,58,46,0.07),transparent_75%),#14120f] relative overflow-hidden">
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[3px] bg-[#221c15] border border-[#3d2f1f] text-[11.5px] font-['IBM_Plex_Mono',monospace] text-[#c9a227] mb-3 font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Full Interactive 3D Architecture</span>
            </div>
            <h2 className="font-['Fraunces',serif] text-[30px] sm:text-[40px] font-medium text-[#ede6d8] leading-[1.14] tracking-tight">
              Watch an attack dismantle across all four dimensions.
            </h2>
            <p className="mt-3 text-[15px] sm:text-[16px] text-[#b9af9c] leading-relaxed">
              Every email travels through an immutable physical and cryptographic gauntlet. Interact with each stage of the TraceXMail forensic pipeline in real-time 3D space.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleTriggerSimulation}
              disabled={isSimulating}
              className={`px-5 py-3 rounded-[3px] font-semibold text-[13.5px] font-['IBM_Plex_Mono',monospace] border transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                isSimulating
                  ? 'bg-[#c9a227] text-[#14120f] border-[#c9a227] animate-pulse'
                  : 'bg-[#1f1a14] hover:bg-[#2c241b] text-[#ede6d8] border-[#3a352c]'
              }`}
            >
              <Zap className="w-4 h-4 text-[#c9a227]" />
              <span>{isSimulating ? `Running Pipeline (Step ${simStep}/4)...` : 'Simulate 3D Attack Injection'}</span>
            </button>

            <button
              onClick={handleLaunchFullAnalysis}
              className="px-5 py-3 rounded-[3px] font-semibold text-[13.5px] bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] border border-[#b23a2e] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md group"
            >
              <span>Launch Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* 4 Stage Mode Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className={`p-3.5 sm:p-4 rounded-[4px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#1f1a14] border-[#c9a227] shadow-lg transform -translate-y-0.5'
                    : 'bg-[#181510] border-[#3a352c] hover:border-[#b9af9c] hover:bg-[#1d1913]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`p-1.5 rounded-[3px] ${isActive ? 'bg-[#c9a227]/20 text-[#c9a227]' : 'bg-[#221c15] text-[#8e8574]'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-['IBM_Plex_Mono',monospace] font-bold ${isActive ? 'text-[#c9a227]' : 'text-[#8e8574]'}`}>
                    {isActive ? 'ACTIVE' : 'INSPECT'}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] font-medium uppercase tracking-wider">
                    {mode.badge.split(':')[0]}
                  </div>
                  <div className={`text-[13px] sm:text-[14px] font-semibold leading-snug mt-0.5 ${isActive ? 'text-[#ede6d8]' : 'text-[#b9af9c]'}`}>
                    {mode.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3D Showcase Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column (7 cols): Full 3D Interactive WebGL Viewport */}
          <div className="lg:col-span-7 bg-[#16130e] border border-[#3a352c] rounded-[6px] shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* 3D Viewport Controls & Status Header */}
            <div className="px-4 py-3 bg-[#1b1712] border-b border-[#3a352c] flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
                <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold text-[#ede6d8]">
                  3D HARDWARE ACCELERATED VIEW
                </span>
                <span className="text-[#8e8574] hidden sm:inline">•</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] hidden sm:inline">
                  {activeModeConfig.badge}
                </span>
              </div>

              {/* Sample Selector */}
              <div className="flex items-center gap-1 p-0.5 bg-[#14120f] border border-[#3a352c] rounded-[3px]">
                {SAMPLE_ANALYSES.slice(0, 3).map((sa, idx) => (
                  <button
                    key={sa.id || idx}
                    onClick={() => setSelectedCaseIdx(idx)}
                    className={`px-2 py-0.5 rounded-[2px] text-[10.5px] font-['IBM_Plex_Mono',monospace] font-semibold transition-all cursor-pointer ${
                      selectedCaseIdx === idx
                        ? 'bg-[#b23a2e] text-[#ede6d8]'
                        : 'text-[#8e8574] hover:text-[#ede6d8]'
                    }`}
                  >
                    {idx === 0 ? 'PayPal' : idx === 1 ? 'BEC' : 'GitHub'}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Canvas Area */}
            <div className="relative w-full h-[380px] sm:h-[430px] bg-[radial-gradient(ellipse_at_center,rgba(40,32,24,0.5)_0%,rgba(20,18,15,1)_85%)] overflow-hidden">
              <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

              {/* Rotation Helper */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#14120f]/80 backdrop-blur-md border border-[#3a352c] text-[10px] font-['IBM_Plex_Mono',monospace] text-[#b9af9c] pointer-events-none">
                <RotateCw className="w-3 h-3 text-[#c9a227]" />
                <span>Drag to orbit • Scroll to zoom</span>
              </div>

              {/* Live Metric Badge Over Canvas */}
              <div className="absolute bottom-3 left-3 p-3 rounded-[4px] bg-[#14120f]/90 backdrop-blur-md border border-[#3a352c] shadow-lg pointer-events-none">
                <div className="text-[9.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] uppercase font-bold tracking-wider">
                  {activeModeConfig.metricLabel}
                </div>
                <div className="text-[18px] sm:text-[20px] font-['Fraunces',serif] font-bold text-[#c9a227] leading-none mt-0.5">
                  {activeModeConfig.metric}
                </div>
              </div>
            </div>

            {/* Viewport Footer Bar */}
            <div className="px-4 py-2.5 bg-[#181510] border-t border-[#3a352c] flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">
              <span>Active Target: {currentCase.name}</span>
              <span className="text-[#ede6d8]">Threat Score: {currentCase.riskScore}/100</span>
            </div>
          </div>

          {/* Right Column (5 cols): Deep Forensic Telemetry & Evidence Breakdown */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 bg-[#181510] border border-[#3a352c] rounded-[6px] p-5 sm:p-6 shadow-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#221c15] border border-[#3d2f1f] text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#c9a227] font-semibold mb-3">
                <span>{activeModeConfig.badge}</span>
              </div>

              <h3 className="font-['Fraunces',serif] text-[22px] sm:text-[24px] font-semibold text-[#ede6d8] leading-tight">
                {activeModeConfig.title}
              </h3>

              <p className="mt-3 text-[14px] text-[#b9af9c] leading-relaxed">
                {activeModeConfig.description}
              </p>

              {/* Live Technical Details Card */}
              <div className="mt-4 p-3.5 rounded-[4px] bg-[#13110d] border border-[#2e271f] font-['IBM_Plex_Mono',monospace] text-[11.5px] space-y-2">
                <div className="flex items-center justify-between border-b border-[#2e271f] pb-2">
                  <span className="text-[#8e8574]">RFC 5322 Subject:</span>
                  <span className="text-[#ede6d8] font-medium truncate max-w-[200px]">{currentCase.headers.subject}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2e271f] pb-2">
                  <span className="text-[#8e8574]">Origin IP / Country:</span>
                  <span className="text-[#ede6d8]">{currentCase.hops?.[0]?.fromIp || '185.220.101.5'} ({currentCase.hops?.[0]?.country || 'Bulgaria'})</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2e271f] pb-2">
                  <span className="text-[#8e8574]">Auth Results:</span>
                  <span className={isMalicious ? 'text-[#ff8d7d] font-bold' : 'text-[#86efac] font-bold'}>
                    SPF:{currentCase.auth?.spf?.status || 'fail'} • DKIM:{currentCase.auth?.dkim?.status || 'none'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8e8574]">SHA-256 Custody Hash:</span>
                  <span className="text-[#c9a227] text-[10.5px] truncate max-w-[180px]">
                    {currentCase.sha256Hash || '8f434346648f6b96...'}
                  </span>
                </div>
              </div>

              {/* SOC Defense Impact Points */}
              <div className="mt-4 space-y-2">
                <div className="flex items-start gap-2 text-[12.5px] text-[#d3cbbe]">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                  <span>Unmasks real sender sockets regardless of forged friendly display names.</span>
                </div>
                <div className="flex items-start gap-2 text-[12.5px] text-[#d3cbbe]">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                  <span>Verifies mathematical RSA private keys in public DNS records.</span>
                </div>
                <div className="flex items-start gap-2 text-[12.5px] text-[#d3cbbe]">
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0 mt-0.5" />
                  <span>Produces tamper-proof evidence packages admissible in security audits.</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#2e271f] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleLaunchFullAnalysis}
                className="flex-1 bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-2.5 px-4 rounded-[3px] font-semibold text-[13.5px] border border-[#b23a2e] transition-all cursor-pointer flex items-center justify-center gap-2 group shadow-md"
              >
                <span>Analyze this Attack in Console</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
