import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Radio,
  Activity
} from 'lucide-react';
import { EmailAnalysis } from '../../types';
import { useLiveForensicCases3D, Dynamic3DNode, LiveDbCase } from '../../hooks/useLiveForensicCases3D';

interface Forensic3DDataVisualizerProps {
  currentAnalysis?: EmailAnalysis;
  onSelectCase?: (analysis: EmailAnalysis) => void;
  onOpenConsole?: () => void;
  onExploreCase?: (caseIndex?: number) => void;
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

  // Unified Live Supabase Forensic Hook
  const {
    cases,
    activeCase,
    activeCaseIndex,
    activeAnalysis,
    nodes,
    selectedNode,
    setSelectedNode,
    connectionStatus,
    dbSourceStatus,
    lastSyncTimestamp,
    realtimeUpdatesCount,
    selectCaseByIndex,
    refreshLiveCases
  } = useLiveForensicCases3D(currentAnalysis);

  // Notify parent on active analysis change
  useEffect(() => {
    if (activeAnalysis && onSelectCase) {
      onSelectCase(activeAnalysis);
    }
  }, [activeAnalysis, onSelectCase]);

  // Viewport Settings
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [explanationMode, setExplanationMode] = useState<'simple' | 'technical'>('simple');
  const [nodeScreenCoords, setNodeScreenCoords] = useState<{ id: string; x: number; y: number; visible: boolean; depth: number }[]>([]);

  // Three.js Render Loop & Viewport Setup with Dynamic Node Positioning
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

    // Advanced Lighting Setup
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

    // Holographic Matrix Core Sphere
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
    const nodeMeshes: { mesh: THREE.Mesh; nodeData: Dynamic3DNode; group: THREE.Group }[] = [];
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
      nodeMeshes.push({ mesh, nodeData: node, group: nodeSubGroup });

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

      // Animate node meshes with smooth floating and rotational dynamics
      nodeMeshes.forEach(({ mesh, nodeData, group }) => {
        // Floating sinusoidal offset
        group.position.y = nodeData.position[1] + Math.sin(elapsed * 2.0 + nodeData.position[0]) * 0.05;

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
  }, [nodes, autoRotate, setSelectedNode]);

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
            <Radio className={`w-3.5 h-3.5 ${connectionStatus === 'connected' ? 'text-[#22c55e] animate-pulse' : 'text-[#f59e0b]'}`} />
            <span>Live 3D Telemetry Matrix • {dbSourceStatus}</span>
            {realtimeUpdatesCount > 0 && (
              <span className="bg-[#10b981]/20 text-[#4ade80] px-1.5 py-0.2 rounded text-[10px]">
                {realtimeUpdatesCount} Live Updates
              </span>
            )}
          </div>

          <h2 className="font-['Fraunces',serif] text-[26px] sm:text-[34px] md:text-[38px] font-medium text-[#ede6d8] leading-tight">
            Live Case Journey &amp; Attacker Nexus
          </h2>

          <p className="mt-2.5 text-[#b9af9c] text-[15px] sm:text-[16.5px] leading-relaxed">
            Reconstructed dynamically from active Supabase cases. Differentiating protected employees from malicious spoofing infrastructure.
          </p>

          {/* Real Database Case Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            <div className="flex items-center gap-1.5 text-[11.5px] text-[#8e8574] font-['IBM_Plex_Mono',monospace] mr-1">
              <Database className="w-3.5 h-3.5 text-[#c9a227]" />
              <span>Database Cases:</span>
            </div>

            {cases.map((dbCase, idx) => {
              const isSelected = activeCaseIndex === idx;
              const isHigh = dbCase.threatLevel === 'HIGH';
              return (
                <button
                  key={dbCase.id}
                  onClick={() => selectCaseByIndex(idx)}
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
              onClick={refreshLiveCases}
              disabled={connectionStatus === 'syncing'}
              className="p-1.5 rounded bg-[#1f1a14] hover:bg-[#2a241b] border border-[#3d2f1f] text-[#c9a227] transition-all cursor-pointer ml-1"
              title="Sync latest live cases from Supabase database"
              aria-label="Refresh Database Cases"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus === 'syncing' ? 'animate-spin' : ''}`} />
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
                <span>Supabase Live Sync: {lastSyncTimestamp}</span>
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
