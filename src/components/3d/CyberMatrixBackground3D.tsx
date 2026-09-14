import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface CyberMatrixBackground3DProps {
  particleCount?: number;
  className?: string;
}

export const CyberMatrixBackground3D: React.FC<CyberMatrixBackground3DProps> = ({
  particleCount = 40,
  className = ''
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Create matrix nodes
    const positions = new Float32Array(particleCount * 3);
    const velocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;

      velocities.push({
        x: (Math.random() - 0.5) * 0.005,
        y: (Math.random() - 0.5) * 0.005,
        z: (Math.random() - 0.5) * 0.005
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.06,
      transparent: true,
      opacity: 0.7
    });

    const particles = new THREE.Points(geometry, material);
    group.add(particles);

    // Line network geometry
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.25
    });
    const linesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    group.add(linesMesh);

    let animationFrameId: number;

    const animate = () => {
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;

      // Update positions
      for (let i = 0; i < particleCount; i++) {
        array[i * 3] += velocities[i].x;
        array[i * 3 + 1] += velocities[i].y;
        array[i * 3 + 2] += velocities[i].z;

        // Bounce bounds
        if (Math.abs(array[i * 3]) > 3) velocities[i].x *= -1;
        if (Math.abs(array[i * 3 + 1]) > 2) velocities[i].y *= -1;
        if (Math.abs(array[i * 3 + 2]) > 2) velocities[i].z *= -1;
      }
      posAttr.needsUpdate = true;

      // Connect close particles with lines
      const linePositions: number[] = [];
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = array[i * 3] - array[j * 3];
          const dy = array[i * 3 + 1] - array[j * 3 + 1];
          const dz = array[i * 3 + 2] - array[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < 2.2) {
            linePositions.push(
              array[i * 3], array[i * 3 + 1], array[i * 3 + 2],
              array[j * 3], array[j * 3 + 1], array[j * 3 + 2]
            );
          }
        }
      }

      linesMesh.geometry.dispose();
      linesMesh.geometry = new THREE.BufferGeometry();
      linesMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));

      group.rotation.y += 0.001;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 200;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [particleCount]);

  return (
    <div
      ref={mountRef}
      className={`relative overflow-hidden pointer-events-none ${className}`}
    />
  );
};
