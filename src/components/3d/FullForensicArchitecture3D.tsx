import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Globe2, 
  Lock, 
  FileCode, 
  Fingerprint, 
  CheckCircle2, 
  ArrowRight, 
  RotateCw,
  Sparkles,
  ShieldAlert,
  Server,
  KeyRound,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { SAMPLE_ANALYSES, EMPTY_ANALYSIS } from '../../data/samples';
import { EmailAnalysis } from '../../types';

interface Full3DArchitectureProps {
  onOpenConsole: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

interface TargetScenario {
  id: string;
  name: string;
  subject: string;
  targetFullName: string;
  originIp: string;
  originCountry: string;
  authStatus: string;
  sha256: string;
  distance: string;
  threatScore: number;
  originCoords: [number, number]; // lat, lon
  destCoords: [number, number];
  sampleIndex: number;
  stageMetrics: {
    label: string;
    value: string;
    subtext: string;
  }[];
}

const TARGET_SCENARIOS: TargetScenario[] = [
  {
    id: 'paypal',
    name: 'PayPal',
    targetFullName: 'Nazario Phish: PayPal Urgent Restriction',
    subject: '[URGENT] Your PayPal Account Has Been Suspended - Update Payment',
    originIp: '185.220.101.5',
    originCountry: 'Bulgaria',
    authStatus: 'SPF:FAIL • DKIM:FAIL',
    sha256: '8f434346648f6b963d7788102a0a256f0857997935cf1f31f90ab94b46c59b6c',
    distance: '3,840 km',
    threatScore: 98,
    originCoords: [42.6977, 23.3219], // Sofia, BG
    destCoords: [37.7749, -122.4194], // SF, US
    sampleIndex: 0,
    stageMetrics: [
      {
        label: 'PHYSICAL TRANSIT DISTANCE',
        value: '3,840 km',
        subtext: 'BGP origin routing through Sofia Tor exit relay'
      },
      {
        label: 'DKIM RSA KEY ALIGNMENT',
        value: '0 / 2048-bit',
        subtext: 'Unsigned forged header; zero cryptographic match'
      },
      {
        label: 'PAYLOAD SHANNON ENTROPY',
        value: '7.89 / 8.00',
        subtext: 'Packed obfuscated credential harvester HTML'
      },
      {
        label: 'EVIDENCE INTEGRITY SEAL',
        value: 'SHA-256 LOCKED',
        subtext: 'NIST SP 800-86 tamper-proof chain of custody'
      }
    ]
  },
  {
    id: 'bec',
    name: 'BEC',
    targetFullName: 'CEO Impersonation: Wire Transfer Acquisition #DD-901',
    subject: 'Urgent: Updated Direct Deposit Routing Form Ref #DD-901',
    originIp: '194.26.29.114',
    originCountry: 'Moldova',
    authStatus: 'SPF:SOFTFAIL • DKIM:UNALIGNED',
    sha256: 'a3994c92170be1e5e8e89ef2e0c1f6c4493393b4a2bfdbbe598dfa279090b39f',
    distance: '6,120 km',
    threatScore: 94,
    originCoords: [47.0105, 28.8638], // Chisinau, MD
    destCoords: [40.7128, -74.0060], // NY, US
    sampleIndex: 1,
    stageMetrics: [
      {
        label: 'PHYSICAL TRANSIT DISTANCE',
        value: '6,120 km',
        subtext: 'Bulletproof hosting AS57523 AlexHost offshore relay'
      },
      {
        label: 'DMARC ENFORCEMENT STATE',
        value: 'p=reject FAIL',
        subtext: 'Display name mismatch against corporate domain'
      },
      {
        label: 'ATTACHMENT HEURISTICS',
        value: 'DISGUISED .EXE',
        subtext: 'Double extension binary masking AsyncRAT payload'
      },
      {
        label: 'EVIDENCE INTEGRITY SEAL',
        value: 'SHA-256 LOCKED',
        subtext: 'NIST SP 800-86 tamper-proof chain of custody'
      }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    targetFullName: 'GitHub Security Alert: Personal Access Token Compromised',
    subject: '[Security Alert] An untrusted SSH key was added to your organization',
    originIp: '140.82.121.4',
    originCountry: 'United States',
    authStatus: 'SPF:PASS • DKIM:PASS',
    sha256: 'c88a446714bf34a2e5db194a28f74819d9b4c4892c99a80e1548e3cf3cfba893',
    distance: '820 km',
    threatScore: 12,
    originCoords: [37.7749, -122.4194], // SF, US
    destCoords: [47.6062, -122.3321], // Seattle, US
    sampleIndex: 2,
    stageMetrics: [
      {
        label: 'PHYSICAL TRANSIT DISTANCE',
        value: '820 km',
        subtext: 'Direct low-latency hop between verified GitHub MTAs'
      },
      {
        label: 'DKIM RSA KEY ALIGNMENT',
        value: '2048-bit PASS',
        subtext: 'Cryptographic signature fully validated via DNS'
      },
      {
        label: 'MIME STRUCTURAL SANITY',
        value: '0 MALICIOUS',
        subtext: 'Clean multipart/alternative plain & HTML body'
      },
      {
        label: 'EVIDENCE INTEGRITY SEAL',
        value: 'SHA-256 VERIFIED',
        subtext: 'Genuine vendor communication certified'
      }
    ]
  }
];

export const FullForensicArchitecture3D: React.FC<Full3DArchitectureProps> = ({
  onOpenConsole,
  onSelectCase
}) => {
  const [activeStage, setActiveStage] = useState<number>(0); // 0 to 3
  const [activeTargetId, setActiveTargetId] = useState<string>('paypal');
  const mountRef = useRef<HTMLDivElement>(null);

  const currentTarget = TARGET_SCENARIOS.find(t => t.id === activeTargetId) || TARGET_SCENARIOS[0];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 560;
    let height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Dynamic Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xb23a2e, 3, 10);
    pointLight.position.set(-2, 1, 3);
    scene.add(pointLight);

    // Root Group for 3D Scene
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Build 3D Visualization based on activeStage:
    // Stage 0: 3D Spherical BGP Transit & Geolocation Tracker (Matching Image 2)
    // Stage 1: 3D Cryptographic Auth Reactor
    // Stage 2: 3D MIME Payload Sandbox
    // Stage 3: 3D Evidence Custody Vault

    let animCallback: (time: number) => void = () => {};

    if (activeStage === 0) {
      // 1. Globe Wireframe Sphere
      const sphereRadius = 1.45;
      const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x181410,
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85
      });
      const globeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      rootGroup.add(globeMesh);

      // Wireframe overlay
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x3a3225,
        wireframe: true,
        transparent: true,
        opacity: 0.55
      });
      const wireSphere = new THREE.Mesh(sphereGeo, wireMat);
      rootGroup.add(wireSphere);

      // Latitude/Longitude rings
      for (let i = -60; i <= 60; i += 30) {
        const rad = (i * Math.PI) / 180;
        const r = Math.cos(rad) * sphereRadius;
        const ringGeo = new THREE.RingGeometry(r - 0.005, r + 0.005, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x5a4d3a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = Math.sin(rad) * sphereRadius;
        rootGroup.add(ring);
      }

      // Convert Lat/Lon to 3D Cartesian coordinates on sphere
      const latLonToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        const x = -(radius * Math.sin(phi) * Math.cos(theta));
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        return new THREE.Vector3(x, y, z);
      };

      const originVec = latLonToVector3(currentTarget.originCoords[0], currentTarget.originCoords[1], sphereRadius);
      const destVec = latLonToVector3(currentTarget.destCoords[0], currentTarget.destCoords[1], sphereRadius);

      // Origin Marker (Green Glowing Sphere)
      const originGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const originMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const originMarker = new THREE.Mesh(originGeo, originMat);
      originMarker.position.copy(originVec);
      rootGroup.add(originMarker);

      // Destination Marker (Red/Amber with pulse ring)
      const destGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const destMat = new THREE.MeshBasicMaterial({ color: 0xb23a2e });
      const destMarker = new THREE.Mesh(destGeo, destMat);
      destMarker.position.copy(destVec);
      rootGroup.add(destMarker);

      // Dest Halo Ring
      const haloGeo = new THREE.RingGeometry(0.09, 0.12, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xc9a227,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const haloRing = new THREE.Mesh(haloGeo, haloMat);
      haloRing.position.copy(destVec).multiplyScalar(1.01);
      haloRing.lookAt(new THREE.Vector3(0, 0, 0));
      rootGroup.add(haloRing);

      // Parabolic Curved Trajectory Arc connecting origin to destination
      const midPoint = new THREE.Vector3().addVectors(originVec, destVec).multiplyScalar(0.5);
      const distance = originVec.distanceTo(destVec);
      midPoint.normalize().multiplyScalar(sphereRadius + Math.max(0.4, distance * 0.35));

      const curve = new THREE.QuadraticBezierCurve3(originVec, midPoint, destVec);
      const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.024, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xb23a2e,
        transparent: true,
        opacity: 0.95
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      rootGroup.add(tubeMesh);

      // Glowing pulse particle traveling along the curve
      const pulseGeo = new THREE.SphereGeometry(0.05, 16, 16);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      rootGroup.add(pulseMesh);

      animCallback = (time: number) => {
        const t = (time * 0.5) % 1;
        const pt = curve.getPoint(t);
        pulseMesh.position.copy(pt);
      };

    } else if (activeStage === 1) {
      // STAGE 2: Cryptographic Auth Reactor
      const ringGeo1 = new THREE.TorusGeometry(1.2, 0.04, 16, 100);
      const ringMat1 = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.2 });
      const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      rootGroup.add(ring1);

      const ringGeo2 = new THREE.TorusGeometry(0.85, 0.035, 16, 80);
      const ringMat2 = new THREE.MeshStandardMaterial({ color: 0xb23a2e, metalness: 0.9, roughness: 0.1 });
      const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      rootGroup.add(ring2);

      const coreGeo = new THREE.OctahedronGeometry(0.45, 1);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, roughness: 0.3, metalness: 0.9 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      rootGroup.add(core);

      animCallback = (time: number) => {
        ring1.rotation.x = time * 0.4;
        ring1.rotation.y = time * 0.6;
        ring2.rotation.y = -time * 0.8;
        ring2.rotation.z = time * 0.3;
        core.rotation.y = time * 1.2;
      };

    } else if (activeStage === 2) {
      // STAGE 3: MIME Payload Sandbox
      const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      rootGroup.add(box);

      // Floating payload tokens inside
      const tokens: THREE.Mesh[] = [];
      for (let i = 0; i < 12; i++) {
        const tokGeo = new THREE.TetrahedronGeometry(0.12, 0);
        const tokMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xb23a2e : 0x22c55e });
        const tok = new THREE.Mesh(tokGeo, tokMat);
        tok.position.set((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2);
        rootGroup.add(tok);
        tokens.push(tok);
      }

      animCallback = (time: number) => {
        box.rotation.y = time * 0.3;
        box.rotation.x = time * 0.2;
        tokens.forEach((t, i) => {
          t.rotation.y += 0.02 * (i + 1);
          t.position.y += Math.sin(time * 2 + i) * 0.003;
        });
      };

    } else {
      // STAGE 4: Evidence Custody Vault (SHA-256 Seal)
      const cylGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 32);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        metalness: 0.8,
        roughness: 0.2,
        transparent: true,
        opacity: 0.4
      });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      rootGroup.add(cyl);

      const wireCyl = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true }));
      rootGroup.add(wireCyl);

      const discGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.1, 32);
      const discMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.1 });
      const topDisc = new THREE.Mesh(discGeo, discMat);
      topDisc.position.y = 0.85;
      rootGroup.add(topDisc);

      const botDisc = topDisc.clone();
      botDisc.position.y = -0.85;
      rootGroup.add(botDisc);

      animCallback = (time: number) => {
        cyl.rotation.y = time * 0.5;
        wireCyl.rotation.y = time * 0.5;
      };
    }

    // Mouse drag interaction
    let isMouseDown = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = 0.65;
    let rotX = 0.22;

    const onPointerDown = (e: PointerEvent) => {
      isMouseDown = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isMouseDown) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        rotY += dx * 0.008;
        rotX += dy * 0.008;
        prevX = e.clientX;
        prevY = e.clientY;
      }
    };

    const onPointerUp = () => {
      isMouseDown = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 560;
      height = container.clientHeight || 420;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      if (!isMouseDown) {
        rotY += 0.003;
      }

      rootGroup.rotation.y = rotY;
      rootGroup.rotation.x = rotX;

      animCallback(time);

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
    };
  }, [activeStage, activeTargetId]);

  const handleLaunchTarget = () => {
    const sample = SAMPLE_ANALYSES[currentTarget.sampleIndex] || SAMPLE_ANALYSES[0] || EMPTY_ANALYSIS;
    if (onSelectCase) {
      onSelectCase(sample);
    }
    onOpenConsole();
  };

  // Stage content definition
  const STAGES_META = [
    {
      num: 'STAGE 1',
      title: 'Global Hop Trajectory',
      headerTag: 'STAGE 1: SOCKET & ASN TRACE',
      h2: '3D Spherical BGP Transit & Geolocation Tracker',
      desc: 'Track the physical transit route of an email across planetary networks. TraceXMail maps the original socket IP, isolates intermediate MTAs, and unmasks Tor exit relays and bulletproof hosting autonomous systems (ASNs).',
      icon: Globe2,
      points: [
        'Unmasks real sender sockets regardless of forged friendly display names.',
        'Verifies mathematical RSA private keys in public DNS records.',
        'Produces tamper-proof evidence packages admissible in security audits.'
      ]
    },
    {
      num: 'STAGE 2',
      title: 'Cryptographic Auth Reactor',
      headerTag: 'STAGE 2: CRYPTOGRAPHIC AUTH REACTOR',
      h2: 'Live SPF, DKIM RSA-2048 & DMARC Alignment Matrix',
      desc: 'Test whether the real domain owner signed the email with official 2048-bit cryptographic private keys, isolating spoofed headers from verified organizational certificates.',
      icon: Lock,
      points: [
        'Evaluates SPF return-path against live authoritative DNS records.',
        'Validates RSA/Ed25519 body signature hashes without trust assumptions.',
        'Enforces strict DMARC rejection policies on lookalike sender domains.'
      ]
    },
    {
      num: 'STAGE 3',
      title: 'MIME Payload Sandbox',
      headerTag: 'STAGE 3: MIME PAYLOAD SANDBOX',
      h2: 'Shannon Entropy & Homoglyph Deconstruction',
      desc: 'Safely disassemble multi-part MIME boundaries in an isolated sandbox, exposing obfuscated scripts, double extensions (.pdf.exe), and deceptive unicode homoglyphs.',
      icon: FileCode,
      points: [
        'Calculates mathematical entropy to detect packed malicious payloads.',
        'Inspects magic bytes to identify disguised executables.',
        'Extracts zero-pixel tracking beacons and hidden redirect chains.'
      ]
    },
    {
      num: 'STAGE 4',
      title: 'Evidence Custody Vault',
      headerTag: 'STAGE 4: EVIDENCE CUSTODY VAULT',
      h2: 'NIST SP 800-86 Immutable SHA-256 Custody Seal',
      desc: 'Lock the entire forensic investigation into an immutable cryptographic dossier that satisfies legal chain-of-custody requirements for regulators, auditors, and law enforcement.',
      icon: Fingerprint,
      points: [
        'Generates court-admissible SHA-256 evidence digests.',
        'Preserves raw RFC 5322 header timelines with atomic timestamps.',
        'Provides unalterable audit trails for incident response teams.'
      ]
    }
  ];

  const currentStageMeta = STAGES_META[activeStage];

  return (
    <section id="full-architecture-3d" className="py-12 sm:py-20 border-b border-[#3a352c] bg-[#12100d] overflow-hidden">
      <div className="w-full mx-auto px-3.5 sm:px-6 lg:px-8">
        
        {/* Top 4 Stage Selector Tabs - Matching Image 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 mb-5 sm:mb-6">
          {STAGES_META.map((stage, idx) => {
            const isActive = activeStage === idx;
            const IconComponent = stage.icon;
            return (
              <button
                key={idx}
                onClick={() => setActiveStage(idx)}
                className={`p-3 sm:p-4 rounded-[4px] text-left transition-all cursor-pointer relative ${
                  isActive
                    ? 'bg-[#1a1712] border border-[#c9a227] ring-1 ring-[#c9a227]/40 shadow-xl'
                    : 'bg-[#15130f] border border-[#3a352c] hover:border-[#8e8574] hover:bg-[#1a1712]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-[3px] bg-[#221e17] flex items-center justify-center border border-[#3a352c]">
                    <IconComponent className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${isActive ? 'text-[#c9a227]' : 'text-[#8e8574]'}`} />
                  </div>
                  <span className={`font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${
                    isActive ? 'text-[#c9a227]' : 'text-[#8e8574]'
                  }`}>
                    {isActive ? 'ACTIVE' : 'INSPECT'}
                  </span>
                </div>
                <div className="font-mono text-[10px] sm:text-[11px] text-[#8e8574] uppercase tracking-wider mb-0.5">
                  {stage.num}
                </div>
                <div className="font-semibold text-[13px] sm:text-[15px] text-[#ede6d8] leading-tight line-clamp-1 sm:line-clamp-none">
                  {stage.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main 3D Hardware Accelerated Split View - Matching Image 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          
          {/* Left: 3D Hardware Accelerated Viewport */}
          <div className="lg:col-span-7 bg-[#0b0a08] border border-[#3a352c] rounded-[6px] relative min-h-[380px] xs:min-h-[420px] sm:min-h-[480px] flex flex-col justify-between overflow-hidden shadow-2xl">
            
            {/* Top Bar with Green Dot and Target Pills */}
            <div className="p-2.5 sm:p-3 bg-[#12100d]/95 border-b border-[#3a352c] flex flex-wrap items-center justify-between gap-2 z-10">
              <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-[11px] font-bold text-[#ede6d8] tracking-wider uppercase truncate">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shrink-0" />
                <span className="truncate">3D VIEW • {currentStageMeta.headerTag}</span>
              </div>
              
              {/* Target Scenario Switcher Pills */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {TARGET_SCENARIOS.map((t) => {
                  const isSelected = activeTargetId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTargetId(t.id)}
                      className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-[3px] text-[11px] sm:text-xs font-mono font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#b23a2e] text-[#ede6d8] font-bold shadow-md'
                          : 'bg-[#1a1712] text-[#8e8574] hover:text-[#ede6d8] border border-[#3a352c]'
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Orbit Hint Overlay */}
            <div className="absolute top-12 sm:top-14 right-2 sm:right-4 z-10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-[3px] bg-[#14120f]/85 border border-[#3a352c] text-[9.5px] sm:text-[10.5px] font-mono text-[#b9af9c] flex items-center gap-1.5 backdrop-blur-sm pointer-events-none">
              <RotateCw className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#c9a227]" />
              <span>Drag to orbit</span>
            </div>

            {/* 3D Three.js Interactive Canvas Mount */}
            <div
              ref={mountRef}
              className="w-full flex-1 min-h-[280px] xs:min-h-[320px] sm:min-h-[360px] cursor-grab active:cursor-grabbing relative"
              title="Click and drag to orbit 3D view"
            />

            {/* Dynamic Stage Forensic Telemetry Metric Overlay (Bottom-Left) */}
            <div className="absolute bottom-12 sm:bottom-14 left-2.5 sm:left-4 z-10 p-2.5 sm:p-3 rounded-[4px] bg-[#14120f]/90 border border-[#3a352c] backdrop-blur-md shadow-xl max-w-[210px] xs:max-w-[250px] sm:max-w-[280px]">
              <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono uppercase text-[#c9a227] tracking-wider font-semibold truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c9a227] animate-ping shrink-0" />
                <span className="truncate">{currentTarget.stageMetrics[activeStage]?.label || 'STAGE METRIC'}</span>
              </div>
              <div className="font-['Fraunces',serif] text-[18px] sm:text-[24px] font-bold text-[#ede6d8] leading-none mt-1 truncate">
                {currentTarget.stageMetrics[activeStage]?.value || currentTarget.distance}
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono text-[#b9af9c] mt-1 sm:mt-1.5 leading-snug border-t border-[#3a352c]/60 pt-1 sm:pt-1.5 line-clamp-2">
                {currentTarget.stageMetrics[activeStage]?.subtext}
              </div>
            </div>

            {/* Bottom Footer Bar */}
            <div className="p-2.5 sm:p-3 bg-[#12100d]/95 border-t border-[#3a352c] flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 text-[11px] sm:text-xs font-mono z-10">
              <div className="text-[#8e8574] truncate max-w-full xs:max-w-[280px] sm:max-w-[340px]">
                Active Target: <span className="text-[#ede6d8]">{currentTarget.targetFullName}</span>
              </div>
              <div className="font-bold shrink-0">
                <span className="text-[#8e8574]">Threat Score: </span>
                <span className={currentTarget.threatScore >= 60 ? 'text-[#ff8d7d]' : 'text-[#22c55e]'}>
                  {currentTarget.threatScore}/100
                </span>
              </div>
            </div>

          </div>

          {/* Right: Forensic Spec & Direct Analysis Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#15130f] border border-[#3a352c] rounded-[6px] p-4 sm:p-6 shadow-xl">
            <div className="space-y-3.5 sm:space-y-4">
              
              {/* Header Badge & Title */}
              <div>
                <div className="inline-block px-2 py-0.5 rounded-[2px] bg-[#221e17] border border-[#3a352c] font-mono text-[9.5px] sm:text-[10.5px] uppercase font-bold text-[#c9a227] mb-2">
                  {currentStageMeta.headerTag}
                </div>
                <h2 className="font-['Fraunces',serif] text-[20px] sm:text-[24px] lg:text-[26px] font-semibold text-[#ede6d8] leading-tight">
                  {currentStageMeta.h2}
                </h2>
                <p className="text-[#b9af9c] mt-2 text-[13px] sm:text-[14px] leading-relaxed">
                  {currentStageMeta.desc}
                </p>
              </div>

              {/* Data Table Spec Box - Matching Image 2 */}
              <div className="bg-[#100e0c] border border-[#3a352c] rounded-[4px] p-3 sm:p-3.5 space-y-2 font-mono text-[11px] sm:text-xs">
                <div className="flex flex-col xs:flex-row xs:items-start justify-between gap-1 border-b border-[#3a352c]/50 pb-1.5 sm:pb-2">
                  <span className="text-[#8e8574] shrink-0">RFC 5322 Subject:</span>
                  <span className="text-[#ede6d8] font-medium truncate text-left xs:text-right">{currentTarget.subject}</span>
                </div>
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 border-b border-[#3a352c]/50 pb-1.5 sm:pb-2">
                  <span className="text-[#8e8574]">Origin IP / Country:</span>
                  <span className="text-[#ede6d8] font-medium">{currentTarget.originIp} ({currentTarget.originCountry})</span>
                </div>
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 border-b border-[#3a352c]/50 pb-1.5 sm:pb-2">
                  <span className="text-[#8e8574]">Auth Results:</span>
                  <span className="text-[#ff8d7d] font-bold">{currentTarget.authStatus}</span>
                </div>
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <span className="text-[#8e8574] shrink-0">SHA-256 Custody Hash:</span>
                  <span className="text-[#c9a227] truncate max-w-full xs:max-w-[160px] sm:max-w-[200px]">{currentTarget.sha256}</span>
                </div>
              </div>

              {/* Green Checkmark Key Findings */}
              <div className="space-y-1.5 sm:space-y-2 pt-0.5">
                {currentStageMeta.points.map((pt, pIdx) => (
                  <div key={pIdx} className="flex items-start gap-2 text-[12.5px] sm:text-[13.5px] text-[#ede6d8] leading-snug">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#22c55e] shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom Red CTA Button - Matching Image 2 */}
            <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#3a352c]">
              <button
                onClick={handleLaunchTarget}
                className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-2.5 sm:py-3 px-4 rounded-[4px] font-semibold text-[13.5px] sm:text-[14.5px] border border-[#b23a2e] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg group"
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
