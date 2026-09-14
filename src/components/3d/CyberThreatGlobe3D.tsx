import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EmailHop } from '../../types';

export interface CyberThreatGlobe3DProps {
  hops?: EmailHop[];
  threatScore?: number;
  className?: string;
  onSelectHop?: (hop: EmailHop) => void;
}

export const CyberThreatGlobe3D: React.FC<CyberThreatGlobe3DProps> = ({
  hops = [],
  threatScore = 65,
  className = '',
  onSelectHop
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ isDragging: boolean; x: number; y: number }>({ isDragging: false, x: 0, y: 0 });
  const rotationRef = useRef<{ x: number; y: number }>({ x: 0.2, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Globe Base Sphere
    const R = 1.4;
    const globeGeo = new THREE.SphereGeometry(R, 32, 32);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeGroup.add(globeMesh);

    // Inner Glowing Core
    const innerGeo = new THREE.SphereGeometry(R * 0.98, 24, 24);
    const innerMat = new THREE.MeshBasicMaterial({
      color: threatScore >= 70 ? 0x9f1239 : threatScore >= 40 ? 0x92400e : 0x064e3b,
      transparent: true,
      opacity: 0.2
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    globeGroup.add(innerMesh);

    // Convert lat/lng to 3D Cartesian coordinates
    const latLngToVector3 = (lat: number, lng: number, radius: number): THREE.Vector3 => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    };

    // Filter valid hops with coordinates (or create fallback positions)
    const validHops = hops.length > 0 ? hops : [
      { hopNumber: 1, lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'USA' },
      { hopNumber: 2, lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
      { hopNumber: 3, lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' }
    ];

    const hopVectors: THREE.Vector3[] = [];

    validHops.forEach((hop, idx) => {
      const lat = hop.lat ?? (30 + (idx * 20) % 60);
      const lng = hop.lng ?? (-100 + (idx * 80) % 200);
      const pos = latLngToVector3(lat, lng, R + 0.02);
      hopVectors.push(pos);

      // Marker mesh
      const markerGeo = new THREE.SphereGeometry(0.04, 12, 12);
      const isOrigin = idx === 0;
      const markerColor = isOrigin ? 0xef4444 : (idx === validHops.length - 1 ? 0x10b981 : 0x3b82f6);
      
      const markerMat = new THREE.MeshBasicMaterial({ color: markerColor });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.copy(pos);
      globeGroup.add(markerMesh);

      // Ring around marker
      const ringGeo = new THREE.RingGeometry(0.06, 0.08, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: markerColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.01));
      ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
      globeGroup.add(ringMesh);
    });

    // Draw connecting arcs between sequential hops
    for (let i = 0; i < hopVectors.length - 1; i++) {
      const start = hopVectors[i];
      const end = hopVectors[i + 1];

      // Midpoint elevated above sphere surface
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(R + Math.min(dist * 0.3, 0.6));

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(30);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: threatScore >= 70 ? 0xf43f5e : 0x38bdf8,
        transparent: true,
        opacity: 0.8
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      globeGroup.add(arcLine);
    }

    let animationFrameId: number;

    const animate = () => {
      if (!mouseRef.current.isDragging) {
        rotationRef.current.y += 0.003;
      }

      globeGroup.rotation.x += (rotationRef.current.x - globeGroup.rotation.x) * 0.05;
      globeGroup.rotation.y += (rotationRef.current.y - globeGroup.rotation.y) * 0.05;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const onMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDragging = true;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseRef.current.isDragging) return;
      const deltaX = e.clientX - mouseRef.current.x;
      const deltaY = e.clientY - mouseRef.current.y;
      rotationRef.current.y += deltaX * 0.008;
      rotationRef.current.x += deltaY * 0.008;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const onMouseUp = () => {
      mouseRef.current.isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hops, threatScore]);

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
    />
  );
};
