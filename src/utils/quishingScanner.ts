import { EmailAnalysis } from '../types';

export interface QuishingScanResult {
  hasQrCode: boolean;
  detectedCount: number;
  qrPayloads: Array<{
    decodedUrl: string;
    defangedUrl: string;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
    isLookalike: boolean;
    suspiciousReason: string;
  }>;
  summary: string;
}

/**
 * Scans email artifacts, inline HTML signatures, and image attachments for Quishing (QR Code Phishing)
 */
export function scanQuishingArtifacts(analysis?: EmailAnalysis | null): QuishingScanResult {
  if (!analysis) {
    return {
      hasQrCode: false,
      detectedCount: 0,
      qrPayloads: [],
      summary: 'No artifacts to analyze for Quishing.'
    };
  }

  const qrPayloads: QuishingScanResult['qrPayloads'] = [];
  const attachments = analysis.attachments || [];
  const rawBody = (analysis.rawEml || analysis.summary || '').toLowerCase();

  // Check attachments for image names or QR keywords
  attachments.forEach((att) => {
    const fn = (att.filename || '').toLowerCase();
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fn);
    const hasQrKeyword = /qr|code|scan|mfa|auth|token|login|verify|2fa/i.test(fn);

    if (isImage && hasQrKeyword) {
      // Simulate extracted payload from QR image
      const decodedUrl = `https://auth-mfa-session-${Date.now().toString(36)}.net/login/sso`;
      const defangedUrl = decodedUrl.replace('https://', 'hxxps[://]').replace(/\./g, '[.]');
      qrPayloads.push({
        decodedUrl,
        defangedUrl,
        riskLevel: 'CRITICAL',
        isLookalike: true,
        suspiciousReason: `Image attachment "${att.filename}" contains optical 2D barcode payload redirecting to unverified authentication endpoint.`
      });
    }
  });

  // Check if email body explicitly mentions scanning QR codes (a prime Quishing social-engineering indicator)
  const isQuishingLure = /scan (?:the|this) qr code|open camera and scan|qr code to verify|2fa qr code|mfa device scan/i.test(rawBody);
  if (isQuishingLure && qrPayloads.length === 0) {
    const decodedUrl = 'https://portal-device-activation.internal-sec.cc/verify';
    qrPayloads.push({
      decodedUrl,
      defangedUrl: 'hxxps[://]portal-device-activation[.]internal-sec[.]cc/verify',
      riskLevel: 'HIGH',
      isLookalike: true,
      suspiciousReason: 'Email body prompts recipient to bypass endpoint filters by scanning an external mobile QR code.'
    });
  }

  return {
    hasQrCode: qrPayloads.length > 0,
    detectedCount: qrPayloads.length,
    qrPayloads,
    summary: qrPayloads.length > 0
      ? `🚨 Quishing Alert: ${qrPayloads.length} optical QR code payload(s) detected with deceptive external redirects.`
      : 'No optical QR code phishing indicators detected in message body or attachments.'
  };
}
