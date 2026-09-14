import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface CyberMatrixBackground3DProps {
  particleCount?: number;
  className?: string;
  speed?: number;
}

export const CyberMatrixBackground3D: React.FC<CyberMatrixBackground3DProps> = ({
  particleCount = 40,
  className = '',
  speed = 1
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Particle Cloud
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

      const isGold = Math.random() > 0.5;
      colors[i * 3] = isGold ? 0.78 : 0.7; // R
      colors[i * 3 + 1] = isGold ? 0.63 : 0.2; // G
      colors[i * 3 + 2] = isGold ? 0.15 : 0.2; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Grid Mesh
    const gridHelper = new THREE.GridHelper(10, 10, 0x3d2f1f, 0x1f1a14);
    gridHelper.position.y = -2;
    gridHelper.rotation.x = Math.PI / 8;
    scene.add(gridHelper);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      particles.rotation.y += 0.002 * speed;
      particles.rotation.x += 0.001 * speed;
      gridHelper.position.z = (gridHelper.position.z + 0.005 * speed) % 1;
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
      renderer.dispose();
    };
  }, [particleCount, speed]);

  return <div ref={mountRef} className={`overflow-hidden pointer-events-none ${className}`} />;
};
