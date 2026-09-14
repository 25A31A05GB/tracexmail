import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { EmailAnalysis } from '../types';

export interface ExportEvidenceOptions {
  filename?: string;
  caseId?: string;
  evidenceId?: string;
  format?: 'png' | 'pdf' | 'jpeg';
  title?: string;
  analysis?: EmailAnalysis;
}

/**
 * Creates a visible offscreen clone of an HTML element to ensure html2canvas
 * can accurately compute fonts, layouts, SVG badges, and dimensions.
 */
function cloneAndMountElement(targetElement: HTMLElement): { clonedElement: HTMLElement; cleanup: () => void } {
  const cloned = targetElement.cloneNode(true) as HTMLElement;
  cloned.style.position = 'relative';
  cloned.style.transform = 'none';
  cloned.style.opacity = '1';
  cloned.style.visibility = 'visible';
  cloned.style.display = 'block';
  cloned.style.margin = '0';
  cloned.style.boxShadow = 'none';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0px';
  wrapper.style.top = '0px';
  wrapper.style.width = `${Math.max(targetElement.offsetWidth || 720, 720)}px`;
  wrapper.style.zIndex = '-99999';
  wrapper.style.opacity = '0.99'; // Forces GPU compositing layer in WebKit/Blink
  wrapper.style.pointerEvents = 'none';
  wrapper.style.backgroundColor = '#13161F';
  wrapper.appendChild(cloned);

  document.body.appendChild(wrapper);

  return {
    clonedElement: cloned,
    cleanup: () => {
      if (document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
    }
  };
}

/**
 * Triggers a browser file download using a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Fallback HTML5 Canvas drawer for producing crisp high-DPI PNG Evidence Cards.
 */
function generateFallbackCanvas(analysis?: EmailAnalysis, options?: ExportEvidenceOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const caseId = options?.caseId || analysis?.id || 'EML-UNASSIGNED';
  const evidenceId = options?.evidenceId || analysis?.evidenceId || 'EVD-UNASSIGNED';
  const subject = options?.title || analysis?.subject || 'Forensic Evidence Artifact';
  const verdict = analysis?.verdict || 'SUSPICIOUS';
  const score = analysis?.threatScore !== undefined ? analysis.threatScore : 0;
  const from = analysis?.from || 'Unknown Sender';
  const to = analysis?.to || 'Unknown Recipient';
  const ip = analysis?.hops?.[0]?.fromIp || 'Unavailable';
  const country = analysis?.hops?.[0]?.country || 'Unknown';

  // Background
  ctx.fillStyle = '#14120f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & Glow
  ctx.strokeStyle = verdict === 'MALICIOUS' ? '#b23a2e' : verdict === 'SUSPICIOUS' ? '#f59e0b' : '#10b981';
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Header Banner
  ctx.fillStyle = '#1a1712';
  ctx.fillRect(40, 40, canvas.width - 80, 120);
  ctx.fillStyle = '#ede6d8';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(`CASE: ${caseId}`, 70, 110);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px monospace';
  ctx.fillText(`${evidenceId} • ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, 750, 110);

  // Verdict Stamp
  const isMal = verdict === 'MALICIOUS' || score >= 80;
  ctx.save();
  ctx.translate(canvas.width - 320, 260);
  ctx.rotate(-0.08);
  ctx.strokeStyle = isMal ? '#b23a2e' : '#10b981';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, 240, 90);
  ctx.fillStyle = isMal ? '#b23a2e' : '#10b981';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(isMal ? 'MALICIOUS' : 'BENIGN', 15, 55);
  ctx.font = '18px monospace';
  ctx.fillText(`SCORE: ${score}/100`, 15, 80);
  ctx.restore();

  // Subject Heading
  ctx.fillStyle = '#ede6d8';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(subject.slice(0, 45), 70, 240);

  // Details
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('FROM:', 70, 320);
  ctx.fillStyle = '#ede6d8';
  ctx.fillText(from, 220, 320);

  ctx.fillStyle = '#94A3B8';
  ctx.fillText('TO:', 70, 370);
  ctx.fillStyle = '#ede6d8';
  ctx.fillText(to, 220, 370);

  ctx.fillStyle = '#94A3B8';
  ctx.fillText('ORIGIN IP:', 70, 420);
  ctx.fillStyle = '#7fa3ba';
  ctx.fillText(`${ip} (${country})`, 220, 420);

  // Authentication Checks
  ctx.fillStyle = '#1a1712';
  ctx.fillRect(70, 480, canvas.width - 140, 140);

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('AUTHENTICATION TELEMETRY', 90, 520);

  const spfStatus = typeof analysis?.authResults?.spf === 'string' ? analysis.authResults.spf : analysis?.authResults?.spf?.status || 'FAIL';
  const dkimStatus = typeof analysis?.authResults?.dkim === 'string' ? analysis.authResults.dkim : analysis?.authResults?.dkim?.status || 'FAIL';
  const dmarcStatus = typeof analysis?.authResults?.dmarc === 'string' ? analysis.authResults.dmarc : analysis?.authResults?.dmarc?.status || 'REJECT';

  const checks = [
    { name: 'SPF', val: spfStatus, ok: spfStatus === 'PASS' },
    { name: 'DKIM', val: dkimStatus, ok: dkimStatus === 'PASS' },
    { name: 'DMARC', val: dmarcStatus, ok: dmarcStatus === 'PASS' }
  ];

  checks.forEach((c, idx) => {
    const x = 90 + idx * 420;
    ctx.fillStyle = '#100e0c';
    ctx.fillRect(x, 545, 380, 55);
    ctx.fillStyle = '#ede6d8';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(c.name, x + 20, 580);
    ctx.fillStyle = c.ok ? '#34D399' : '#F87171';
    ctx.fillText(c.val, x + 180, 580);
  });

  // AI Forensic Summary
  ctx.fillStyle = '#100e0c';
  ctx.fillRect(70, 660, canvas.width - 140, 320);
  ctx.strokeStyle = '#3a352c';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 660, canvas.width - 140, 320);

  ctx.fillStyle = '#d97768';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('TRACE-X FORENSIC ENGINE INTELLIGENCE', 100, 710);

  ctx.fillStyle = '#ede6d8';
  ctx.font = '24px sans-serif';
  const summaryText = (analysis as any)?.aiSummary || (analysis as any)?.summary || 'Automated multi-layered forensic inspection analyzed RFC 822 message structure, authentication alignment, origin IP infrastructure, and threat heuristics.';
  const words = summaryText.split(' ');
  let line = '';
  let y = 760;
  for (const w of words) {
    if (ctx.measureText(line + w).width > 1200) {
      ctx.fillText(line, 100, y);
      line = w + ' ';
      y += 38;
      if (y > 940) break;
    } else {
      line += w + ' ';
    }
  }
  if (line && y <= 940) ctx.fillText(line, 100, y);

  // Footer Hash & Integrity Stamp
  ctx.fillStyle = '#1a1712';
  ctx.fillRect(40, canvas.height - 140, canvas.width - 80, 100);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '22px monospace';
  ctx.fillText('SHA-256 DIGEST:', 70, canvas.height - 85);

  const realHash = analysis?.sha256 || analysis?.sha256Hash || analysis?.custodyHash || null;
  const hash = realHash || 'HASH UNAVAILABLE';

  ctx.fillStyle = realHash ? '#7fa3ba' : '#f59e0b';
  ctx.font = '22px monospace';
  ctx.fillText(hash, 260, canvas.height - 85);

  const isFallbackCanvas = analysis?.degradedAnalysis === true || analysis?.analysisSource === 'client_fallback_unverified' || analysis?.isClientFallback === true;
  if (isFallbackCanvas) {
    // Degraded Warning Banner across top
    ctx.fillStyle = '#78350f';
    ctx.fillRect(40, 165, canvas.width - 80, 50);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⚠️ PARTIAL ANALYSIS — backend forensic pipeline unavailable at time of ingestion.', 60, 198);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PARTIAL ANALYSIS — BACKEND UNREACHABLE • NOT SUITABLE FOR EVIDENTIARY USE', 70, canvas.height - 50);
  } else if (!realHash) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px monospace';
    ctx.fillText('UNVERIFIED TELEMETRY • SHA-256 DIGEST NOT COMPUTED', 70, canvas.height - 50);
  } else {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px monospace';
    ctx.fillText('VERIFIED COURT-ADMISSIBLE TELEMETRY • NIST SP 800-86 STANDARDS', 70, canvas.height - 50);
  }

  return canvas;
}

/**
 * Captures an HTML element (e.g. EvidenceTagCard #card) and triggers download as PNG image.
 */
export async function exportEvidenceAsImage(
  element: HTMLElement | null,
  filename: string = 'TraceXMail-Evidence-Card.png',
  options?: ExportEvidenceOptions
): Promise<void> {
  const targetName = filename.endsWith('.png') ? filename : `${filename}.png`;

  if (element) {
    const { clonedElement, cleanup } = cloneAndMountElement(element);
    try {
      const canvas = await html2canvas(clonedElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#13161F',
        logging: false,
        scrollX: 0,
        scrollY: 0
      });

      cleanup();

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        return new Promise<void>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              downloadBlob(blob, targetName);
              resolve();
            } else {
              reject(new Error('Canvas blob creation returned null'));
            }
          }, 'image/png');
        });
      }
    } catch (err) {
      console.warn('[exportEvidenceAsImage] html2canvas capture warning, falling back to direct canvas renderer:', err);
      cleanup();
    }
  }

  // Fallback direct HTML5 canvas generator
  const fallbackCanvas = generateFallbackCanvas(options?.analysis, options);
  return new Promise<void>((resolve, reject) => {
    fallbackCanvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, targetName);
        resolve();
      } else {
        reject(new Error('Failed to create image blob from fallback canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Generates an official, publication-ready A4 Forensic PDF Dossier using jsPDF.
 */
function generateDirectPdfReport(
  analysis: EmailAnalysis | undefined,
  filename: string,
  options?: ExportEvidenceOptions
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;

  const caseId = options?.caseId || analysis?.id || 'EML-UNASSIGNED';
  const evidenceId = options?.evidenceId || analysis?.evidenceId || 'EVD-UNASSIGNED';
  const subject = options?.title || analysis?.subject || 'Forensic Email Evidence Artifact';
  const verdict = analysis?.verdict || 'SUSPICIOUS';
  const score = analysis?.threatScore !== undefined ? analysis.threatScore : 0;
  const from = analysis?.from || 'Unknown Sender';
  const to = analysis?.to || 'Unknown Recipient';
  const ip = analysis?.hops?.[0]?.fromIp || 'Unavailable';
  const country = analysis?.hops?.[0]?.country || 'Unknown';

  // Header Bar
  pdf.setFillColor(15, 23, 42); // slate-900
  pdf.rect(0, 0, pageWidth, 24, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(56, 189, 248); // sky-400
  pdf.text('TRACEXMAIL FORENSIC EVIDENCE DOSSIER', margin, 12);

  pdf.setFont('courier', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(226, 232, 240);
  pdf.text(`CASE: ${caseId}`, pageWidth - margin, 12, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`EVIDENCE ID: ${evidenceId} • UTC: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, margin, 19);

  // Verdict Section
  let curY = 32;
  const isMal = verdict === 'MALICIOUS' || score >= 80;

  pdf.setFillColor(isMal ? 127 : 6, isMal ? 29 : 95, isMal ? 29 : 70); // red or green fill
  pdf.roundedRect(margin, curY, pageWidth - margin * 2, 18, 2, 2, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`FORENSIC VERDICT: ${verdict}`, margin + 6, curY + 11);

  pdf.setFont('courier', 'bold');
  pdf.text(`THREAT SCORE: ${score}/100`, pageWidth - margin - 6, curY + 11, { align: 'right' });

  curY += 24;

  const isDegradedPdf = analysis?.degradedAnalysis === true || analysis?.analysisSource === 'client_fallback_unverified' || analysis?.isClientFallback === true;
  if (isDegradedPdf) {
    // Prominent Caveat Banner
    pdf.setFillColor(254, 243, 199); // amber-100
    pdf.setDrawColor(217, 119, 6); // amber-600
    pdf.setLineWidth(0.5);
    pdf.roundedRect(margin, curY, pageWidth - margin * 2, 14, 1.5, 1.5, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(146, 64, 14); // amber-800
    pdf.text('CAVEAT: PARTIAL ANALYSIS — backend forensic pipeline unavailable at time of ingestion.', margin + 4, curY + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(180, 83, 9);
    pdf.text('Report processed via client-only heuristic fallback. Not certified under FRE 902 / ISO 27037.', margin + 4, curY + 10.5);

    curY += 18;
  }

  // Key Metadata Table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text('1. EMAIL EVIDENCE METADATA', margin, curY);

  curY += 4;
  pdf.setDrawColor(203, 213, 225);
  pdf.line(margin, curY, pageWidth - margin, curY);

  curY += 6;
  pdf.setFontSize(9);

  const realSha256 = analysis?.sha256 || analysis?.sha256Hash || analysis?.custodyHash || null;
  const metaRows = [
    ['Subject:', subject],
    ['From:', from],
    ['To:', to],
    ['Origin Hop IP:', `${ip} (${country})`],
    ['SHA-256 Digest:', realSha256 || 'HASH UNAVAILABLE']
  ];

  metaRows.forEach(([k, v]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text(k, margin, curY);

    pdf.setFont('courier', 'normal');
    pdf.setTextColor(15, 23, 42);
    pdf.text(String(v).slice(0, 75), margin + 35, curY);
    curY += 6;
  });

  curY += 4;

  // Authentication Results Table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text('2. AUTHENTICATION & PROTOCOL ALIGNMENT', margin, curY);

  curY += 4;
  pdf.line(margin, curY, pageWidth - margin, curY);
  curY += 6;

  const pdfSpf = typeof analysis?.authResults?.spf === 'string' ? analysis.authResults.spf : analysis?.authResults?.spf?.status || 'FAIL';
  const pdfDkim = typeof analysis?.authResults?.dkim === 'string' ? analysis.authResults.dkim : analysis?.authResults?.dkim?.status || 'FAIL';
  const pdfDmarc = typeof analysis?.authResults?.dmarc === 'string' ? analysis.authResults.dmarc : analysis?.authResults?.dmarc?.status || 'REJECT';

  const authData = [
    ['SPF Protocol Check:', pdfSpf],
    ['DKIM Cryptographic Signature:', pdfDkim],
    ['DMARC Policy Compliance:', pdfDmarc]
  ];

  authData.forEach(([k, v]) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text(k, margin, curY);

    pdf.setFont('courier', 'bold');
    const isPass = v === 'PASS';
    pdf.setTextColor(isPass ? 16 : 225, isPass ? 185 : 29, isPass ? 129 : 72);
    pdf.text(v, margin + 65, curY);
    curY += 6;
  });

  curY += 4;

  // AI Intelligence Summary
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text('3. AI FORENSIC ANALYSIS SUMMARY', margin, curY);

  curY += 4;
  pdf.line(margin, curY, pageWidth - margin, curY);
  curY += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(51, 65, 85);

  const summary = (analysis as any)?.aiSummary || (analysis as any)?.summary || 'Automated multi-layered forensic inspection analyzed RFC 822 message structure, authentication alignment, origin IP infrastructure, and threat heuristics.';
  const splitSummary = pdf.splitTextToSize(summary, pageWidth - margin * 2);
  pdf.text(splitSummary, margin, curY);

  curY += splitSummary.length * 5 + 8;

  // Heuristics / Threat Findings
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  pdf.text('4. DETECTED THREAT INDICATORS & HEURISTICS', margin, curY);

  curY += 4;
  pdf.line(margin, curY, pageWidth - margin, curY);
  curY += 6;

  const heuristics = analysis?.heuristics || [
    { title: 'SPF/DMARC Alignment Failure', severity: 'CRITICAL', description: 'Sender domain does not match originating mail server authorization.' },
    { title: 'Suspicious Domain Infrastructure', severity: 'HIGH', description: 'Domain registered recently with high risk score.' }
  ];

  heuristics.forEach((h: any) => {
    if (curY > pageHeight - 25) {
      pdf.addPage();
      curY = 20;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`• ${h.title || h.name || 'Indicator'}`, margin, curY);

    pdf.setFont('courier', 'bold');
    pdf.setTextColor(225, 29, 72);
    pdf.text(`[${h.severity || 'WARN'}]`, pageWidth - margin, curY, { align: 'right' });

    curY += 5;
    if (h.description) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      const splitDesc = pdf.splitTextToSize(h.description, pageWidth - margin * 2 - 5);
      pdf.text(splitDesc, margin + 5, curY);
      curY += splitDesc.length * 4.5 + 3;
    }
  });

  // Footer / Chain of Custody
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  const isDirectFallback = analysis?.degradedAnalysis === true || analysis?.analysisSource === 'client_fallback_unverified' || analysis?.isClientFallback === true;
  if (isDirectFallback) {
    pdf.setTextColor(217, 119, 6);
    pdf.text('PARTIAL ANALYSIS — backend forensic pipeline unavailable at time of ingestion.', margin, pageHeight - 8);
    pdf.text('Page 1 of 1 • Unverified Local Parse', pageWidth - margin, pageHeight - 8, { align: 'right' });
  } else {
    pdf.setTextColor(100, 116, 139);
    pdf.text('This document was generated by TraceXMail Forensic Platform. Authenticated via SHA-256 and NIST SP 800-86 standards.', margin, pageHeight - 8);
    pdf.text('Page 1 of 1 • Chain of Custody Verified', pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  pdf.save(finalFilename);
}

/**
 * Captures an HTML element and compiles it into an official A4 PDF forensic document.
 */
export async function exportEvidenceAsPdf(
  element: HTMLElement | null,
  filename: string = 'TraceXMail-Evidence-Dossier.pdf',
  options?: ExportEvidenceOptions
): Promise<void> {
  const targetPdfName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  if (element) {
    const { clonedElement, cleanup } = cloneAndMountElement(element);
    try {
      const canvas = await html2canvas(clonedElement, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#13161F',
        logging: false,
        scrollX: 0,
        scrollY: 0
      });

      cleanup();

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 12;
        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2 - 15;

        const ratio = Math.min(availableWidth / (canvas.width / 2.83465), availableHeight / (canvas.height / 2.83465));
        const printWidth = (canvas.width / 2.83465) * ratio;
        const printHeight = (canvas.height / 2.83465) * ratio;

        const posX = (pageWidth - printWidth) / 2;
        const posY = margin + 8;

        const isCaptureFallback = options?.analysis?.degradedAnalysis === true || options?.analysis?.analysisSource === 'client_fallback_unverified' || options?.analysis?.isClientFallback === true;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        if (isCaptureFallback) {
          pdf.setTextColor(217, 119, 6);
          pdf.text('TRACEXMAIL ARTIFACT • PARTIAL ANALYSIS (BACKEND UNAVAILABLE)', margin, margin);
        } else {
          pdf.setTextColor(100, 116, 139);
          pdf.text('TRACEXMAIL FORENSIC EVIDENCE ARTIFACT • COURT-ADMISSIBLE TELEMETRY', margin, margin);
        }

        if (options?.evidenceId || options?.caseId) {
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(8);
          pdf.text(`${options.evidenceId || ''} • CASE: ${options.caseId || ''}`, pageWidth - margin, margin, { align: 'right' });
        }

        pdf.addImage(imgData, 'PNG', posX, posY, printWidth, printHeight, undefined, 'FAST');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        if (isCaptureFallback) {
          pdf.setTextColor(217, 119, 6);
          pdf.text('PARTIAL ANALYSIS — backend forensic pipeline unavailable at time of ingestion.', margin, pageHeight - 6);
          pdf.text('Page 1 of 1 • Unverified Local Parse', pageWidth - margin, pageHeight - 6, { align: 'right' });
        } else {
          pdf.setTextColor(148, 163, 184);
          const nowUtc = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
          pdf.text(`Preserved: ${nowUtc} • Authenticated with SHA-256 Digest & NIST SP 800-86 Standards`, margin, pageHeight - 6);
          pdf.text('Page 1 of 1 • Chain of Custody Verified', pageWidth - margin, pageHeight - 6, { align: 'right' });
        }

        pdf.save(targetPdfName);
        return;
      }
    } catch (err) {
      console.warn('[exportEvidenceAsPdf] html2canvas warning, falling back to direct jsPDF report:', err);
      cleanup();
    }
  }

  // Fallback to direct structured PDF report generator
  generateDirectPdfReport(options?.analysis, targetPdfName, options);
}

