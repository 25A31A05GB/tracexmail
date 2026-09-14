import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, ShieldAlert, Zap, Globe, Lock, RefreshCw, Layers, Compass, Sparkles, MousePointer, ZoomIn, CheckCircle2, UserCheck } from 'lucide-react';

interface ForensicNode {
  id: string;
  label: string;
  shortTag: string;
  sublabel: string;
  type: 'USER' | 'IP' | 'AUTH' | 'DOMAIN' | 'GEO';
  status: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN';
  details: string;
  risk: number;
  position: [number, number, number];
  shape: 'diamond' | 'spiked' | 'ring' | 'sphere';
}

interface HeroForensicNexus3DProps {
  onNodeClick?: (nodeId: string) => void;
  onExploreCase?: (caseIndex: number) => void;
}

const FORENSIC_NODES: ForensicNode[] = [
  {
    id: 'node-user',
    label: 'Protected Employee Inbox',
    shortTag: 'TRACED USER',
    sublabel: 'Targeted Recipient (Shielded)',
    type: 'USER',
    status: 'CLEAN',
    details: 'The intended victim inbox. TraceXMail verified the user profile and prevented credential exposure.',
    risk: 0,
    position: [2.3, -0.6, 0.7],
    shape: 'diamond'
  },
  {
    id: 'node-tor',
    label: '185.220.101.5',
    shortTag: 'ATTACKER TOR',
    sublabel: 'Hidden Attacker Relay (Bulgaria)',
    type: 'IP',
    status: 'MALICIOUS',
    details: 'The computer that sent the email. It used an anonymous Tor gateway to hide its real identity.',
    risk: 98,
    position: [-2.2, 1.1, 0.8],
    shape: 'spiked'
  },
  {
    id: 'node-spf',
    label: 'Security Checkpoint (SPF)',
    shortTag: 'GATEWAY FAILED',
    sublabel: 'Unauthorized Sender Identity',
    type: 'AUTH',
    status: 'MALICIOUS',
    details: 'The digital signature failed because this sender is not allowed to send email for this company.',
    risk: 94,
    position: [0.2, 2.2, 0.3],
    shape: 'ring'
  },
  {
    id: 'node-domain',
    label: 'paypal-security-update.com',
    shortTag: 'FAKE DOMAIN',
    sublabel: 'Lookalike Phishing Website',
    type: 'DOMAIN',
    status: 'MALICIOUS',
    details: 'A fake web address created 3 days ago designed to trick people into typing their passwords.',
    risk: 96,
    position: [-1.2, -1.6, 1.1],
    shape: 'spiked'
  },
  {
    id: 'node-geo',
    label: 'Inbound Mail Relay',
    shortTag: 'SAFE TRANSIT',
    sublabel: 'Legitimate Mail Server',
    type: 'GEO',
    status: 'CLEAN',
    details: 'Standard internet mail server that routed the message and passed it to the security scanner.',
    risk: 6,
    position: [1.4, 1.5, -0.8],
    shape: 'sphere'
  }
];

export const HeroForensicNexus3D: React.FC<HeroForensicNexus3DProps> = ({
  onNodeClick,
  onExploreCase
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<ForensicNode | null>(FORENSIC_NODES[0]);
  const [hoveredNode, setHoveredNode] = useState<ForensicNode | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [showFloatingLabels, setShowFloatingLabels] = useState<boolean>(true);
  const [particleSpeed, setParticleSpeed] = useState<number>(1);
  const [activePulse, setActivePulse] = useState<boolean>(false);
  const [projectedCoords, setProjectedCoords] = useState<{ id: string; x: number; y: number; visible: boolean; depthScale: number }[]>([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 450;
    let height = container.clientHeight || 440;

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.z = 6.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.1);
    scene.add(ambientLight);

    const primaryLight = new THREE.DirectionalLight(0xede6d8, 1.4);
    primaryLight.position.set(5, 5, 5);
    scene.add(primaryLight);

    const redThreatLight = new THREE.PointLight(0xef4444, 2.5, 12);
    redThreatLight.position.set(-3, -2, 2);
    scene.add(redThreatLight);

    const greenUserLight = new THREE.PointLight(0x22c55e, 2.5, 12);
    greenUserLight.position.set(3, -2, 2);
    scene.add(greenUserLight);

    // Root Group for interactive rotation
    const nexusGroup = new THREE.Group();
    scene.add(nexusGroup);

    // Central Forensic Core Sphere
    const coreGeom = new THREE.SphereGeometry(0.7, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    nexusGroup.add(coreMesh);

    // Gimbal Ring 1
    const ring1Geom = new THREE.TorusGeometry(2.3, 0.012, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x8a8070, transparent: true, opacity: 0.3 });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    nexusGroup.add(ring1);

    // Dynamic Nodes with distinct Geometries & Colors
    const nodeMeshes: { nodeData: ForensicNode; mesh: THREE.Mesh }[] = [];
    const pulsePackets: { mesh: THREE.Mesh; startPos: THREE.Vector3 }[] = [];

    FORENSIC_NODES.forEach((node) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...node.position);

      const isClean = node.status === 'CLEAN';
      const isUser = node.type === 'USER';
      const isMalicious = node.status === 'MALICIOUS';

      const nodeColor = isUser ? 0x22c55e : isMalicious ? 0xef4444 : 0xf59e0b;
      const emColor = isUser ? 0x4ade80 : isMalicious ? 0xff8d7d : 0xfcd34d;

      let nGeom: THREE.BufferGeometry;
      switch (node.shape) {
        case 'diamond':
          nGeom = new THREE.OctahedronGeometry(0.32, 0);
          break;
        case 'spiked':
          nGeom = new THREE.DodecahedronGeometry(0.34, 0);
          break;
        case 'ring':
          nGeom = new THREE.TorusGeometry(0.28, 0.07, 16, 24);
          break;
        case 'sphere':
        default:
          nGeom = new THREE.SphereGeometry(0.26, 20, 20);
          break;
      }

      const nMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        emissive: emColor,
        emissiveIntensity: 0.9,
        roughness: 0.2
      });
      const nMesh = new THREE.Mesh(nGeom, nMat);
      nodeGroup.add(nMesh);
      nodeMeshes.push({ nodeData: node, mesh: nMesh });

      // Pulsing Halo Ring
      const haloGeom = new THREE.RingGeometry(0.36, 0.44, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: nodeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      nodeGroup.add(haloMesh);

      // Connecting Ray to Core
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-node.position[0], -node.position[1], -node.position[2])
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: nodeColor,
        transparent: true,
        opacity: 0.35
      });
      const line = new THREE.Line(lineGeom, lineMat);
      nodeGroup.add(line);

      // Packet Pulse
      const packetGeom = new THREE.SphereGeometry(0.06, 8, 8);
      const packetMat = new THREE.MeshBasicMaterial({ color: emColor });
      const packet = new THREE.Mesh(packetGeom, packetMat);
      nexusGroup.add(packet);
      pulsePackets.push({ mesh: packet, startPos: new THREE.Vector3(...node.position) });

      nexusGroup.add(nodeGroup);
    });

    // Mouse Drag Rotation & Hover
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationX = 0.2;
    let targetRotationY = 0.4;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isMouseDown) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        targetRotationY += deltaX * 0.008;
        targetRotationX += deltaY * 0.008;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }

      // Check hover on nodes
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map(n => n.mesh));
      if (intersects.length > 0) {
        const hit = nodeMeshes.find(n => n.mesh === intersects[0].object);
        if (hit) {
          setHoveredNode(hit.nodeData);
          container.style.cursor = 'pointer';
        }
      } else {
        setHoveredNode(null);
        container.style.cursor = isMouseDown ? 'grabbing' : 'grab';
      }
    };

    const handlePointerUp = () => {
      isMouseDown = false;
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map(n => n.mesh));
      if (intersects.length > 0) {
        const hit = nodeMeshes.find(n => n.mesh === intersects[0].object);
        if (hit) {
          setSelectedNode(hit.nodeData);
          if (onNodeClick) onNodeClick(hit.nodeData.id);
        }
      }
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('click', handleClick);

    // Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth || 450;
      height = container.clientHeight || 440;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Animation Loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Rotation damping
      if (isRotating && !isMouseDown) {
        nexusGroup.rotation.y += 0.004 * particleSpeed;
        nexusGroup.rotation.x += 0.001 * particleSpeed;
      } else {
        nexusGroup.rotation.y += (targetRotationY - nexusGroup.rotation.y) * 0.1;
        nexusGroup.rotation.x += (targetRotationX - nexusGroup.rotation.x) * 0.1;
      }

      // Individual mesh rotations
      nodeMeshes.forEach(({ mesh, nodeData }) => {
        if (nodeData.shape === 'diamond') {
          mesh.rotation.y += delta * 0.8;
        } else if (nodeData.shape === 'spiked') {
          mesh.rotation.y += delta * 0.5;
        }
      });

      // Packet Pulses along rays
      pulsePackets.forEach(({ mesh, startPos }, idx) => {
        const progress = (elapsedTime * 0.7 * particleSpeed + idx * 0.2) % 1;
        mesh.position.lerpVectors(startPos, new THREE.Vector3(0, 0, 0), progress);
      });

      // Project 3D Node positions to 2D screen coordinates
      const coords: { id: string; x: number; y: number; visible: boolean; depthScale: number }[] = [];
      FORENSIC_NODES.forEach((node) => {
        const worldPos = new THREE.Vector3(...node.position);
        worldPos.applyMatrix4(nexusGroup.matrixWorld);
        const projected = worldPos.clone().project(camera);

        const isBehind = projected.z > 1;
        const screenX = ((projected.x + 1) * width) / 2;
        const screenY = ((-projected.y + 1) * height) / 2;
        
        const depthScale = Math.max(0.8, Math.min(1.1, (6.5 - worldPos.z) / 6.0));

        coords.push({
          id: node.id,
          x: screenX,
          y: screenY,
          visible: !isBehind && screenX >= 10 && screenX <= width - 10 && screenY >= 10 && screenY <= height - 10,
          depthScale
        });
      });
      setProjectedCoords(coords);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, [isRotating, particleSpeed]);

  return (
    <div className="w-full h-full relative flex flex-col justify-between select-none overflow-hidden rounded-[6px] border border-[#3d2f1f] bg-[radial-gradient(ellipse_at_top,#261c14_0%,#14120f_80%)] shadow-2xl">
      
      {/* 3D WebGL Canvas Viewport */}
      <div 
        ref={mountRef} 
        className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
        title="Click and drag to rotate the 3D map"
      />

      {/* Dynamic 3D Floating Spatial Labels */}
      {showFloatingLabels && projectedCoords.map((coord) => {
        if (!coord.visible) return null;
        const node = FORENSIC_NODES.find(n => n.id === coord.id);
        if (!node) return null;
        const isSelected = (hoveredNode || selectedNode)?.id === node.id;
        const isMalicious = node.status === 'MALICIOUS';
        const isUser = node.type === 'USER';

        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: `${coord.x}px`,
              top: `${coord.y - 22}px`,
              transform: `translate(-50%, -50%) scale(${coord.depthScale})`,
              zIndex: 15
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(node);
              if (onNodeClick) onNodeClick(node.id);
            }}
            className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-['IBM_Plex_Mono',monospace] font-bold tracking-wider cursor-pointer whitespace-nowrap transition-all select-none backdrop-blur-md flex items-center gap-1.5 shadow-xl ${
              isSelected
                ? 'bg-[#ede6d8] text-[#14120f] scale-110 ring-2 ring-[#c9a227] z-25'
                : isUser
                  ? 'bg-[#0e1912]/90 text-[#4ade80] border border-[#22c55e]/60 hover:bg-[#22c55e] hover:text-[#14120f]'
                  : isMalicious
                    ? 'bg-[#18100e]/90 text-[#ff8d7d] border border-[#ef4444]/60 hover:bg-[#ef4444] hover:text-[#ede6d8]'
                    : 'bg-[#14120f]/90 text-[#d6cdbe] border border-[#3a352c] hover:border-[#c9a227]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isUser ? 'bg-[#22c55e]' : isMalicious ? 'bg-[#ef4444] animate-pulse' : 'bg-[#c9a227]'}`} />
            <span>{node.shortTag}</span>
          </div>
        );
      })}

      {/* Top HUD Controls Overlay */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between border-b border-[#3a352c]/60 bg-[#14120f]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
          <span className="font-['IBM_Plex_Mono',monospace] text-[11px] font-bold text-[#ede6d8] tracking-wider uppercase">
            3D Journey Nexus
          </span>
          <span className="hidden xs:inline-block font-['IBM_Plex_Mono',monospace] text-[10px] text-[#b9af9c] px-1.5 py-0.5 rounded bg-[#26221b] border border-[#3a352c]">
            Interactive Map
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`px-2 py-1 rounded text-[10.5px] font-['IBM_Plex_Mono',monospace] border transition-colors cursor-pointer flex items-center gap-1 ${
              isRotating
                ? 'bg-[#c9a227]/20 border-[#c9a227] text-[#ede6d8]'
                : 'bg-[#1d1a15] border-[#3a352c] text-[#b9af9c]'
            }`}
            title="Toggle Continuous Orbit"
          >
            <Compass className="w-3 h-3" />
            <span className="hidden sm:inline">{isRotating ? 'Orbit' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Floating Interactive Hover / Selection Card (Simplified for Beginners) */}
      <div className="relative z-10 p-3 sm:p-4 mt-auto">
        <div className="bg-[#181510]/95 border border-[#3a352c] rounded-[4px] p-3 sm:p-3.5 backdrop-blur-md shadow-2xl transition-all">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                (hoveredNode || selectedNode)?.type === 'USER'
                  ? 'bg-[#22c55e]'
                  : (hoveredNode || selectedNode)?.status === 'MALICIOUS'
                    ? 'bg-[#ef4444]'
                    : 'bg-[#c9a227]'
              }`} />
              <span className="font-['IBM_Plex_Mono',monospace] text-[12px] font-bold text-[#ede6d8] truncate">
                {(hoveredNode || selectedNode)?.label}
              </span>
            </div>
            
            <span className={`font-['IBM_Plex_Mono',monospace] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
              (hoveredNode || selectedNode)?.type === 'USER'
                ? 'bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/40'
                : (hoveredNode || selectedNode)?.status === 'MALICIOUS'
                  ? 'bg-[#ef4444]/20 text-[#ff8d7d] border border-[#ef4444]/40'
                  : 'bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/40'
            }`}>
              {(hoveredNode || selectedNode)?.type === 'USER' ? 'PROTECTED' : `${(hoveredNode || selectedNode)?.risk}% RISK`}
            </span>
          </div>

          <p className="font-['IBM_Plex_Mono',monospace] text-[11px] text-[#c9a227] mb-1 font-medium">
            {(hoveredNode || selectedNode)?.sublabel}
          </p>

          <p className="text-[12px] text-[#b9af9c] leading-snug line-clamp-2 m-0">
            {(hoveredNode || selectedNode)?.details}
          </p>

          {/* Action to test in console */}
          <div className="mt-2.5 pt-2 border-t border-[#3a352c]/60 flex items-center justify-between text-[11px] font-['IBM_Plex_Mono',monospace]">
            <span className="text-[#8e8574] flex items-center gap-1">
              <MousePointer className="w-3 h-3 text-[#c9a227]" />
              <span>Tap nodes to inspect</span>
            </span>
            <button
              onClick={() => onExploreCase ? onExploreCase(0) : null}
              className="text-[#ede6d8] hover:text-[#c94a3d] transition-colors flex items-center gap-1 font-semibold cursor-pointer bg-transparent border-none p-0"
            >
              <span>Inspect in Console</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
