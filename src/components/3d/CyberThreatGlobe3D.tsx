import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EmailHop } from '../../types';

interface CyberThreatGlobe3DProps {
  hops?: EmailHop[];
  threatScore?: number;
  className?: string;
  onSelectHop?: (hop: EmailHop) => void;
}

export const CyberThreatGlobe3D: React.FC<CyberThreatGlobe3DProps> = ({
  hops = [],
  threatScore = 50,
  className = '',
  onSelectHop
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 380;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // Wireframe Globe Sphere
    const globeGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const globeMat = new THREE.MeshStandardMaterial({
      color: 0x2d2820,
      emissive: 0x1f1a14,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);

    // Hop Nodes on Globe
    const hopGroup = new THREE.Group();
    scene.add(hopGroup);

    const latLngToVector3 = (lat: number, lng: number, radius: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    // Default sample coordinates if hop location is missing
    const defaultCoords = [
      { lat: 37.7749, lng: -122.4194 },
      { lat: 51.5074, lng: -0.1278 },
      { lat: 55.7558, lng: 37.6173 },
      { lat: 35.6762, lng: 139.6503 }
    ];

    const hopMeshes: { mesh: THREE.Mesh; hop: EmailHop }[] = [];

    hops.forEach((hop, idx) => {
      const coord = defaultCoords[idx % defaultCoords.length];
      const pos = latLngToVector3(coord.lat, coord.lng, 1.52);

      const nodeGeo = new THREE.SphereGeometry(0.06, 16, 16);
      const isMalicious = (hop.delaySec ?? 0) > 10 || idx === 0;
      const nodeMat = new THREE.MeshStandardMaterial({
        color: isMalicious ? 0xef4444 : 0x10b981,
        emissive: isMalicious ? 0xef4444 : 0x10b981,
        emissiveIntensity: 0.8
      });

      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(pos);
      mesh.userData = { hop };
      hopGroup.add(mesh);
      hopMeshes.push({ mesh, hop });
    });

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      globeMesh.rotation.y += deltaMove.x * 0.008;
      globeMesh.rotation.x += deltaMove.y * 0.008;
      hopGroup.rotation.y += deltaMove.x * 0.008;
      hopGroup.rotation.x += deltaMove.y * 0.008;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDragging = false; };

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(hopMeshes.map(h => h.mesh));
      if (intersects.length > 0 && onSelectHop) {
        const hit = intersects[0].object;
        if (hit.userData?.hop) {
          onSelectHop(hit.userData.hop);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    dom.addEventListener('click', handleClick);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isDragging) {
        globeMesh.rotation.y += 0.003;
        hopGroup.rotation.y += 0.003;
      }
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
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
    };
  }, [hops, threatScore, onSelectHop]);

  return <div ref={mountRef} className={`w-full h-full cursor-grab active:cursor-grabbing ${className}`} />;
};
