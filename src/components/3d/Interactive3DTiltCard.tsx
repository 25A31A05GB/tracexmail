import React, { useRef, useState, useCallback } from 'react';

interface Interactive3DTiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number; // max tilt in degrees (default 10)
  glareOpacity?: number; // glare intensity (default 0.25)
  perspective?: number; // perspective in px (default 1000)
  scaleOnHover?: number; // scale on hover (default 1.02)
  allowSelectText?: boolean;
  onClick?: () => void;
  id?: string;
}

/**
 * Interactive 3D Tilt Card
 * Uses CSS 3D Transforms with hardware-accelerated perspective,
 * cursor-relative rotation angles, and dynamic specular glare.
 * Child elements with `.depth-layer-1`, `.depth-layer-2` will float outward in Z-space.
 */
export const Interactive3DTiltCard: React.FC<Interactive3DTiltCardProps> = ({
  children,
  className = '',
  maxTilt = 8,
  glareOpacity = 0.2,
  perspective = 1000,
  scaleOnHover = 1.015,
  allowSelectText = true,
  onClick,
  id
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  const [glarePos, setGlarePos] = useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalize coordinates from -1 to 1
    const xPct = (x / rect.width) * 2 - 1;
    const yPct = (y / rect.height) * 2 - 1;

    // Invert Y for standard natural 3D tilt
    const rotX = -yPct * maxTilt;
    const rotY = xPct * maxTilt;

    setTransform(`perspective(${perspective}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scaleOnHover}, ${scaleOnHover}, ${scaleOnHover})`);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: glareOpacity
    });
  }, [maxTilt, perspective, scaleOnHover, glareOpacity]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTransform(`perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`);
    setGlarePos(prev => ({ ...prev, opacity: 0 }));
  }, [perspective]);

  return (
    <div
      id={id}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform,
        transformStyle: 'preserve-3d',
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        willChange: 'transform'
      }}
      className={`relative overflow-hidden ${allowSelectText ? 'select-text' : 'select-none'} ${className}`}
    >
      {/* Specular glare overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 320px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glarePos.opacity}), transparent 70%)`,
          opacity: glarePos.opacity > 0 ? 1 : 0
        }}
      />
      {/* Ambient 3D rim highlight */}
      <div 
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          boxShadow: isHovered 
            ? 'inset 0 0 0 1px rgba(96, 165, 250, 0.3), 0 20px 35px -10px rgba(0, 0, 0, 0.7)' 
            : 'none'
        }}
      />
      {children}
    </div>
  );
};
