import React, { useEffect, useRef, useState } from 'react';

// Lightweight GPU-friendly vertex shader for full-screen quad
const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Organic smooth simplex-like noise fragment shader tuned to TraceXMail's dark forensic palette
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  // Simple pseudo-random hash
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  // Simplex-inspired 2D gradient noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                   dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                   dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;

    // Very slow, controlled organic flow
    float t = u_time * 0.12;

    // Layered fbm coordinates
    vec2 q = vec2(0.0);
    q.x = noise(st * 1.5 + vec2(t * 0.2, -t * 0.15));
    q.y = noise(st * 1.5 + vec2(-t * 0.1, t * 0.2));

    vec2 r = vec2(0.0);
    r.x = noise(st * 2.2 + 2.0 * q + vec2(1.7, 9.2) + 0.15 * t);
    r.y = noise(st * 2.2 + 2.0 * q + vec2(8.3, 2.8) + 0.126 * t);

    float f = noise(st * 1.8 + r);

    // TraceXMail Brand Color Harmonies:
    // Base: dark soot #14120f
    vec3 cBase = vec3(0.078, 0.070, 0.059);
    // Subtle Crimson Accent #b23a2e (deepened)
    vec3 cCrimson = vec3(0.24, 0.07, 0.05);
    // Muted Burnished Amber #c9a227 (deepened)
    vec3 cAmber = vec3(0.22, 0.17, 0.04);
    // Telemetry Charcoal/Cyan #0d1a18
    vec3 cCyan = vec3(0.05, 0.10, 0.09);

    // Color mixing based on organic field
    vec3 color = mix(cBase, cCrimson, clamp(f * f * 2.0, 0.0, 1.0));
    color = mix(color, cAmber, clamp(length(q) * 0.7, 0.0, 1.0));
    color = mix(color, cCyan, clamp(length(r.x) * 0.4, 0.0, 1.0));

    // Vignette towards edges to keep content readable
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float vignette = uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y) * 15.0;
    vignette = clamp(pow(vignette, 0.4), 0.0, 1.0);

    // Master alpha kept at ~0.35 so dark background remains crisp
    gl_FragColor = vec4(color, 0.35 * vignette);
  }
`;

export function ShaderGradientHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Check reduced-motion preference
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);

      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const gl = (canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' }) ||
      canvas.getContext('experimental-webgl', { alpha: true })) as WebGLRenderingContext | null;

    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    // Compile shader helper
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[TraceXMail Shader] Compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    if (!vertShader || !fragShader) {
      setWebGlSupported(false);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebGlSupported(false);
      return;
    }

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[TraceXMail Shader] Program link error:', gl.getProgramInfoLog(program));
      setWebGlSupported(false);
      return;
    }

    gl.useProgram(program);

    // Full screen quad geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uResLoc = gl.getUniformLocation(program, 'u_resolution');
    const uMouseLoc = gl.getUniformLocation(program, 'u_mouse');

    let animationFrameId: number;
    let isVisible = true;
    let startTime = performance.now();

    const resize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap at 1.5 to save mobile GPU
      const width = Math.max(320, Math.floor(rect.width * dpr));
      const height = Math.max(320, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Pause rendering when Hero is off-screen using IntersectionObserver
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Render loop
    const render = (time: number) => {
      if (isVisible) {
        const elapsed = (time - startTime) * 0.001;
        gl.uniform1f(uTimeLoc, elapsed);
        gl.uniform2f(uResLoc, canvas.width, canvas.height);
        gl.uniform2f(uMouseLoc, 0.5, 0.5);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
      if (gl) {
        gl.deleteBuffer(positionBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
      }
    };
  }, [reducedMotion]);

  // Graceful fallback for reduced-motion or WebGL-unsupported environments
  if (reducedMotion || !webGlSupported) {
    return (
      <div
        className="absolute inset-0 pointer-events-none -z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_750px_420px_at_75%_15%,rgba(178,58,46,0.14),transparent_65%),radial-gradient(ellipse_600px_350px_at_25%_85%,rgba(201,162,39,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#14120f]/40 to-[#14120f]" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none -z-0 overflow-hidden w-full h-full"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-70 transition-opacity duration-1000"
      />
      {/* Subtle blend gradient overlays for contrast and readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#14120f]/30 to-[#14120f]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#14120f_90%)]" />
    </div>
  );
}
