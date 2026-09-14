import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CyberThreatCore3DProps {
  threatScore: number;
  verdict?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  interactive?: boolean;
  className?: string;
}

export const CyberThreatCore3D: React.FC<CyberThreatCore3DProps> = ({
  threatScore,
  verdict = 'SUSPICIOUS',
  size = 'full',
  interactive = true,
  className = ''
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isHigh = threatScore >= 70 || verdict.toUpperCase() === 'MALICIOUS';
  const isMedium = threatScore >= 40 && threatScore < 70;

  const coreColor = isHigh ? 0xef4444 : isMedium ? 0xf59e0b : 0x10b981;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 250;
    const height = container.clientHeight || 250;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(coreColor, 3, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    // Inner Core Sphere
    const coreGeo = new THREE.IcosahedronGeometry(0.8, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: coreColor,
      emissive: coreColor,
      emissiveIntensity: 0.6,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.8
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Outer Orbital Ring 1
    const ring1Geo = new THREE.TorusGeometry(1.3, 0.02, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.5 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    // Outer Orbital Ring 2
    const ring2Geo = new THREE.TorusGeometry(1.5, 0.015, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.3 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      coreMesh.rotation.y += deltaMove.x * 0.01;
      coreMesh.rotation.x += deltaMove.y * 0.01;
      ring1.rotation.z += deltaMove.x * 0.005;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDragging = false; };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (!isDragging) {
        coreMesh.rotation.y += 0.01;
        coreMesh.rotation.x += 0.005;
      }

      ring1.rotation.z += 0.008;
      ring2.rotation.z -= 0.005;

      const pulse = 1 + Math.sin(elapsed * 3) * 0.05;
      coreMesh.scale.setScalar(pulse);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
    };
  }, [threatScore, verdict, interactive, coreColor]);

  return <div ref={mountRef} className={`w-full h-full cursor-grab active:cursor-grabbing ${className}`} />;
};
