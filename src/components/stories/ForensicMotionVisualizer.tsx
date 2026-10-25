import React, { useEffect, useRef } from 'react';
import { StoryFilm, StoryChapter, StoryLanguageCode } from '../../utils/storiesManifest';
import { VttCue } from '../../utils/vttParser';
import { Shield, AlertTriangle, CheckCircle2, Lock, Cpu, Globe, Server, FileCheck } from 'lucide-react';

interface ForensicMotionVisualizerProps {
  film: StoryFilm;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeChapter: StoryChapter | null;
  activeCue: VttCue | null;
  currentLang: StoryLanguageCode;
  onSeek: (time: number) => void;
}

export function ForensicMotionVisualizer({
  film,
  currentTime,
  duration,
  isPlaying,
  activeChapter,
  activeCue,
  currentLang,
  onSeek
}: ForensicMotionVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Determine active chapter index (0, 1, 2, 3...)
  const chapters = film.chapters || [];
  const currentChapterIdx = Math.max(
    0,
    chapters.findIndex((c) => c.title === activeChapter?.title)
  );
  const sceneIdx = currentChapterIdx % 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let timeOffset = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear with deep cinema obsidian
      ctx.fillStyle = '#0b0a08';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Subtle Cybernetic Background Grid
      ctx.strokeStyle = 'rgba(58, 53, 44, 0.35)';
      ctx.lineWidth = 1;
      const gridSize = 36;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Ambient Radar Sweep Ring in Center
      const centerX = width / 2;
      const centerY = height / 2 - 20;
      const progressRatio = duration > 0 ? currentTime / duration : 0;
      timeOffset += isPlaying ? 0.02 : 0.003;

      const sweepAngle = (timeOffset * 1.5) % (Math.PI * 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 140, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.12)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.18)';
      ctx.stroke();

      // Sweep gradient arm
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, 140, sweepAngle, sweepAngle + 0.35);
      ctx.closePath();
      ctx.fillStyle = 'rgba(201, 162, 39, 0.08)';
      ctx.fill();
      ctx.restore();

      // 4. Render Scene Visuals based on sceneIdx
      if (sceneIdx === 0) {
        // SCENE 1: The Envelope Flaw & Deceptive Sender
        renderScene1(ctx, width, height, timeOffset);
      } else if (sceneIdx === 1) {
        // SCENE 2: RFC 822 Hop Tracing & Postal Stamps
        renderScene2(ctx, width, height, timeOffset, currentTime);
      } else if (sceneIdx === 2) {
        // SCENE 3: The Wax Seal & DKIM Signature Verification
        renderScene3(ctx, width, height, timeOffset);
      } else {
        // SCENE 4: Forensic Verdict & Certified Evidence Dossier
        renderScene4(ctx, width, height, timeOffset);
      }

      // 5. High-tech Crosshairs at Corners
      drawReticle(ctx, 40, 40);
      drawReticle(ctx, width - 40, 40);
      drawReticle(ctx, 40, height - 70);
      drawReticle(ctx, width - 40, height - 70);

      // 6. Running Telemetry Feed at Bottom
      renderTelemetryFeed(ctx, width, height, currentTime, sceneIdx);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentTime, duration, isPlaying, sceneIdx]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none bg-[#0b0a08]">
      {/* 60 FPS Visual Canvas */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        className="w-full h-full object-contain"
      />

      {/* Top Overlay: Active Scene Badge & Non-Technical Insight */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10 text-xs font-mono">
        <div className="flex items-center gap-2 bg-[#14120f]/90 border border-[#3a352c] px-3 py-1.5 rounded-[3px] shadow-md backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#c9a227] animate-pulse" />
          <span className="text-[#c9a227] font-semibold uppercase tracking-wider">
            {sceneIdx === 0 && 'CHAPTER I: ENVELOPE DECONSTRUCTION'}
            {sceneIdx === 1 && 'CHAPTER II: RFC 822 MTA HOP TRACING'}
            {sceneIdx === 2 && 'CHAPTER III: CRYPTOGRAPHIC WAX SEAL'}
            {sceneIdx === 3 && 'CHAPTER IV: CERTIFIED EVIDENCE DOSSIER'}
          </span>
          <span className="text-[#8a8070] hidden sm:inline">|</span>
          <span className="text-[#ede6d8] hidden sm:inline">
            {activeChapter?.title || 'Forensic Case Reconstruction'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 bg-[#14120f]/90 border border-[#3a352c] px-2.5 py-1 rounded-[3px] text-[10px] text-[#8a8070]">
            <Cpu className="w-3 h-3 text-[#c9a227]" />
            FORENSIC SIMULATION · 60 FPS
          </span>
        </div>
      </div>

      {/* Synchronized Subtitles (Closed Captions) Box */}
      {activeCue && (
        <div className="absolute bottom-14 inset-x-4 sm:inset-x-12 z-20 flex justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="max-w-2xl px-5 py-2.5 bg-[#100e0c]/95 border border-[#c9a227]/40 rounded-[4px] shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md text-center">
            <span className="inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#28241c] text-[#c9a227] rounded mr-2 align-middle">
              {currentLang.toUpperCase()}
            </span>
            <span className="text-sm sm:text-base font-serif text-[#ede6d8] leading-relaxed drop-shadow-sm align-middle font-medium">
              "{activeCue.text}"
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// CANVAS SCENE DRAWING UTILITIES
// ----------------------------------------------------

function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.4)';
  ctx.lineWidth = 1.5;
  const s = 8;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.restore();
}

/**
 * Scene 1: The Envelope Flaw (Visible Display vs Actual RFC 822 Envelope)
 */
function renderScene1(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  const cy = h / 2 - 30;

  // Draw Central Envelope Metaphor Box
  const boxW = 380;
  const boxH = 170;
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;

  // Background Box
  ctx.fillStyle = 'rgba(23, 20, 16, 0.85)';
  ctx.strokeStyle = '#3a352c';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeRect(x, y, boxW, boxH);

  // Top Section: Visible Email Header (The Illusion)
  ctx.fillStyle = 'rgba(40, 36, 28, 0.6)';
  ctx.fillRect(x, y, boxW, 55);

  ctx.font = '11px monospace';
  ctx.fillStyle = '#8a8070';
  ctx.fillText('VISIBLE DISPLAY HEADER (WHAT YOUR INBOX SHOWS)', x + 16, y + 22);

  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#ede6d8';
  ctx.fillText('From: Sarah Jenkins <sarah@acme-corp.com>', x + 16, y + 42);

  // Divider
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 55);
  ctx.lineTo(x + boxW, y + 55);
  ctx.stroke();

  // Scanning laser beam sweeping down
  const scanY = y + 55 + ((Math.sin(t * 3) + 1) / 2) * (boxH - 55);
  ctx.fillStyle = 'rgba(201, 162, 39, 0.15)';
  ctx.fillRect(x, scanY - 6, boxW, 12);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, scanY);
  ctx.lineTo(x + boxW, scanY);
  ctx.stroke();

  // Bottom Section: The Hidden Digital Envelope (The Truth)
  ctx.font = '11px monospace';
  ctx.fillStyle = '#c9a227';
  ctx.fillText('HIDDEN DIGITAL ENVELOPE (DISCLOSED BY TRACEXMAIL)', x + 16, y + 80);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#ede6d8';
  ctx.fillText('True Sender IP: 185.220.101.45 [Adversary Relay]', x + 16, y + 102);

  ctx.fillStyle = '#ef4444';
  ctx.fillText('RFC 5321.MailFrom: billing-spoof@shadow-route.ru', x + 16, y + 122);

  ctx.fillStyle = '#8a8070';
  ctx.fillText('Cryptographic Wax Seal: UNVERIFIED / FORGED', x + 16, y + 142);

  // Warning Badge on Right
  const badgeX = x + boxW - 85;
  const badgeY = y + 18;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.fillRect(badgeX, badgeY, 70, 22);
  ctx.strokeRect(badgeX, badgeY, 70, 22);
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('SPOOFED', badgeX + 11, badgeY + 15);
}

/**
 * Scene 2: RFC 822 MTA Hop Tracing & Postal Stamps
 */
function renderScene2(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, currentTime: number) {
  const cy = h / 2 - 25;
  const startX = 140;
  const endX = w - 140;
  const nodes = [
    { label: 'Origin Server', ip: '185.220.101.45', asn: 'AS9009 (Russia)', stamp: '#1 ORIGIN' },
    { label: 'Relay MTA', ip: '84.17.44.12', asn: 'AS24940 (Germany)', stamp: '#2 TRANSIT' },
    { label: 'Gateway MX', ip: '198.51.100.14', asn: 'AS15169 (Corporate)', stamp: '#3 BORDER' },
    { label: 'Recipient Inbox', ip: '10.0.4.12', asn: 'Internal Subnet', stamp: '#4 DELIVERED' }
  ];

  const stepX = (endX - startX) / (nodes.length - 1);

  // Connect nodes with cyber line
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, cy);
  ctx.lineTo(endX, cy);
  ctx.stroke();

  // Packet hopping animation
  const hopProgress = (t * 1.5) % 3;
  const packetX = startX + hopProgress * stepX;
  ctx.save();
  ctx.beginPath();
  ctx.arc(packetX, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#c9a227';
  ctx.shadowColor = '#c9a227';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.restore();

  // Draw each node
  nodes.forEach((node, i) => {
    const nx = startX + i * stepX;
    const isOrigin = i === 0;

    // Node Circle
    ctx.beginPath();
    ctx.arc(nx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = isOrigin ? 'rgba(239, 68, 68, 0.25)' : 'rgba(23, 20, 16, 0.9)';
    ctx.strokeStyle = isOrigin ? '#ef4444' : '#c9a227';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Node Label
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ede6d8';
    ctx.textAlign = 'center';
    ctx.fillText(node.label, nx, cy - 32);

    // Postal Stamp Box
    ctx.fillStyle = isOrigin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(40, 36, 28, 0.8)';
    ctx.strokeStyle = isOrigin ? '#ef4444' : '#3a352c';
    ctx.lineWidth = 1;
    ctx.fillRect(nx - 45, cy + 30, 90, 48);
    ctx.strokeRect(nx - 45, cy + 30, 90, 48);

    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = isOrigin ? '#ef4444' : '#c9a227';
    ctx.fillText(node.stamp, nx, cy + 44);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#ede6d8';
    ctx.fillText(node.ip, nx, cy + 58);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#8a8070';
    ctx.fillText(node.asn, nx, cy + 70);
  });

  ctx.textAlign = 'left';
}

/**
 * Scene 3: The Wax Seal & DKIM Signature Verification
 */
function renderScene3(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  const cy = h / 2 - 30;

  // Left Seal: Genuine Acme Corp Official Wax Seal
  const leftX = cx - 150;
  ctx.save();
  ctx.beginPath();
  ctx.arc(leftX, cy, 48, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('VERIFIED WAX SEAL', leftX, cy - 10);
  ctx.font = '12px serif';
  ctx.fillStyle = '#ede6d8';
  ctx.fillText('Acme Corp RSA', leftX, cy + 8);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#8a8070';
  ctx.fillText('dkim=pass', leftX, cy + 24);
  ctx.restore();

  // Right Seal: Attacker's Broken / Forged Stamp
  const rightX = cx + 150;
  ctx.save();
  ctx.beginPath();
  ctx.arc(rightX, cy, 48, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // Cracking animation line through seal
  ctx.beginPath();
  ctx.moveTo(rightX - 25, cy - 25);
  ctx.lineTo(rightX, cy);
  ctx.lineTo(rightX - 8, cy + 15);
  ctx.lineTo(rightX + 22, cy + 30);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('FORGED / BROKEN', rightX, cy - 10);
  ctx.font = '12px serif';
  ctx.fillStyle = '#ede6d8';
  ctx.fillText('Attacker Unsigned', rightX, cy + 8);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('dkim=fail (bad sig)', rightX, cy + 24);
  ctx.restore();

  // Center Comparison Beam
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(leftX + 55, cy);
  ctx.lineTo(rightX - 55, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center Cryptographic Comparator Box
  ctx.fillStyle = 'rgba(20, 18, 15, 0.95)';
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 1;
  ctx.fillRect(cx - 55, cy - 25, 110, 50);
  ctx.strokeRect(cx - 55, cy - 25, 110, 50);

  ctx.textAlign = 'center';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#c9a227';
  ctx.fillText('SIGNATURE CHECK', cx, cy - 10);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('MISMATCH', cx, cy + 8);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#8a8070';
  ctx.fillText('Hash rejected', cx, cy + 20);

  ctx.textAlign = 'left';
}

/**
 * Scene 4: Forensic Verdict & Certified Evidence Dossier
 */
function renderScene4(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2;
  const cy = h / 2 - 30;

  // Left: Threat Score Dial (94 / 100)
  const dialX = cx - 140;
  ctx.save();
  ctx.beginPath();
  ctx.arc(dialX, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('94', dialX, cy + 5);
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#8a8070';
  ctx.fillText('/ 100 RISK', dialX, cy + 20);
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('HIGH SEVERITY', dialX, cy + 34);
  ctx.restore();

  // Right: Certified Chain-of-Custody Dossier Stamp
  const docX = cx + 50;
  const docY = cy - 50;
  const docW = 180;
  const docH = 105;

  ctx.fillStyle = 'rgba(23, 20, 16, 0.9)';
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 1.5;
  ctx.fillRect(docX, docY, docW, docH);
  ctx.strokeRect(docX, docY, docW, docH);

  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#c9a227';
  ctx.fillText('COURT-ADMISSIBLE DOSSIER', docX + 12, docY + 20);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#ede6d8';
  ctx.fillText('SHA-256 Custody Hash:', docX + 12, docY + 38);

  ctx.font = '8px monospace';
  ctx.fillStyle = '#8a8070';
  ctx.fillText('7f83b165...e2d4b1fa', docX + 12, docY + 52);

  ctx.font = '9px monospace';
  ctx.fillStyle = '#22c55e';
  ctx.fillText('✓ RFC 822 Proof Locked', docX + 12, docY + 70);
  ctx.fillText('✓ Tamper-Evident Export', docX + 12, docY + 84);

  // Hologram seal stamp animation in corner
  const sealPulse = Math.sin(t * 4) * 2;
  ctx.beginPath();
  ctx.arc(docX + docW - 22, docY + 24, 12 + sealPulse, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
}

/**
 * Running Live Telemetry Terminal Line at Bottom
 */
function renderTelemetryFeed(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  currentTime: number,
  sceneIdx: number
) {
  const y = h - 25;
  ctx.fillStyle = 'rgba(16, 14, 12, 0.9)';
  ctx.fillRect(0, y - 10, w, 35);
  ctx.strokeStyle = '#3a352c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y - 10);
  ctx.lineTo(w, y - 10);
  ctx.stroke();

  const logs = [
    `[RFC-822] Deconstructing hidden routing headers... from mailer.adversary.net [185.220.101.45] (${currentTime.toFixed(1)}s)`,
    `[MTA-TRACE] BGP AS9009 cross-matched with known adversarial bulletproof hosting... (${currentTime.toFixed(1)}s)`,
    `[DKIM-VERIFY] Evaluating cryptographic signature against published DNS TXT record... FAILED (${currentTime.toFixed(1)}s)`,
    `[AUDIT-CHAIN] Generating deterministic evidence dossier with unalterable SHA-256 seal... (${currentTime.toFixed(1)}s)`
  ];

  ctx.font = '10px monospace';
  ctx.fillStyle = '#c9a227';
  ctx.fillText('LIVE FORENSIC TELEMETRY >', 36, y + 8);

  ctx.fillStyle = '#ede6d8';
  ctx.fillText(logs[sceneIdx] || logs[0], 210, y + 8);
}
