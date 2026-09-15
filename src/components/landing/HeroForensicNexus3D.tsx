import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Globe, 
  Lock, 
  RefreshCw, 
  Layers, 
  Sparkles, 
  MousePointer, 
  ZoomIn, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw,
  ArrowRight,
  Fingerprint,
  FileCode2,
  Mail,
  UserCheck,
  Server
} from 'lucide-react';

export interface ForensicStation {
  id: string;
  stepNumber: number;
  name: string;
  badge: string;
  subtitle: string;
  conceptPlainEnglish: string;
  forensicEvidenceLine: string;
  whyAttackersFail: string;
  verdict: 'BLOCKED' | 'SUSPICIOUS' | 'VERIFIED';
  colorHex: number;
  emissiveHex: number;
  position: [number, number, number];
  icon: string;
}

const FORENSIC_STATIONS: ForensicStation[] = [
  {
    id: 'station-origin',
    stepNumber: 1,
    name: 'Spoofed Sender Origin',
    badge: 'STEP 1: THE DISGUISE',
    subtitle: 'Attacker Injects Forged From Display Name',
    conceptPlainEnglish: 'The attacker writes "PayPal Security" or "CEO" in quotation marks. Ordinary email apps only show the display name inside the quotes, tricking victims into trusting the message.',
    forensicEvidenceLine: 'From: "PayPal Security Resolution" <security@paypal.com>\nReal Socket IP: 185.220.101.5 (Sofia, Bulgaria - Tor Exit Node)',
    whyAttackersFail: 'Attackers can type whatever display name they want, but the physical internet connection requires their actual server IP address.',
    verdict: 'BLOCKED',
    colorHex: 0xef4444,
    emissiveHex: 0xb23a2e,
    position: [-3.2, 0.4, 0.2],
    icon: 'ShieldAlert'
  },
  {
    id: 'station-relays',
    stepNumber: 2,
    name: 'MTA Transport Hops',
    badge: 'STEP 2: PERMANENT FOOTPRINTS',
    subtitle: 'Internet Relays Stamp Received Headers',
    conceptPlainEnglish: 'Emails do not fly directly into inboxes. They pass through intermediary mail servers. Every server that handles the message stamps an indelible, timestamped "Received:" header.',
    forensicEvidenceLine: 'Received: from origin-vps.anonymizing.bg ([185.220.101.5])\n    by mx01.enterprise-inbox.net with ESMTP; Sun, 15 Sep 2026 14:12:08',
    whyAttackersFail: 'Even if an attacker injects fake headers at the bottom of their email, the receiving gateway stamps the true client socket IP at the top of the stack.',
    verdict: 'SUSPICIOUS',
    colorHex: 0x38bdf8,
    emissiveHex: 0x0284c7,
    position: [-1.6, -0.6, -0.2],
    icon: 'Server'
  },
  {
    id: 'station-crypto',
    stepNumber: 3,
    name: 'Cryptographic Signature Gate',
    badge: 'STEP 3: MATHEMATICAL PROOF',
    subtitle: 'SPF, DKIM & DMARC Validation',
    conceptPlainEnglish: 'The receiving server checks DNS: Is this IP allowed by PayPal (SPF)? Does this email carry the secret RSA cryptographic private key (DKIM)? And does the domain align (DMARC)?',
    forensicEvidenceLine: 'Authentication-Results: mx.defense.net;\n    spf=fail (185.220.101.5 not authorized in DNS);\n    dkim=fail (RSA signature invalid); dmarc=fail (p=reject)',
    whyAttackersFail: 'Cryptographic keys cannot be guessed. Without the legitimate company\'s private key in DNS, the digital signature fails with 100% certainty.',
    verdict: 'BLOCKED',
    colorHex: 0xeab308,
    emissiveHex: 0xc9a227,
    position: [0.0, 0.8, 0.3],
    icon: 'Fingerprint'
  },
  {
    id: 'station-mime',
    stepNumber: 4,
    name: 'MIME Boundary Deconstruction',
    badge: 'STEP 4: ENVELOPE UNSEALING',
    subtitle: 'Body Hash (bh=) & Payload Dissection',
    conceptPlainEnglish: 'TraceXMail peels apart the multi-part envelope: isolating text, encoded attachments, tracking pixels, and checking the SHA-256 body hash to detect hidden trojans.',
    forensicEvidenceLine: 'Content-Type: multipart/alternative; boundary="==_Part_9812"\nPayload: Attachment "Invoice_482.pdf.exe" [Entropy: 7.94 • AsyncRAT Trojan]',
    whyAttackersFail: 'Attackers hiding executable payloads behind double extensions (.pdf.exe) are unmasked by binary magic-byte inspection and entropy analysis.',
    verdict: 'BLOCKED',
    colorHex: 0xa855f7,
    emissiveHex: 0x7e22ce,
    position: [1.6, -0.5, -0.1],
    icon: 'Layers'
  },
  {
    id: 'station-inbox',
    stepNumber: 5,
    name: 'Shielded Corporate Mailbox',
    badge: 'STEP 5: ZERO TRUST OUTCOME',
    subtitle: 'Automated Quarantine & Protected User',
    conceptPlainEnglish: 'Because all forensic evidence confirms spoofing and malware, the threat is automatically quarantined. The targeted employee is safe, and the SOC team receives an audit report.',
    forensicEvidenceLine: 'Decision: REJECTED AT GATEWAY • QUARANTINE VAULT #EV-9821\nVictim Inbox: employee@company.com [Protected • 0 Exposure]',
    whyAttackersFail: 'Zero-trust header analysis stops phishing at the perimeter before any user can ever be tricked into clicking a link.',
    verdict: 'VERIFIED',
    colorHex: 0x22c55e,
    emissiveHex: 0x16a34a,
    position: [3.2, 0.5, 0.2],
    icon: 'UserCheck'
  }
];

interface HeroForensicNexus3DProps {
  onNodeClick?: (nodeId: string) => void;
  onExploreCase?: (caseIndex: number) => void;
  onOpenConsole?: () => void;
}

export const HeroForensicNexus3D: React.FC<HeroForensicNexus3DProps> = ({
  onNodeClick,
  onExploreCase,
  onOpenConsole
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<number>(3); // Default to Cryptographic Gate
  const [isPlayingTour, setIsPlayingTour] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'concept' | 'technical'>('concept');
  const [cameraProgress, setCameraProgress] = useState<number>(0.5);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const stationMeshesRef = useRef<{ id: string; group: THREE.Group; mesh: THREE.Mesh; ring: THREE.Mesh }[]>([]);
  const packetMeshRef = useRef<THREE.Mesh | null>(null);
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const isPlayingRef = useRef<boolean>(true);
  const activeStepRef = useRef<number>(3);

  // Sync state with refs
  useEffect(() => {
    isPlayingRef.current = isPlayingTour;
  }, [isPlayingTour]);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  const activeStation = FORENSIC_STATIONS.find(s => s.stepNumber === activeStep) || FORENSIC_STATIONS[2];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 500;
    let height = container.clientHeight || 460;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 6.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 1.6);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7fa3ba, 0.8);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 3. Construct the 3D Spline Curve for the email flight path
    const points = FORENSIC_STATIONS.map(s => new THREE.Vector3(...s.position));
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    curveRef.current = curve;

    // Glowing Fiber-Optic Cable (Spline Tube)
    const tubeGeom = new THREE.TubeGeometry(curve, 100, 0.03, 12, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x3a352c,
      emissive: 0x221e17,
      roughness: 0.4,
      metalness: 0.8,
      transparent: true,
      opacity: 0.7
    });
    const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
    rootGroup.add(tubeMesh);

    // Glowing Energy Line running parallel
    const energyPoints = curve.getPoints(120);
    const energyLineGeom = new THREE.BufferGeometry().setFromPoints(energyPoints);
    const energyLineMat = new THREE.LineBasicMaterial({
      color: 0xc9a227,
      transparent: true,
      opacity: 0.45
    });
    const energyLine = new THREE.Line(energyLineGeom, energyLineMat);
    rootGroup.add(energyLine);

    // 4. Create 5 Distinct, Iconic Forensic Stations in 3D
    const stationMeshes: { id: string; group: THREE.Group; mesh: THREE.Mesh; ring: THREE.Mesh }[] = [];

    FORENSIC_STATIONS.forEach((station) => {
      const stationGroup = new THREE.Group();
      stationGroup.position.set(...station.position);

      let coreGeom: THREE.BufferGeometry;

      // Unique geometry representing each forensic station
      switch (station.stepNumber) {
        case 1: // Attacker Origin: Spiked warning core
          coreGeom = new THREE.DodecahedronGeometry(0.38, 0);
          break;
        case 2: // MTA Relays: Network server cylinder
          coreGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 16);
          break;
        case 3: // Cryptographic Gate: Holographic Torus Ring
          coreGeom = new THREE.TorusGeometry(0.36, 0.08, 16, 32);
          break;
        case 4: // MIME Deconstruction: Layered Octahedron
          coreGeom = new THREE.OctahedronGeometry(0.38, 0);
          break;
        case 5: // Shielded User Inbox: Crystalline Diamond
        default:
          coreGeom = new THREE.OctahedronGeometry(0.42, 1);
          break;
      }

      const coreMat = new THREE.MeshStandardMaterial({
        color: station.colorHex,
        emissive: station.emissiveHex,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.4
      });
      const coreMesh = new THREE.Mesh(coreGeom, coreMat);
      stationGroup.add(coreMesh);

      // Rotating Aura / Halo Ring around each station
      const haloGeom = new THREE.TorusGeometry(0.55, 0.015, 12, 40);
      const haloMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        transparent: true,
        opacity: 0.5
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      stationGroup.add(haloMesh);

      // Ground Tech Radar Disc
      const discGeom = new THREE.RingGeometry(0.2, 0.65, 32);
      const discMat = new THREE.MeshBasicMaterial({
        color: station.colorHex,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      const discMesh = new THREE.Mesh(discGeom, discMat);
      discMesh.rotation.x = Math.PI / 2;
      discMesh.position.y = -0.55;
      stationGroup.add(discMesh);

      rootGroup.add(stationGroup);
      stationMeshes.push({
        id: station.id,
        group: stationGroup,
        mesh: coreMesh,
        ring: haloMesh
      });
    });

    stationMeshesRef.current = stationMeshes;

    // 5. Traveling Email Data Packet (Luminous Cyber Envelope Core)
    const packetGroup = new THREE.Group();
    const packetGeom = new THREE.SphereGeometry(0.12, 16, 16);
    const packetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xc9a227,
      emissiveIntensity: 2.0
    });
    const packetCore = new THREE.Mesh(packetGeom, packetMat);
    packetGroup.add(packetCore);

    // Glowing Pulse Shell around packet
    const pulseShellGeom = new THREE.SphereGeometry(0.22, 16, 16);
    const pulseShellMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227,
      transparent: true,
      opacity: 0.4,
      wireframe: true
    });
    const pulseShell = new THREE.Mesh(pulseShellGeom, pulseShellMat);
    packetGroup.add(pulseShell);

    rootGroup.add(packetGroup);
    packetMeshRef.current = packetGroup as any;

    // 6. Interactive Raycasting for Hover & Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const targets = stationMeshes.map(s => s.mesh);
      const hits = raycaster.intersectObjects(targets);

      if (hits.length > 0) {
        container.style.cursor = 'pointer';
      } else {
        container.style.cursor = 'default';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const targets = stationMeshes.map(s => s.mesh);
      const hits = raycaster.intersectObjects(targets);

      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const found = stationMeshes.find(s => s.mesh === hitMesh);
        if (found) {
          const stationObj = FORENSIC_STATIONS.find(st => st.id === found.id);
          if (stationObj) {
            setActiveStep(stationObj.stepNumber);
            setIsPlayingTour(false); // Pause auto-tour when user interacts
            if (onNodeClick) onNodeClick(stationObj.id);
          }
        }
      }
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // 7. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let packetT = 0.5; // Progress 0 to 1 along curve

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Rotate individual station meshes on their own axes
      stationMeshes.forEach((st, idx) => {
        st.mesh.rotation.y += 0.015;
        st.mesh.rotation.x = Math.sin(time + idx) * 0.15;
        st.ring.rotation.z += 0.02;

        // Highlight active station with subtle pulsation
        const isActive = (idx + 1) === activeStepRef.current;
        if (isActive) {
          const scale = 1.0 + Math.sin(time * 4) * 0.08;
          st.group.scale.set(scale, scale, scale);
        } else {
          st.group.scale.lerp(new THREE.Vector3(0.9, 0.9, 0.9), 0.1);
        }
      });

      // Update Traveling Email Packet along 3D Curve
      if (curveRef.current && packetMeshRef.current) {
        if (isPlayingRef.current) {
          packetT = (packetT + delta * 0.18) % 1.0;
        } else {
          // Snap packet position towards the active step
          const targetT = (activeStepRef.current - 1) / (FORENSIC_STATIONS.length - 1);
          packetT += (targetT - packetT) * 0.08;
        }

        const pointOnCurve = curveRef.current.getPointAt(packetT);
        packetMeshRef.current.position.copy(pointOnCurve);

        // If playing auto-tour, update active step when packet passes stations
        if (isPlayingRef.current) {
          const calculatedStep = Math.min(
            5,
            Math.max(1, Math.round(packetT * (FORENSIC_STATIONS.length - 1)) + 1)
          );
          if (calculatedStep !== activeStepRef.current) {
            setActiveStep(calculatedStep);
          }
        }
      }

      // Smooth subtle camera drift to create depth
      const activeObj = FORENSIC_STATIONS[activeStepRef.current - 1] || FORENSIC_STATIONS[2];
      const targetCamX = activeObj.position[0] * 0.35;
      const targetCamY = 0.6 + activeObj.position[1] * 0.2;
      camera.position.x += (targetCamX - camera.position.x) * 0.04;
      camera.position.y += (targetCamY - camera.position.y) * 0.04;
      camera.lookAt(targetCamX * 0.5, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 500;
      height = container.clientHeight || 460;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  const handleSelectStep = (stepNum: number) => {
    setActiveStep(stepNum);
    setIsPlayingTour(false);
  };

  const handleReset = () => {
    setActiveStep(1);
    setIsPlayingTour(true);
  };

  return (
    <div className="w-full bg-[#14110d] border border-[#3a352c] rounded-md shadow-2xl overflow-hidden font-sans">
      
      {/* Top Interactive Concept Bar */}
      <div className="p-3.5 sm:p-4 bg-[#1a1612] border-b border-[#3a352c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#c9a227]" />
            <span>Forensic 3D Concept Engine</span>
          </div>
          <span className="text-[12px] text-[#8e8574] font-['IBM_Plex_Mono',monospace] hidden md:inline">
            Follow an email's cryptographic flight path
          </span>
        </div>

        {/* Controls: Auto-Tour & View Mode Toggle */}
        <div className="flex items-center gap-2 text-[11px] font-['IBM_Plex_Mono',monospace]">
          <button
            onClick={() => setIsPlayingTour(!isPlayingTour)}
            className={`px-2.5 py-1 rounded-[2px] border transition-all cursor-pointer flex items-center gap-1.5 ${
              isPlayingTour 
                ? 'bg-[#262017] border-[#c9a227] text-[#c9a227] font-bold' 
                : 'bg-[#15120e] border-[#3a352c] text-[#8e8574] hover:text-[#ede6d8]'
            }`}
            title={isPlayingTour ? 'Pause automatic journey tour' : 'Play automatic journey tour'}
          >
            {isPlayingTour ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPlayingTour ? 'Auto Journey' : 'Tour Paused'}</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'concept' ? 'technical' : 'concept')}
            className="px-2.5 py-1 rounded-[2px] bg-[#15120e] border border-[#3a352c] hover:border-[#c9a227] text-[#ede6d8] transition-all cursor-pointer flex items-center gap-1.5"
            title="Toggle between simple plain-English explanation and raw RFC822 header inspection"
          >
            <FileCode2 className="w-3 h-3 text-[#c9a227]" />
            <span>{viewMode === 'concept' ? 'Switch to Technical' : 'Switch to Concept'}</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1 rounded-[2px] bg-[#15120e] border border-[#3a352c] hover:border-[#c9a227] text-[#8e8574] hover:text-[#ede6d8] cursor-pointer"
            title="Reset to Step 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-[#0c0a08] overflow-hidden">
        
        {/* 3D Mount Container */}
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Dynamic Stage Pill on 3D viewport */}
        <div className="absolute top-4 left-4 pointer-events-none">
          <div className="px-3 py-1.5 rounded bg-[#16130f]/90 border border-[#3a352c] shadow-xl backdrop-blur-sm flex items-center gap-2">
            <span 
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: `#${activeStation.colorHex.toString(16)}` }}
            />
            <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold text-[#ede6d8]">
              {activeStation.badge}
            </span>
            <span className="text-[#8e8574] font-['IBM_Plex_Mono',monospace] text-[10px]">
              • {activeStation.name}
            </span>
          </div>
        </div>

        {/* Floating Legend / Click Guidance */}
        <div className="absolute bottom-3 right-4 pointer-events-none hidden sm:block">
          <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#645c4e] flex items-center gap-1.5">
            <MousePointer className="w-3 h-3 text-[#c9a227]" />
            <span>Click any 3D station to inspect its forensic evidence</span>
          </span>
        </div>

      </div>

      {/* Interactive 5-Step Journey Stepper Buttons */}
      <div className="bg-[#181410] border-t border-[#3a352c] p-2 sm:p-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center justify-between gap-2 min-w-max">
          {FORENSIC_STATIONS.map((station) => {
            const isSelected = station.stepNumber === activeStep;
            return (
              <button
                key={station.id}
                onClick={() => handleSelectStep(station.stepNumber)}
                className={`px-3 py-2 rounded-[3px] border transition-all cursor-pointer flex items-center gap-2 text-left ${
                  isSelected
                    ? 'bg-[#251f18] border-[#c9a227] shadow-md'
                    : 'bg-[#12100d] border-[#2b261e] hover:border-[#4a4235] hover:bg-[#1a1612]'
                }`}
              >
                <span 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-['IBM_Plex_Mono',monospace] shrink-0"
                  style={{ 
                    backgroundColor: isSelected ? `#${station.colorHex.toString(16)}` : '#2d2820',
                    color: isSelected ? '#0b0a08' : '#8e8574'
                  }}
                >
                  {station.stepNumber}
                </span>
                <div className="text-[11px] font-['IBM_Plex_Mono',monospace]">
                  <div className={`font-bold truncate max-w-[130px] ${isSelected ? 'text-[#ede6d8]' : 'text-[#8e8574]'}`}>
                    {station.name}
                  </div>
                  <div className="text-[9.5px] text-[#645c4e] truncate max-w-[130px]">
                    {station.verdict}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanatory Forensic Concept Card (The "Why It's Easy To Understand" Engine) */}
      <div className="p-4 sm:p-6 bg-[#16130f] border-t border-[#3a352c] space-y-4">
        
        {/* Step Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#2b251e]">
          <div className="space-y-0.5">
            <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] font-bold tracking-wider uppercase">
              {activeStation.badge}
            </span>
            <h3 className="text-[17px] sm:text-[19px] font-bold text-[#ede6d8]">
              {activeStation.name}: {activeStation.subtitle}
            </h3>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className={`px-2.5 py-1 rounded text-[11px] font-bold font-['IBM_Plex_Mono',monospace] border ${
              activeStation.verdict === 'BLOCKED' ? 'bg-[#b23a2e]/20 text-[#ff8d7d] border-[#b23a2e]/40' :
              activeStation.verdict === 'VERIFIED' ? 'bg-[#22c55e]/20 text-[#4ade80] border-[#22c55e]/40' :
              'bg-amber-950/40 text-amber-300 border-amber-800/40'
            }`}>
              RESULT: {activeStation.verdict}
            </span>
          </div>
        </div>

        {/* View Mode 1: Plain English Concept (Easy to understand for any executive or analyst) */}
        {viewMode === 'concept' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#110f0c] p-4 rounded border border-[#2b261e] space-y-2">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] uppercase font-bold block">
                The Concept in 10 Seconds:
              </span>
              <p className="text-[13.5px] text-[#ede6d8] leading-relaxed">
                {activeStation.conceptPlainEnglish}
              </p>
            </div>

            <div className="bg-[#110f0c] p-4 rounded border border-[#2b261e] space-y-2">
              <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#4ade80] uppercase font-bold block">
                Why Attackers Cannot Win Here:
              </span>
              <p className="text-[13.5px] text-[#b9af9c] leading-relaxed">
                {activeStation.whyAttackersFail}
              </p>
            </div>
          </div>
        ) : (
          /* View Mode 2: Technical RFC822 Header Proof */
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574]">
              <span>Extracted RFC5322 Protocol Evidence:</span>
              <span>Syntax: Verifiable Header Segment</span>
            </div>
            <pre className="bg-[#0c0a08] p-3.5 rounded border border-[#262017] text-[#c9a227] font-['IBM_Plex_Mono',monospace] text-[12px] leading-relaxed overflow-x-auto select-all">
              {activeStation.forensicEvidenceLine}
            </pre>
          </div>
        )}

      </div>

    </div>
  );
};
