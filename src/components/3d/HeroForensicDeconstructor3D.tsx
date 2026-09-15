import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  RotateCcw,
  Maximize2,
  FileCode,
  Globe,
  Fingerprint,
  Eye
} from 'lucide-react';
import { SAMPLE_ANALYSES } from '../../data/samples';
import { EmailAnalysis } from '../../types';

interface HeroForensicDeconstructor3DProps {
  onExploreCase?: (sampleIndex: number) => void;
  onOpenConsole?: () => void;
  className?: string;
}

interface ForensicLayerInfo {
  id: string;
  name: string;
  badge: string;
  summary: string;
  details: string[];
  status: 'FAIL' | 'WARN' | 'PASS';
  icon: string;
}

interface AttackCasePreset {
  id: string;
  title: string;
  score: number;
  verdict: 'MALICIOUS' | 'CLEAN';
  colorHex: number;
  sender: string;
  originIp: string;
  originGeo: string;
  asn: string;
  sampleIndex: number;
  layers: ForensicLayerInfo[];
}

const ATTACK_CASES: AttackCasePreset[] = [
  {
    id: 'case-paypal',
    title: 'PayPal Tor Phish',
    score: 98,
    verdict: 'MALICIOUS' as const,
    colorHex: 0xb23a2e,
    sender: 'security@paypal.com (Spoofed)',
    originIp: '185.220.101.5',
    originGeo: 'Sofia, Bulgaria (Tor Exit)',
    asn: 'AS200548 ZettaHost',
    sampleIndex: 0,
    layers: [
      {
        id: 'layer-env',
        name: 'RFC 5322 Envelope',
        badge: 'HEADER FORGERY DETECTED',
        summary: 'Display name spoofing PayPal Security. Real sender envelope Return-Path is unaligned.',
        details: ['From: "PayPal Security" <security@paypal.com>', 'Socket IP: 185.220.101.5', 'Reverse DNS: tor-exit-node.bg'],
        status: 'FAIL' as const,
        icon: 'Mail'
      },
      {
        id: 'layer-crypto',
        name: 'Cryptographic Gate',
        badge: 'AUTH BREAKAGE',
        summary: 'SPF softfail and DKIM RSA key validation failure. Strict DMARC enforcement rejects delivery.',
        details: ['SPF: softfail (IP not in SPF DNS)', 'DKIM: none (Signature missing)', 'DMARC: reject (Action required)'],
        status: 'FAIL' as const,
        icon: 'Fingerprint'
      },
      {
        id: 'layer-hops',
        name: 'MTA Route Trajectory',
        badge: 'TOR ANONYMIZATION',
        summary: 'Originates from an anonymizing Tor relay in Bulgaria with 3 intermediate hops.',
        details: ['Hop 1: 185.220.101.5 (Bulgaria)', 'Hop 2: 194.26.29.112 (Germany)', 'Latency Delta: 2.4s anomaly'],
        status: 'FAIL' as const,
        icon: 'Globe'
      },
      {
        id: 'layer-mime',
        name: 'Payload & Attachment',
        badge: 'CREDENTIAL HARVESTER',
        summary: 'Contains obfuscated redirect link to typosquatted domain paypal-secure-update.com.',
        details: ['Typosquat: paypal-secure-update.com', 'Entropy: 7.94 bits (High)', 'Obfuscation: Base64 hidden JS'],
        status: 'FAIL' as const,
        icon: 'FileCode'
      },
      {
        id: 'layer-vault',
        name: 'Evidence Custody Chain',
        badge: 'COURT-READY AUDIT',
        summary: 'Immutable evidentiary SHA-256 fingerprint generated and verified against tamper detection.',
        details: ['SHA-256: 8f43...aa4', 'RFC822 Bytes: 4,821 B', 'SOC Confidence: 99.4%'],
        status: 'PASS' as const,
        icon: 'Lock'
      }
    ]
  },
  {
    id: 'case-bec',
    title: 'Executive BEC Wire',
    score: 95,
    verdict: 'MALICIOUS' as const,
    colorHex: 0xd97706,
    sender: 'ceo@enterprise.com (Spoofed)',
    originIp: '194.26.29.112',
    originGeo: 'Chisinau, Moldova',
    asn: 'AS57523 AlexHost',
    sampleIndex: 1,
    layers: [
      {
        id: 'layer-env',
        name: 'RFC 5322 Envelope',
        badge: 'VIP IMPERSONATION',
        summary: 'Forged CEO header demanding urgent wire transfer with off-domain Reply-To routing.',
        details: ['From: ceo@enterprise.com', 'Reply-To: wire-exec@offshore.md', 'Urgency NLP: 98%'],
        status: 'FAIL' as const,
        icon: 'Mail'
      },
      {
        id: 'layer-crypto',
        name: 'Cryptographic Gate',
        badge: 'DKIM FORGERY',
        summary: 'Unsigned body hash mismatch. Sender server lacks delegation authorization.',
        details: ['SPF: neutral', 'DKIM: fail (RSA body hash mismatch)', 'DMARC: quarantine'],
        status: 'FAIL' as const,
        icon: 'Fingerprint'
      },
      {
        id: 'layer-hops',
        name: 'MTA Route Trajectory',
        badge: 'BULLETPROOF HOSTING',
        summary: 'Direct injection from offshore bulletproof VPS ASN with history of non-cooperation.',
        details: ['Hop 1: 194.26.29.112 (AlexHost Moldova)', 'MTA: Exim 4.94 exploit probe', 'Route: Direct relay bypass'],
        status: 'FAIL' as const,
        icon: 'Globe'
      },
      {
        id: 'layer-mime',
        name: 'Payload & Attachment',
        badge: 'ASYNCRAT TROJAN',
        summary: 'Hidden executable disguised with double extension Invoice_48200.pdf.exe.',
        details: ['File: Invoice_48200.pdf.exe', 'Magic Bytes: MZ (PE32 Executable)', 'Threat Family: AsyncRAT Dropper'],
        status: 'FAIL' as const,
        icon: 'FileCode'
      },
      {
        id: 'layer-vault',
        name: 'Evidence Custody Chain',
        badge: 'CHAIN OF CUSTODY',
        summary: 'Attestation generated for banking fraud law enforcement submission.',
        details: ['SHA-256: 4e91...bf2', 'Threat Actor: TA-505 cluster', 'Verdict: CRITICAL_FRAUD'],
        status: 'PASS' as const,
        icon: 'Lock'
      }
    ]
  },
  {
    id: 'case-github',
    title: 'Authentic GitHub Notification',
    score: 4,
    verdict: 'CLEAN' as const,
    colorHex: 0x22c55e,
    sender: 'notifications@github.com',
    originIp: '192.30.252.204',
    originGeo: 'Seattle, WA, United States',
    asn: 'AS36459 GitHub Inc',
    sampleIndex: 2,
    layers: [
      {
        id: 'layer-env',
        name: 'RFC 5322 Envelope',
        badge: 'VERIFIED TRANSMISSION',
        summary: 'Official GitHub CIDR infrastructure transmission with matched envelope alignments.',
        details: ['From: notifications@github.com', 'Socket IP: 192.30.252.204', 'PTR: smtp.github.com'],
        status: 'PASS' as const,
        icon: 'Mail'
      },
      {
        id: 'layer-crypto',
        name: 'Cryptographic Gate',
        badge: '2048-BIT RSA PASS',
        summary: 'Strict cryptographic pass. 2048-bit RSA DKIM signature verified with public DNS key.',
        details: ['SPF: pass (GitHub netblock)', 'DKIM: pass (rsa-sha256)', 'DMARC: pass (strict align)'],
        status: 'PASS' as const,
        icon: 'Fingerprint'
      },
      {
        id: 'layer-hops',
        name: 'MTA Route Trajectory',
        badge: 'ENTERPRISE ROUTING',
        summary: 'Standard two-hop route with verified TLS 1.3 encryption across all MTAs.',
        details: ['Hop 1: Seattle US (GitHub)', 'Hop 2: San Jose Target MX', 'Encryption: TLS 1.3 AES-GCM'],
        status: 'PASS' as const,
        icon: 'Globe'
      },
      {
        id: 'layer-mime',
        name: 'Payload & Attachment',
        badge: 'SANITIZED CONTENT',
        summary: 'Zero malicious indicators. Direct links point strictly to authentic github.com endpoints.',
        details: ['Links: https://github.com/*', 'Entropy: Normal text (4.1)', 'Payload: None'],
        status: 'PASS' as const,
        icon: 'FileCode'
      },
      {
        id: 'layer-vault',
        name: 'Evidence Custody Chain',
        badge: 'SAFE HARBOR PASS',
        summary: 'Certified clean notification with zero quarantine flags or heuristic alerts.',
        details: ['SHA-256: d182...c77', 'Threat Score: 04/100', 'Status: CLEARED_INBOX'],
        status: 'PASS' as const,
        icon: 'Lock'
      }
    ]
  }
];

export const HeroForensicDeconstructor3D: React.FC<HeroForensicDeconstructor3DProps> = ({
  onExploreCase,
  onOpenConsole,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeCaseIndex, setActiveCaseIndex] = useState<number>(0);
  const [exploded, setExploded] = useState<boolean>(true);
  const [explosionDistance, setExplosionDistance] = useState<number>(1.25);
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.003);

  const activeCase = ATTACK_CASES[activeCaseIndex];
  const activeLayer = activeCase.layers[activeLayerIndex] || activeCase.layers[0];

  // Ref tracking for Three.js loop
  const stateRef = useRef({
    exploded: true,
    explosionDistance: 1.25,
    activeLayerIndex: 0,
    caseColorHex: activeCase.colorHex,
    isScanning: false,
    scanProgress: 0,
    activeCaseIndex: 0
  });

  useEffect(() => {
    stateRef.current.exploded = exploded;
    stateRef.current.explosionDistance = explosionDistance;
    stateRef.current.activeLayerIndex = activeLayerIndex;
    stateRef.current.caseColorHex = activeCase.colorHex;
    stateRef.current.isScanning = isScanning;
    stateRef.current.activeCaseIndex = activeCaseIndex;
  }, [exploded, explosionDistance, activeLayerIndex, activeCase, isScanning, activeCaseIndex]);

  // Main 3D WebGL Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 540;
    let height = container.clientHeight || 460;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0.8, 7.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffeedd, 2.2, 20);
    pointLight.position.set(3, 4, 5);
    scene.add(pointLight);

    const accentLight = new THREE.PointLight(activeCase.colorHex, 3.0, 15);
    accentLight.position.set(-3, -2, 3);
    scene.add(accentLight);

    // 3. Root Interactive Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 4. Create 5 3D Forensic Layers
    const layerPlates: {
      group: THREE.Group;
      mesh: THREE.Mesh;
      wireMesh: THREE.Mesh;
      ringMesh?: THREE.Mesh;
      baseY: number;
    }[] = [];

    const layerCount = 5;
    const plateWidth = 3.6;
    const plateDepth = 2.2;
    const plateHeight = 0.09;

    const plateGeo = new THREE.BoxGeometry(plateWidth, plateHeight, plateDepth);
    const wireGeo = new THREE.BoxGeometry(plateWidth + 0.04, plateHeight + 0.04, plateDepth + 0.04);

    for (let i = 0; i < layerCount; i++) {
      const layerGroup = new THREE.Group();
      const baseY = (2 - i) * 1.0; // Natural center: 0 is layer 2
      layerGroup.position.y = baseY;

      // Color logic: top layer matches verdict, middle layers have forensic tech colors
      let layerColor = activeCase.colorHex;
      if (i === 1) layerColor = 0xc9a227; // Crypto gold
      if (i === 2) layerColor = 0x38bdf8; // Route cyan
      if (i === 3) layerColor = 0xa855f7; // MIME purple
      if (i === 4) layerColor = 0x22c55e; // Custody green

      const plateMat = new THREE.MeshStandardMaterial({
        color: layerColor,
        roughness: 0.25,
        metalness: 0.35,
        transparent: true,
        opacity: 0.85
      });
      const plateMesh = new THREE.Mesh(plateGeo, plateMat);
      layerGroup.add(plateMesh);

      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xede6d8,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      layerGroup.add(wireMesh);

      // Layer 0: Envelope Flap & Seal
      if (i === 0) {
        const flapGeo = new THREE.ConeGeometry(1.2, 0.45, 4);
        const flapMat = new THREE.MeshStandardMaterial({
          color: activeCase.colorHex,
          roughness: 0.3,
          metalness: 0.4
        });
        const flapMesh = new THREE.Mesh(flapGeo, flapMat);
        flapMesh.rotation.x = Math.PI / 2;
        flapMesh.rotation.z = Math.PI / 4;
        flapMesh.position.set(0, 0.08, 0);
        layerGroup.add(flapMesh);

        // Hologram Forensic Seal
        const sealGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16);
        const sealMat = new THREE.MeshStandardMaterial({
          color: 0xc9a227,
          metalness: 0.9,
          roughness: 0.2,
          emissive: 0x8a6b18
        });
        const sealMesh = new THREE.Mesh(sealGeo, sealMat);
        sealMesh.position.set(0, 0.12, 0);
        layerGroup.add(sealMesh);
      }

      // Layer 1: Cryptographic Verification Orbit Ring
      if (i === 1) {
        const ringGeo = new THREE.TorusGeometry(1.4, 0.04, 12, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xc9a227,
          transparent: true,
          opacity: 0.7
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        layerGroup.add(ringMesh);
      }

      // Layer 2: Hop Route Nodes (Spheres representing origin & destination MTAs)
      if (i === 2) {
        const sphereGeo = new THREE.SphereGeometry(0.16, 16, 16);
        const hopMat1 = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const hopMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const hopMat3 = new THREE.MeshBasicMaterial({ color: 0x22c55e });

        const hop1 = new THREE.Mesh(sphereGeo, hopMat1);
        hop1.position.set(-1.2, 0.15, -0.4);
        const hop2 = new THREE.Mesh(sphereGeo, hopMat2);
        hop2.position.set(0, 0.15, 0.2);
        const hop3 = new THREE.Mesh(sphereGeo, hopMat3);
        hop3.position.set(1.2, 0.15, -0.3);

        layerGroup.add(hop1, hop2, hop3);

        // Arc connecting hops
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.2, 0.15, -0.4),
          new THREE.Vector3(-0.6, 0.5, -0.1),
          new THREE.Vector3(0, 0.15, 0.2),
          new THREE.Vector3(0.6, 0.5, -0.05),
          new THREE.Vector3(1.2, 0.15, -0.3)
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.03, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        layerGroup.add(tubeMesh);
      }

      // Layer 3: MIME Payload Malicious/Clean Indicators
      if (i === 3) {
        const boxGeo = new THREE.BoxGeometry(0.45, 0.2, 0.3);
        const boxMat = new THREE.MeshStandardMaterial({
          color: activeCase.verdict === 'MALICIOUS' ? 0xef4444 : 0x22c55e,
          metalness: 0.5,
          roughness: 0.3
        });
        const payloadBox = new THREE.Mesh(boxGeo, boxMat);
        payloadBox.position.set(0, 0.16, 0);
        layerGroup.add(payloadBox);
      }

      // Layer 4: Evidence Vault Base Plate & Hash Ring
      if (i === 4) {
        const hashRingGeo = new THREE.RingGeometry(0.8, 1.0, 32);
        const hashRingMat = new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.6
        });
        const hashRing = new THREE.Mesh(hashRingGeo, hashRingMat);
        hashRing.rotation.x = Math.PI / 2;
        hashRing.position.set(0, 0.08, 0);
        layerGroup.add(hashRing);
      }

      rootGroup.add(layerGroup);
      layerPlates.push({
        group: layerGroup,
        mesh: plateMesh,
        wireMesh,
        baseY
      });
    }

    // 5. Scanning Beam Plane
    const scanGeo = new THREE.PlaneGeometry(plateWidth * 1.15, plateDepth * 1.15);
    const scanMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const scanPlane = new THREE.Mesh(scanGeo, scanMat);
    scanPlane.rotation.x = Math.PI / 2;
    scanPlane.visible = false;
    rootGroup.add(scanPlane);

    // 6. Interactive Mouse Drag / Tilt Controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let targetRotY = 0.45;
    let targetRotX = 0.25;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      targetRotY += dx * 0.007;
      targetRotX += dy * 0.007;
      targetRotX = Math.max(-0.6, Math.min(0.8, targetRotX));
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 7. Responsive Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 540;
      height = container.clientHeight || 460;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // 8. Animation Render Loop
    let animId: number;
    let scanY = 2.5;
    let scanDir = -1;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth camera / root group rotation
      if (!isDragging) {
        targetRotY += rotationSpeed;
      }
      rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.08;
      rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.08;

      // Update layer explosion spacing
      const isExploded = stateRef.current.exploded;
      const dist = stateRef.current.explosionDistance;
      const activeIdx = stateRef.current.activeLayerIndex;

      layerPlates.forEach((layer, idx) => {
        const targetY = isExploded ? (2 - idx) * dist : (2 - idx) * 0.12;
        layer.group.position.y += (targetY - layer.group.position.y) * 0.12;

        // Highlight active layer
        const isSelected = idx === activeIdx;
        const mat = layer.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = isSelected ? 0.95 : 0.65;
        (layer.wireMesh.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.8 : 0.25;

        // Micro-levitation for selected layer
        if (isSelected && isExploded) {
          layer.mesh.scale.set(1.03, 1.05, 1.03);
        } else {
          layer.mesh.scale.set(1, 1, 1);
        }
      });

      // Scanning Laser Animation
      if (stateRef.current.isScanning) {
        scanPlane.visible = true;
        scanY += scanDir * 0.06;
        if (scanY < -2.5) {
          scanY = 2.5;
        }
        scanPlane.position.y = scanY;
        scanMat.color.setHex(stateRef.current.caseColorHex);
      } else {
        scanPlane.visible = false;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Cleanup
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
      plateGeo.dispose();
      wireGeo.dispose();
    };
  }, [activeCaseIndex, rotationSpeed]);

  // Handle Scan Beam Pulse
  const triggerScanPulse = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 2800);
  };

  const handleLaunchInConsole = () => {
    if (onExploreCase) {
      onExploreCase(activeCase.sampleIndex);
    } else if (onOpenConsole) {
      onOpenConsole();
    }
  };

  return (
    <div className={`w-full flex flex-col bg-[#16130e] border border-[#3a352c] rounded-[6px] shadow-2xl overflow-hidden ${className}`}>
      
      {/* 3D Visualizer Top Telemetry Bar */}
      <div className="px-4 py-3 bg-[#1c1813] border-b border-[#3a352c] flex flex-wrap items-center justify-between gap-2.5 text-xs font-['IBM_Plex_Mono',monospace]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
          <span className="font-bold text-[#ede6d8]">3D FORENSIC CORE</span>
          <span className="text-[#8e8574] hidden sm:inline">•</span>
          <span className="text-[#c9a227] hidden sm:inline">RFC 5322 PROTOCOL UNPACKER</span>
        </div>

        {/* Case Preset Selector */}
        <div className="flex items-center gap-1.5 p-0.5 bg-[#14120f] border border-[#3a352c] rounded-[4px]">
          {ATTACK_CASES.map((ac, idx) => (
            <button
              key={ac.id}
              onClick={() => {
                setActiveCaseIndex(idx);
                setActiveLayerIndex(0);
              }}
              className={`px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer ${
                activeCaseIndex === idx
                  ? ac.verdict === 'MALICIOUS'
                    ? 'bg-[#b23a2e] text-[#ede6d8] shadow-sm'
                    : 'bg-[#22c55e] text-[#14120f] font-bold shadow-sm'
                  : 'text-[#b9af9c] hover:text-[#ede6d8]'
              }`}
            >
              {ac.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Canvas + Interactive Layer Dissector */}
      <div className="relative w-full h-[360px] sm:h-[420px] lg:h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(40,32,24,0.6)_0%,rgba(20,18,15,1)_85%)] overflow-hidden">
        
        {/* Three.js Container */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Forensic HUD Overlay: Selected Layer Details Card */}
        <div className="absolute top-3 left-3 max-w-[280px] sm:max-w-[320px] bg-[#14120f]/90 backdrop-blur-md border border-[#3a352c] rounded-[4px] p-3 shadow-xl pointer-events-auto">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-['IBM_Plex_Mono',monospace] text-[10px] uppercase font-bold text-[#c9a227] tracking-wider">
              Layer {activeLayerIndex + 1}/5: {activeLayer.name}
            </span>
            <span
              className={`text-[9.5px] font-['IBM_Plex_Mono',monospace] font-bold px-1.5 py-0.5 rounded-[2px] ${
                activeLayer.status === 'FAIL'
                  ? 'bg-[#b23a2e]/20 text-[#ff8d7d] border border-[#b23a2e]/40'
                  : activeLayer.status === 'WARN'
                  ? 'bg-[#d97706]/20 text-[#fcd34d] border border-[#d97706]/40'
                  : 'bg-[#22c55e]/20 text-[#86efac] border border-[#22c55e]/40'
              }`}
            >
              {activeLayer.badge}
            </span>
          </div>

          <p className="text-[12px] text-[#b9af9c] leading-snug mb-2">
            {activeLayer.summary}
          </p>

          <div className="space-y-1 font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#ede6d8] bg-[#1a1712] p-2 rounded-[2px] border border-[#2e271f]">
            {activeLayer.details.map((detail, dIdx) => (
              <div key={dIdx} className="truncate text-[#d3cbbe]">
                <span className="text-[#8e8574] mr-1.5">›</span>
                {detail}
              </div>
            ))}
          </div>
        </div>

        {/* 3D Viewport Controls & Indicators */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          
          {/* Layer Selector Chips */}
          <div className="flex items-center gap-1 p-1 bg-[#14120f]/85 backdrop-blur-md border border-[#3a352c] rounded-[4px] pointer-events-auto overflow-x-auto max-w-full">
            {activeCase.layers.map((layer, lIdx) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayerIndex(lIdx)}
                className={`px-2 py-1 rounded-[2px] text-[10.5px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer whitespace-nowrap ${
                  activeLayerIndex === lIdx
                    ? 'bg-[#c9a227] text-[#14120f] font-bold'
                    : 'text-[#b9af9c] hover:text-[#ede6d8] hover:bg-[#26221b]'
                }`}
              >
                L{lIdx + 1}: {layer.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Interactive Utility Controls */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Explode / Flatten Toggle */}
            <button
              onClick={() => setExploded(!exploded)}
              className="px-2.5 py-1.5 rounded-[3px] bg-[#1e1a14] hover:bg-[#2a241c] border border-[#3a352c] text-[#ede6d8] text-[11px] font-['IBM_Plex_Mono',monospace] font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              title={exploded ? 'Flatten into sealed envelope' : 'Deconstruct into 3D exploded layers'}
            >
              <Layers className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>{exploded ? 'Collapse' : 'Explode 3D'}</span>
            </button>

            {/* Scan Beam Trigger */}
            <button
              onClick={triggerScanPulse}
              disabled={isScanning}
              className={`px-2.5 py-1.5 rounded-[3px] border text-[11px] font-['IBM_Plex_Mono',monospace] font-medium flex items-center gap-1.5 cursor-pointer transition-all ${
                isScanning
                  ? 'bg-[#b23a2e] border-[#b23a2e] text-[#ede6d8] animate-pulse'
                  : 'bg-[#1e1a14] hover:bg-[#2a241c] border-[#3a352c] text-[#ede6d8]'
              }`}
              title="Fire a 3D forensic laser scan through all protocol layers"
            >
              <Zap className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>{isScanning ? 'Scanning...' : 'Scan Beam'}</span>
            </button>
          </div>
        </div>

        {/* Orbit Helper Watermark */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-[3px] bg-[#14120f]/75 border border-[#3a352c] text-[10.5px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] pointer-events-none">
          <RotateCcw className="w-3 h-3 text-[#c9a227]" />
          <span>Click & drag to rotate 3D</span>
        </div>
      </div>

      {/* Bottom Action Footer with Quick Summary & Direct Console Access */}
      <div className="px-4 py-3 bg-[#191611] border-t border-[#3a352c] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[3px] bg-[#221c15] border border-[#3a352c] flex items-center justify-center text-[#c9a227] shrink-0 font-['IBM_Plex_Mono',monospace] font-bold text-sm">
            {activeCase.score}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#ede6d8] truncate flex items-center gap-2">
              <span>{activeCase.title}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-['IBM_Plex_Mono',monospace] ${
                activeCase.verdict === 'MALICIOUS' ? 'bg-[#b23a2e]/30 text-[#ff8d7d]' : 'bg-[#22c55e]/30 text-[#86efac]'
              }`}>
                {activeCase.verdict}
              </span>
            </div>
            <div className="text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] truncate">
              Origin: {activeCase.originGeo} • {activeCase.asn}
            </div>
          </div>
        </div>

        <button
          onClick={handleLaunchInConsole}
          className="bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] px-4 py-2 rounded-[3px] font-medium text-[13px] border border-[#b23a2e] transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 group shrink-0"
        >
          <span>Investigate in Console</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};
