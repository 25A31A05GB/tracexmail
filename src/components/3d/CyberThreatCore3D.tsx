import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface CyberThreatCore3DProps {
  threatScore?: number;
  verdict?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CyberThreatCore3D: React.FC<CyberThreatCore3DProps> = ({
  threatScore = 65,
  verdict = 'SUSPICIOUS',
  size = 'md',
  interactive = true,
  className = '',
  onClick
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ isDragging: boolean; x: number; y: number }>({ isDragging: false, x: 0, y: 0 });
  const rotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // Determine color based on verdict / score
    const isHighThreat = threatScore >= 70 || verdict?.toUpperCase() === 'MALICIOUS';
    const isMediumThreat = threatScore >= 40 || verdict?.toUpperCase() === 'SUSPICIOUS';
    
    const coreColor = isHighThreat ? 0xef4444 : isMediumThreat ? 0xf59e0b : 0x10b981;
    const secondaryColor = isHighThreat ? 0x9f1239 : isMediumThreat ? 0xd97706 : 0x047857;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Group to rotate core
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Inner glowing Icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(1.0, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Solid inner core
    const innerGeo = new THREE.IcosahedronGeometry(0.55, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: secondaryColor,
      wireframe: false,
      transparent: true,
      opacity: 0.6
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerMesh);

    // Outer orbital Torus Ring
    const torusGeo = new THREE.TorusGeometry(1.5, 0.02, 16, 64);
    const torusMat = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.5
    });
    const torusRing1 = new THREE.Mesh(torusGeo, torusMat);
    torusRing1.rotation.x = Math.PI / 3;
    coreGroup.add(torusRing1);

    const torusRing2 = new THREE.Mesh(torusGeo, torusMat);
    torusRing2.rotation.y = Math.PI / 4;
    coreGroup.add(torusRing2);

    // Particles cloud around core
    const particlesCount = 80;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.6 + Math.random() * 0.8;
      posArray[i] = r * Math.sin(phi) * Math.cos(theta);
      posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      posArray[i + 2] = r * Math.cos(phi);
    }
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
      size: 0.04,
      color: coreColor,
      transparent: true,
      opacity: 0.7
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    coreGroup.add(particleSystem);

    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Continuous rotation
      coreMesh.rotation.y = elapsedTime * 0.3;
      coreMesh.rotation.x = elapsedTime * 0.15;
      innerMesh.rotation.y = -elapsedTime * 0.4;
      torusRing1.rotation.z = elapsedTime * 0.2;
      torusRing2.rotation.x = elapsedTime * 0.25;
      particleSystem.rotation.y = elapsedTime * 0.1;

      // Pulse scale according to threat level
      const pulseSpeed = isHighThreat ? 4 : isMediumThreat ? 2 : 1;
      const pulse = 1 + Math.sin(elapsedTime * pulseSpeed) * 0.05;
      coreMesh.scale.set(pulse, pulse, pulse);

      // Apply drag rotation
      coreGroup.rotation.x += (rotationRef.current.x - coreGroup.rotation.x) * 0.05;
      coreGroup.rotation.y += (rotationRef.current.y - coreGroup.rotation.y) * 0.05;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // ResizeObserver
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Drag event handlers
    const onMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      mouseRef.current.isDragging = true;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!interactive || !mouseRef.current.isDragging) return;
      const deltaX = e.clientX - mouseRef.current.x;
      const deltaY = e.clientY - mouseRef.current.y;
      rotationRef.current.y += deltaX * 0.01;
      rotationRef.current.x += deltaY * 0.01;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseUp = () => {
      mouseRef.current.isDragging = false;
    };

    if (interactive) {
      container.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (interactive) {
        container.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [threatScore, verdict, interactive, size]);

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
      onClick={onClick}
    />
  );
};
