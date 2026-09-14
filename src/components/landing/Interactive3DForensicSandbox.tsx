import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  Globe2, 
  Layers, 
  Cpu, 
  ShieldAlert, 
  Activity, 
  Zap, 
  ArrowRight, 
  Compass, 
  RotateCw, 
  Lock, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  FileCode,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { CyberThreatGlobe3D } from '../3d/CyberThreatGlobe3D';
import { CyberThreatCore3D } from '../3d/CyberThreatCore3D';
import { EmailAnalysis, EmailHop } from '../../types';
import { SAMPLE_ANALYSES } from '../../data/samples';

interface Interactive3DForensicSandboxProps {
  onOpenConsole: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

type SandboxTab = 'globe' | 'dissector' | 'reactor';

interface ScenarioPreset {
  id: string;
  name: string;
  type: string;
  verdict: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN';
  threatScore: number;
  origin: string;
  originIp: string;
  asn: string;
  summary: string;
  hops: EmailHop[];
  layers: {
    title: string;
    description: string;
    status: string;
    details: string[];
  }[];
  sampleIndex: number;
}

const PRESETS: ScenarioPreset[] = [
  {
    id: 'scenario-paypal',
    name: 'Nazario Corpus: PayPal Account Restriction',
    type: 'Brand Impersonation / Credential Phish',
    verdict: 'MALICIOUS',
    threatScore: 98,
    origin: 'Sofia, Bulgaria',
    originIp: '185.220.101.5',
    asn: 'AS200548 (Tor Exit Relay)',
    summary: 'Email originates from an anonymizing Tor relay in Bulgaria pretending to be PayPal Security. Fails SPF and DMARC alignment.',
    sampleIndex: 0,
    hops: [
      {
        hopNumber: 1,
        byHost: 'tor-exit.relay.bg',
        fromHost: '185.220.101.5',
        fromIp: '185.220.101.5',
        timestamp: '2026-09-05T14:18:22Z',
        delaySec: 0.0,
        city: 'Sofia',
        country: 'Bulgaria',
        lat: 42.6977,
        lng: 23.3219,
        isTorExitNode: true,
        isProxyOrVpn: true,
        abuseStatus: 'Tor Exit Node / High Risk Anonymizer'
      },
      {
        hopNumber: 2,
        byHost: 'mail-relay.frankfurt.net',
        fromHost: 'relay-gw.de',
        fromIp: '194.26.29.112',
        timestamp: '2026-09-05T14:18:24Z',
        delaySec: 1.8,
        city: 'Frankfurt',
        country: 'Germany',
        lat: 50.1109,
        lng: 8.6821
      },
      {
        hopNumber: 3,
        byHost: 'mx.victim-corp.com',
        fromHost: 'mail-relay.frankfurt.net',
        fromIp: '104.244.42.1',
        timestamp: '2026-09-05T14:18:25Z',
        delaySec: 0.6,
        city: 'New York',
        country: 'United States',
        lat: 40.7128,
        lng: -74.0060
      }
    ],
    layers: [
      {
        title: 'Layer 1 • Socket & Network Routing',
        description: 'BGP origin Autonomous System AS200548 mapped to a Sofia Tor relay.',
        status: 'FAIL',
        details: ['IP: 185.220.101.5', 'ASN: AS200548', 'VPN/Tor: Detected (100%)']
      },
      {
        title: 'Layer 2 • Cryptographic Envelope',
        description: 'SPF softfail and DMARC enforcement rejection policy triggered.',
        status: 'FAIL',
        details: ['SPF: softfail', 'DKIM: 2048-bit invalid', 'DMARC: p=reject']
      },
      {
        title: 'Layer 3 • MIME & Payload Heuristics',
        description: 'Urgent account suspension lure with hidden redirection URL.',
        status: 'FAIL',
        details: ['Typosquat: paypal-secure-update.com', 'Entropy: 7.84 bits', 'Urgency NLP: 98%']
      },
      {
        title: 'Layer 4 • Threat Intelligence Nexus',
        description: 'Correlated with 14 active phishing campaign clusters in Europe.',
        status: 'FAIL',
        details: ['Campaign ID: NAZ-PHISH-01', 'Confidence: 99.1%', 'Verdict: CRITICAL_PHISH']
      }
    ]
  },
  {
    id: 'scenario-bec',
    name: 'Executive Wire Transfer Fraud (BEC)',
    type: 'Business Email Compromise',
    verdict: 'MALICIOUS',
    threatScore: 95,
    origin: 'Chisinau, Moldova',
    originIp: '194.26.29.112',
    asn: 'AS57523 (AlexHost Offshore)',
    summary: 'Forged CEO wire request demanding $48,200 wire with disguised AsyncRAT executable payload.',
    sampleIndex: 1,
    hops: [
      {
        hopNumber: 1,
        byHost: 'bulletproof-vps.alexhost.md',
        fromHost: '194.26.29.112',
        fromIp: '194.26.29.112',
        timestamp: '2026-09-06T09:12:10Z',
        delaySec: 0.0,
        city: 'Chisinau',
        country: 'Moldova',
        lat: 47.0105,
        lng: 28.8638,
        isProxyOrVpn: true,
        abuseStatus: 'Bulletproof Offshore Hosting Provider'
      },
      {
        hopNumber: 2,
        byHost: 'london-hub.transit.uk',
        fromHost: 'bulletproof-vps.alexhost.md',
        fromIp: '51.140.22.88',
        timestamp: '2026-09-06T09:12:12Z',
        delaySec: 1.9,
        city: 'London',
        country: 'United Kingdom',
        lat: 51.5074,
        lng: -0.1278
      },
      {
        hopNumber: 3,
        byHost: 'target-mx.enterprise.com',
        fromHost: 'london-hub.transit.uk',
        fromIp: '35.185.12.99',
        timestamp: '2026-09-06T09:12:13Z',
        delaySec: 0.8,
        city: 'Chicago',
        country: 'United States',
        lat: 41.8781,
        lng: -87.6298
      }
    ],
    layers: [
      {
        title: 'Layer 1 • Socket & Network Routing',
        description: 'Injected directly into an offshore hosting ASN known for ignoring abuse complaints.',
        status: 'FAIL',
        details: ['IP: 194.26.29.112', 'ASN: AS57523 (AlexHost)', 'Abuse Score: 94%']
      },
      {
        title: 'Layer 2 • Cryptographic Envelope',
        description: 'Display name spoofing CEO with unaligned envelope Return-Path.',
        status: 'FAIL',
        details: ['From: ceo@company.com', 'Return-Path: drop@alexhost.md', 'DKIM: Missing']
      },
      {
        title: 'Layer 3 • MIME & Payload Heuristics',
        description: 'Attachment contains double extension Invoice_48200.pdf.exe.',
        status: 'FAIL',
        details: ['Double Ext: .pdf.exe', 'Executable Magic: MZ/PE32', 'Malware: AsyncRAT']
      },
      {
        title: 'Layer 4 • Threat Intelligence Nexus',
        description: 'Matches known banking Trojan dropper infrastructure signature.',
        status: 'FAIL',
        details: ['Threat Actor: TA-505', 'Confidence: 96.4%', 'Verdict: CRITICAL_MALWARE']
      }
    ]
  },
  {
    id: 'scenario-github',
    name: 'Legitimate: GitHub Personal Access Token',
    type: 'Authentic Enterprise Notification',
    verdict: 'CLEAN',
    threatScore: 4,
    origin: 'Seattle, United States',
    originIp: '192.30.252.204',
    asn: 'AS36459 (GitHub Inc)',
    summary: 'Cryptographically verified GitHub infrastructure notification passing 2048-bit RSA DKIM and strict DMARC alignment.',
    sampleIndex: 2,
    hops: [
      {
        hopNumber: 1,
        byHost: 'smtp.github.com',
        fromHost: '192.30.252.204',
        fromIp: '192.30.252.204',
        timestamp: '2026-09-07T11:00:00Z',
        delaySec: 0.0,
        city: 'Seattle',
        country: 'United States',
        lat: 47.6062,
        lng: -122.3321
      },
      {
        hopNumber: 2,
        byHost: 'mx-in.company.com',
        fromHost: 'smtp.github.com',
        fromIp: '52.12.44.10',
        timestamp: '2026-09-07T11:00:01Z',
        delaySec: 0.5,
        city: 'San Jose',
        country: 'United States',
        lat: 37.3382,
        lng: -121.8863
      }
    ],
    layers: [
      {
        title: 'Layer 1 • Socket & Network Routing',
        description: 'Authentic GitHub Autonomous System CIDR block matching public records.',
        status: 'PASS',
        details: ['IP: 192.30.252.204', 'ASN: AS36459 (GitHub)', 'CIDR: 192.30.252.0/22']
      },
      {
        title: 'Layer 2 • Cryptographic Envelope',
        description: 'Valid 2048-bit RSA signature verified with DNSSEC public key.',
        status: 'PASS',
        details: ['SPF: Pass', 'DKIM: Pass (2048-bit RSA)', 'DMARC: Pass (Strict)']
      },
      {
        title: 'Layer 3 • MIME & Payload Heuristics',
        description: 'Sanitized RFC5322 boundaries with legitimate HTTPS token management links.',
        status: 'PASS',
        details: ['Target Link: https://github.com/settings/tokens', 'Phish Score: 0.02']
      },
      {
        title: 'Layer 4 • Threat Intelligence Nexus',
        description: 'Zero malicious reputation across all threat feeds.',
        status: 'PASS',
        details: ['Reputation: Clean (100%)', 'Verdict: VERIFIED_SAFE']
      }
    ]
  }
];

export const Interactive3DForensicSandbox: React.FC<Interactive3DForensicSandboxProps> = ({
  onOpenConsole,
  onSelectCase
}) => {
  const [activeTab, setActiveTab] = useState<SandboxTab>('globe');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [selectedHop, setSelectedHop] = useState<EmailHop | null>(null);
  const [explosionFactor, setExplosionFactor] = useState<number>(1.2);
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);

  const dissectorMountRef = useRef<HTMLDivElement>(null);
  const currentPreset = PRESETS[selectedPresetIndex];

  // 3D Exploded Layer Dissector WebGL
  useEffect(() => {
    if (activeTab !== 'dissector') return;
    const container = dissectorMountRef.current;
    if (!container) return;

    let width = container.clientWidth || 500;
    let height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(4, 5, 6);
    scene.add(dirLight);

    const layerGroup = new THREE.Group();
    scene.add(layerGroup);

    // Create 4 floating 3D planar plates representing email architecture layers
    const layerMeshes: THREE.Mesh[] = [];
    const colors = [
      currentPreset.verdict === 'MALICIOUS' ? 0xb23a2e : 0x22c55e,
      0xc9a227,
      0x7fa3ba,
      currentPreset.verdict === 'MALICIOUS' ? 0xb23a2e : 0x22c55e
    ];

    const plateGeom = new THREE.BoxGeometry(3.6, 0.12, 2.2);

    for (let i = 0; i < 4; i++) {
      const plateMat = new THREE.MeshStandardMaterial({
        color: colors[i],
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: i === activeLayerIndex ? 0.95 : 0.65,
        wireframe: false
      });
      const mesh = new THREE.Mesh(plateGeom, plateMat);
      
      // Wireframe border
      const wireGeom = new THREE.BoxGeometry(3.62, 0.13, 2.22);
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xede6d8,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const wireMesh = new THREE.Mesh(wireGeom, wireMat);
      mesh.add(wireMesh);

      layerGroup.add(mesh);
      layerMeshes.push(mesh);
    }

    // Interactive mouse rotation
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotY = 0.4;
    let rotX = 0.3;

    const onPointerDown = (e: PointerEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isMouseDown) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        rotY += deltaX * 0.008;
        rotX += deltaY * 0.008;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
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
      width = container.clientWidth || 500;
      height = container.clientHeight || 420;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      layerGroup.rotation.y = rotY;
      layerGroup.rotation.x = rotX;

      // Position layers according to explosion factor
      layerMeshes.forEach((mesh, index) => {
        const targetY = (index - 1.5) * explosionFactor;
        mesh.position.y += (targetY - mesh.position.y) * 0.15;
      });

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
      plateGeom.dispose();
    };
  }, [activeTab, activeLayerIndex, explosionFactor, selectedPresetIndex]);

  const handleLaunchCase = () => {
    const sample = SAMPLE_ANALYSES[currentPreset.sampleIndex] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(sample);
    }
    onOpenConsole();
  };

  return (
    <section id="interactive-3d-lab" className="py-20 border-b border-[#3a352c] bg-[radial-gradient(ellipse_900px_450px_at_50%_0%,rgba(178,58,46,0.06),transparent_70%),#14120f] relative overflow-hidden">
      <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-[720px]">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] bg-[#b23a2e]/15 border border-[#b23a2e]/40 text-[#ede6d8] font-['IBM_Plex_Mono',monospace] text-[11px] mb-3 uppercase tracking-wider font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#c9a227] animate-pulse" />
              Interactive 3D Forensic Laboratory
            </div>
            <h2 className="font-['Fraunces',serif] text-[28px] sm:text-[36px] font-medium text-[#ede6d8] leading-[1.15]">
              Inspect live attack telemetry in full 3D space
            </h2>
            <p className="text-[#b9af9c] mt-3 text-[15px] sm:text-[16px] leading-relaxed max-w-[62ch]">
              Rotate the global threat sphere, explode RFC822 protocol layers, and inspect raw packet telemetry in real time. Switch scenarios below to observe how legitimate vs malicious mail travels across the internet.
            </p>
          </div>

          {/* Tab Navigation Controls */}
          <div className="flex items-center gap-1.5 p-1 bg-[#1d1a15] border border-[#3a352c] rounded-[4px] self-start lg:self-end">
            <button
              onClick={() => setActiveTab('globe')}
              className={`px-3.5 py-2 rounded-[3px] font-['IBM_Plex_Mono',monospace] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'globe'
                  ? 'bg-[#b23a2e] text-[#ede6d8] shadow-md'
                  : 'text-[#b9af9c] hover:text-[#ede6d8] hover:bg-[#26221b]'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>3D Attack Arc</span>
            </button>
            <button
              onClick={() => setActiveTab('dissector')}
              className={`px-3.5 py-2 rounded-[3px] font-['IBM_Plex_Mono',monospace] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dissector'
                  ? 'bg-[#b23a2e] text-[#ede6d8] shadow-md'
                  : 'text-[#b9af9c] hover:text-[#ede6d8] hover:bg-[#26221b]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Layer Dissector</span>
            </button>
            <button
              onClick={() => setActiveTab('reactor')}
              className={`px-3.5 py-2 rounded-[3px] font-['IBM_Plex_Mono',monospace] text-[12px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'reactor'
                  ? 'bg-[#b23a2e] text-[#ede6d8] shadow-md'
                  : 'text-[#b9af9c] hover:text-[#ede6d8] hover:bg-[#26221b]'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Threat Reactor</span>
            </button>
          </div>
        </div>

        {/* Attack Scenario Switcher Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {PRESETS.map((preset, idx) => {
            const isSelected = selectedPresetIndex === idx;
            const isMalicious = preset.verdict === 'MALICIOUS';
            return (
              <div
                key={preset.id}
                onClick={() => {
                  setSelectedPresetIndex(idx);
                  setSelectedHop(null);
                }}
                className={`p-3.5 rounded-[4px] border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#221e17] border-[#b23a2e] shadow-lg ring-1 ring-[#b23a2e]/50'
                    : 'bg-[#181510] border-[#3a352c] hover:border-[#b9af9c] hover:bg-[#1d1a15]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-['IBM_Plex_Mono',monospace] text-[10.5px] uppercase text-[#b9af9c] font-semibold">
                    Sample 0{idx + 1}
                  </span>
                  <span
                    className={`font-['IBM_Plex_Mono',monospace] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isMalicious
                        ? 'bg-[#b23a2e]/20 text-[#b23a2e] border border-[#b23a2e]/40'
                        : 'bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40'
                    }`}
                  >
                    {preset.threatScore} / 100
                  </span>
                </div>
                <h4 className="font-['Fraunces',serif] text-[14.5px] font-semibold text-[#ede6d8] truncate mb-0.5">
                  {preset.name}
                </h4>
                <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] truncate m-0">
                  {preset.origin} • {preset.asn}
                </p>
              </div>
            );
          })}
        </div>

        {/* Main 3D Interactive Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: 3D Viewport Area */}
          <div className="lg:col-span-7 bg-[#0e0c0a] border border-[#3a352c] rounded-[6px] relative min-h-[440px] sm:min-h-[480px] flex flex-col justify-between overflow-hidden shadow-2xl">
            
            {/* Viewport Top Bar */}
            <div className="p-3 bg-[#14120f]/90 border-b border-[#3a352c]/70 flex items-center justify-between z-10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="font-['IBM_Plex_Mono',monospace] text-[11.5px] text-[#ede6d8] font-bold">
                  {activeTab === 'globe' && '3D GLOBAL HOP TRACER'}
                  {activeTab === 'dissector' && '3D LAYER EXPLODER (RFC822)'}
                  {activeTab === 'reactor' && '3D ANOMALY RESONANCE CORE'}
                </span>
              </div>
              <div className="font-['IBM_Plex_Mono',monospace] text-[10.5px] text-[#b9af9c]">
                WebGL 2.0 • 60 FPS
              </div>
            </div>

            {/* TAB CONTENT 1: Globe View */}
            {activeTab === 'globe' && (
              <div className="relative flex-1 w-full h-full min-h-[380px]">
                <CyberThreatGlobe3D
                  hops={currentPreset.hops}
                  threatScore={currentPreset.threatScore}
                  className="w-full h-full"
                  onSelectHop={(hop) => setSelectedHop(hop)}
                />
              </div>
            )}

            {/* TAB CONTENT 2: 3D Exploded Layer Dissector */}
            {activeTab === 'dissector' && (
              <div className="relative flex-1 w-full h-full min-h-[380px] flex flex-col">
                <div 
                  ref={dissectorMountRef} 
                  className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative"
                  title="Drag mouse to rotate 3D layer plate stack"
                />

                {/* Explosion slider controls overlay */}
                <div className="p-3 bg-[#14120f]/90 border-t border-[#3a352c] flex items-center justify-between gap-4 z-10">
                  <div className="flex items-center gap-2 text-[12px] font-['IBM_Plex_Mono',monospace] text-[#b9af9c]">
                    <span>Explode Stack:</span>
                    <input
                      type="range"
                      min="0.4"
                      max="2.2"
                      step="0.1"
                      value={explosionFactor}
                      onChange={(e) => setExplosionFactor(parseFloat(e.target.value))}
                      className="w-28 sm:w-36 accent-[#b23a2e] cursor-pointer"
                    />
                    <span className="text-[#ede6d8]">{explosionFactor.toFixed(1)}x</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map((layerIdx) => (
                      <button
                        key={layerIdx}
                        onClick={() => setActiveLayerIndex(layerIdx)}
                        className={`px-2 py-0.5 rounded text-[11px] font-['IBM_Plex_Mono',monospace] transition-colors cursor-pointer ${
                          activeLayerIndex === layerIdx
                            ? 'bg-[#b23a2e] text-[#ede6d8] font-bold'
                            : 'bg-[#1d1a15] text-[#b9af9c] hover:text-[#ede6d8]'
                        }`}
                      >
                        L{layerIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Threat Reactor */}
            {activeTab === 'reactor' && (
              <div className="relative flex-1 w-full h-full min-h-[380px] flex items-center justify-center p-6">
                <div className="w-full max-w-[340px] h-[340px]">
                  <CyberThreatCore3D
                    threatScore={currentPreset.threatScore}
                    verdict={currentPreset.verdict}
                    size="full"
                    interactive={true}
                  />
                </div>
              </div>
            )}

            {/* Viewport Bottom Hint */}
            <div className="p-2.5 bg-[#14120f]/80 border-t border-[#3a352c]/50 text-[11px] font-['IBM_Plex_Mono',monospace] text-[#8e8574] flex items-center justify-between">
              <span>Interactive Viewport: Drag to orbit • Scroll to zoom</span>
              <span className="text-[#c9a227]">● Target: {currentPreset.originIp}</span>
            </div>
          </div>

          {/* Right Column: Live Forensic Telemetry Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#181510] border border-[#3a352c] rounded-[6px] p-5 sm:p-6 shadow-xl">
            <div>
              {/* Header Telemetry */}
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#3a352c]">
                <div>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] uppercase tracking-wider block">
                    Forensic Target Analysis
                  </span>
                  <h3 className="font-['Fraunces',serif] text-[18px] sm:text-[20px] font-semibold text-[#ede6d8] mt-0.5">
                    {currentPreset.name}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="font-['Fraunces',serif] text-[26px] font-bold text-[#ede6d8]">
                    {currentPreset.threatScore}
                  </div>
                  <div className="font-['IBM_Plex_Mono',monospace] text-[10px] text-[#b9af9c]">
                    RISK SCORE
                  </div>
                </div>
              </div>

              {/* Summary Description */}
              <p className="text-[13.5px] text-[#b9af9c] mt-3.5 leading-relaxed">
                {currentPreset.summary}
              </p>

              {/* Hop Breakdown or Layer Breakdown depending on active tab */}
              {activeTab === 'dissector' ? (
                <div className="mt-4 space-y-2.5">
                  <div className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] uppercase tracking-wider">
                    Exploded Architecture Findings:
                  </div>
                  {currentPreset.layers.map((layer, lIdx) => (
                    <div
                      key={lIdx}
                      onClick={() => setActiveLayerIndex(lIdx)}
                      className={`p-2.5 rounded-[3px] border text-[12px] font-['IBM_Plex_Mono',monospace] transition-all cursor-pointer ${
                        activeLayerIndex === lIdx
                          ? 'bg-[#262017] border-[#b23a2e] text-[#ede6d8]'
                          : 'bg-[#14120f] border-[#3a352c] text-[#b9af9c] hover:border-[#8e8574]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold mb-1">
                        <span>{layer.title}</span>
                        <span className={layer.status === 'FAIL' ? 'text-[#b23a2e]' : 'text-[#22c55e]'}>
                          {layer.status}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-[#8e8574] mb-1.5 font-['IBM_Plex_Sans',sans-serif]">
                        {layer.description}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {layer.details.map((d, dIdx) => (
                          <span key={dIdx} className="px-1.5 py-0.5 rounded bg-[#100e0c] border border-[#3a352c] text-[10px] text-[#b9af9c]">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  <div className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] uppercase tracking-wider">
                    Reverse BGP Hops (Click hop to inspect):
                  </div>
                  {currentPreset.hops.map((hop, hIdx) => {
                    const isTarget = (selectedHop?.hopNumber || 1) === hop.hopNumber;
                    const isSuspicious = hop.isTorExitNode || hop.isProxyOrVpn || Boolean(hop.abuseStatus);
                    const locationStr = [hop.city, hop.country].filter(Boolean).join(', ') || 'Global Transit';
                    const delayStr = hop.delaySec !== undefined ? `+${hop.delaySec.toFixed(1)}s` : '0.0s';
                    return (
                      <div
                        key={hIdx}
                        onClick={() => setSelectedHop(hop)}
                        className={`p-2.5 rounded-[3px] border transition-all cursor-pointer ${
                          isTarget
                            ? 'bg-[#262017] border-[#b23a2e] shadow-md'
                            : 'bg-[#14120f] border-[#3a352c] hover:border-[#8e8574]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-['IBM_Plex_Mono',monospace] text-[12px] mb-1">
                          <span className="font-bold text-[#ede6d8]">
                            HOP 0{hop.hopNumber} • {locationStr}
                          </span>
                          <span className={isSuspicious ? 'text-[#b23a2e] font-bold' : 'text-[#22c55e]'}>
                            {delayStr}
                          </span>
                        </div>
                        <div className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#8e8574] truncate">
                          {hop.fromIp || hop.fromHost} ({hop.byHost})
                        </div>
                        {isSuspicious && (
                          <div className="mt-1 text-[11px] text-[#b23a2e] font-['IBM_Plex_Mono',monospace] flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{hop.abuseStatus || (hop.isTorExitNode ? 'Tor Exit Node' : 'Anonymized Proxy')}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Launch Action */}
            <div className="mt-6 pt-4 border-t border-[#3a352c]">
              <button
                onClick={handleLaunchCase}
                className="w-full bg-[#b23a2e] hover:bg-[#c94a3d] text-[#ede6d8] py-3 px-4 rounded-[3px] font-semibold text-[14.5px] border border-[#b23a2e] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg group"
              >
                <span>Launch this case in Analyst Console</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
