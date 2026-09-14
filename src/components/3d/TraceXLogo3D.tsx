import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface TraceXLogo3DProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const TraceXLogo3D: React.FC<TraceXLogo3DProps> = ({
  size = 'md',
  interactive = true,
  className = '',
  onClick,
  title = 'TraceXMail 3D Forensic Engine'
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef<boolean>(false);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const surgeRef = useRef<number>(1.0);
  const [isSurging, setIsSurging] = useState<boolean>(false);

  // Dimensions based on size preset
  const dimMap = {
    sm: { width: 28, height: 28, cameraZ: 4.2 },
    md: { width: 38, height: 38, cameraZ: 3.8 },
    lg: { width: 68, height: 68, cameraZ: 3.5 },
    xl: { width: 140, height: 140, cameraZ: 3.2 }
  };

  const { width, height, cameraZ } = dimMap[size] || dimMap.md;

  const handleSurge = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSurging(true);
    surgeRef.current = 3.5;
    setTimeout(() => {
      surgeRef.current = 1.0;
      setIsSurging(false);
    }, 1200);
    if (onClick) onClick();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = cameraZ;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfff5e6, 1.2);
    scene.add(ambientLight);

    const redLight = new THREE.PointLight(0xb23a2e, 2.5, 10);
    redLight.position.set(-2, 2, 3);
    scene.add(redLight);

    const amberLight = new THREE.PointLight(0xc9a227, 2.5, 10);
    amberLight.position.set(2, -2, 2);
    scene.add(amberLight);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Central Dodecahedron Crystal Core
    const coreGeo = new THREE.DodecahedronGeometry(size === 'sm' ? 0.75 : 0.85, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xb23a2e,
      emissive: 0x6e1b13,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(coreMesh);

    // 2. Inner Golden Cryptographic Octahedron Kernel
    const kernelGeo = new THREE.OctahedronGeometry(size === 'sm' ? 0.45 : 0.52, 0);
    const kernelMat = new THREE.MeshBasicMaterial({
      color: 0xc9a227,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const kernelMesh = new THREE.Mesh(kernelGeo, kernelMat);
    rootGroup.add(kernelMesh);

    // 3. Outer Gimbal Rings
    const ring1Geo = new THREE.TorusGeometry(size === 'sm' ? 1.05 : 1.25, 0.04, 12, 48);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      emissive: 0xc9a227,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.1
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.set(Math.PI / 3, Math.PI / 4, 0);
    rootGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(size === 'sm' ? 1.25 : 1.48, 0.035, 12, 48);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0xb23a2e,
      emissive: 0xff6b57,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.set(-Math.PI / 4, Math.PI / 3, 0);
    rootGroup.add(ring2);

    // 4. Orbiting Energy Satellite Nodes (for md, lg, xl sizes)
    const satGroup = new THREE.Group();
    rootGroup.add(satGroup);
    
    const satMeshes: THREE.Mesh[] = [];
    if (size !== 'sm') {
      const satGeo = new THREE.SphereGeometry(0.09, 12, 12);
      const satMat1 = new THREE.MeshBasicMaterial({ color: 0xff8d7d });
      const satMat2 = new THREE.MeshBasicMaterial({ color: 0xf5d372 });

      const sat1 = new THREE.Mesh(satGeo, satMat1);
      const sat2 = new THREE.Mesh(satGeo, satMat2);
      satGroup.add(sat1);
      satGroup.add(sat2);
      satMeshes.push(sat1, sat2);
    }

    // Interactive mouse listeners
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mousePosRef.current = { x, y };
    };

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      mousePosRef.current = { x: 0, y: 0 };
    };

    if (interactive) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    // Animation loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const surge = surgeRef.current;
      const hovered = isHoveredRef.current;

      const baseSpeed = hovered ? 2.2 : 1.0;
      const speed = baseSpeed * surge;

      // Rotate crystal core and kernel
      coreMesh.rotation.y += delta * 0.8 * speed;
      coreMesh.rotation.x += delta * 0.4 * speed;

      kernelMesh.rotation.y -= delta * 1.2 * speed;
      kernelMesh.rotation.z += delta * 0.6 * speed;

      // Orbit gimbal rings
      ring1.rotation.z += delta * 0.6 * speed;
      ring2.rotation.x += delta * 0.5 * speed;

      // Orbit satellites
      if (satMeshes.length >= 2) {
        const rad1 = size === 'sm' ? 1.05 : 1.25;
        const rad2 = size === 'sm' ? 1.25 : 1.48;
        const angle1 = elapsed * 1.6 * speed;
        const angle2 = -elapsed * 1.3 * speed + Math.PI;

        satMeshes[0].position.set(Math.cos(angle1) * rad1, Math.sin(angle1) * 0.5, Math.sin(angle1) * rad1);
        satMeshes[1].position.set(Math.cos(angle2) * rad2, Math.sin(angle2) * 0.8, -Math.sin(angle2) * rad2);
      }

      // Smooth mouse tilt tracking
      if (interactive) {
        const targetRotX = mousePosRef.current.y * 0.45;
        const targetRotY = mousePosRef.current.x * 0.55;
        rootGroup.rotation.x += (targetRotX - rootGroup.rotation.x) * 0.1;
        rootGroup.rotation.y += (targetRotY - rootGroup.rotation.y) * 0.1;
      }

      // Subtle breathing scale
      const breath = 1 + Math.sin(elapsed * 3) * (hovered ? 0.08 : 0.03);
      coreMesh.scale.set(breath, breath, breath);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (interactive) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      kernelGeo.dispose();
      kernelMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
    };
  }, [width, height, cameraZ, size, interactive]);

  return (
    <div
      onClick={handleSurge}
      title={title}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none group transition-transform ${
        isSurging ? 'scale-110' : ''
      } ${className}`}
    >
      {/* 3D WebGL Canvas Target */}
      <div ref={mountRef} className="w-full h-full absolute inset-0 pointer-events-auto" />

      {/* Subtle Outer Glow Halo on Hover */}
      <div className="absolute inset-0 rounded-full bg-[#b23a2e]/0 group-hover:bg-[#b23a2e]/20 group-hover:blur-sm transition-all pointer-events-none" />
    </div>
  );
};
