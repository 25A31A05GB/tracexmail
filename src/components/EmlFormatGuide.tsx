import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Copy, 
  Check, 
  HelpCircle, 
  Code, 
  Mail, 
  Layers, 
  ShieldCheck, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Play,
  Info
} from 'lucide-react';

interface EmlFormatGuideProps {
  onLoadSampleEml?: (rawContent: string, fileName: string) => void;
  className?: string;
}

export const SAMPLE_EML_CONTENT = `From: "Acme Payroll Security Desk" <payroll-notifications@acme-security-portal.com>
To: security-analyst@enterprise-corp.com
Subject: [URGENT] Verify Direct Deposit Information Before Payroll Cycle Closes
Date: Wed, 02 Oct 2026 14:22:18 +0000
Message-ID: <payroll-verif-9941829@acme-security-portal.com>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="----=_Part_991827_883192"
Received: from mail-relay.acme-security-portal.com (185.220.101.5)
    by mx.enterprise-corp.com with ESMTP id corp-mx-77291;
    Wed, 02 Oct 2026 14:22:20 +0000
Authentication-Results: mx.enterprise-corp.com;
    spf=fail (sender IP 185.220.101.5 is unauthorized);
    dkim=fail header.d=acme-security-portal.com;
    dmarc=fail (p=quarantine)
Reply-To: security-recovery-desk@protonmail.com

------=_Part_991827_883192
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

Security Notice:
We detected an unrecognized account modification attempt on your direct deposit instructions.
To avoid payroll cancellation, verify your bank credentials immediately at:
https://acme-security-portal.com/auth/verify?session=99281

Security Operations Team
Enterprise Payroll Enclave
------=_Part_991827_883192
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

<!DOCTYPE html>
<html>
<body>
  <h2>Urgent Security Notice</h2>
  <p>We detected an unrecognized modification attempt on your direct deposit instructions.</p>
  <p><a href="https://acme-security-portal.com/auth/verify?session=99281">Click here to re-authenticate</a></p>
</body>
</html>
------=_Part_991827_883192--`;

export function EmlFormatGuide({ onLoadSampleEml, className = '' }: EmlFormatGuideProps) {
  const [activeGuideTab, setActiveGuideTab] = useState<'export' | 'anatomy' | 'sample'>('export');
  const [selectedClient, setSelectedClient] = useState<'gmail' | 'outlook' | 'apple' | 'thunderbird'>('gmail');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_EML_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_EML_CONTENT], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urgent_payroll_verification.eml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-[#14110e] border border-[#2e2820] rounded-sm overflow-hidden text-[#ede6d8] ${className}`}>
      {/* Header bar / Toggle */}
      <div 
        onClick={() => setIsExpanded(prev => !prev)}
        className="p-3.5 sm:p-4 bg-[#181410] hover:bg-[#1e1914] transition-colors cursor-pointer flex items-center justify-between gap-3 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[rgba(201,162,39,0.12)] border border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold font-mono tracking-wide text-[#ede6d8]">
                HOW AN EMAIL IS SHOWN AS .EML
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#272118] text-[#c9a227] border border-[#c9a227]/30 font-semibold font-mono">
                RFC 822 / MIME GUIDE
              </span>
            </div>
            <p className="text-[11px] text-[#9d9282] font-sans mt-0.5">
              Learn how to download .EML files from Gmail, Outlook, or Apple Mail, and inspect raw message anatomy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-[#8a8070] hidden sm:inline">
            {isExpanded ? 'Collapse Guide' : 'Expand Guide'}
          </span>
          <div className="w-6 h-6 rounded bg-[#201c16] border border-[#3a352c] flex items-center justify-center text-[#8a8070]">
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-[#2e2820] space-y-5 animate-in fade-in duration-200">
          {/* Sub Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#2e2820] pb-3">
            <button
              onClick={() => setActiveGuideTab('export')}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeGuideTab === 'export'
                  ? 'bg-[#c9a227] text-[#12100d] font-bold shadow-sm'
                  : 'bg-[#1b1712] text-[#9d9282] hover:text-[#ede6d8] border border-[#2e2820]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>1. How to Export from Inbox</span>
            </button>

            <button
              onClick={() => setActiveGuideTab('anatomy')}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeGuideTab === 'anatomy'
                  ? 'bg-[#c9a227] text-[#12100d] font-bold shadow-sm'
                  : 'bg-[#1b1712] text-[#9d9282] hover:text-[#ede6d8] border border-[#2e2820]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2. .EML File Anatomy</span>
            </button>

            <button
              onClick={() => setActiveGuideTab('sample')}
              className={`px-3 py-1.5 rounded text-xs font-medium font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeGuideTab === 'sample'
                  ? 'bg-[#c9a227] text-[#12100d] font-bold shadow-sm'
                  : 'bg-[#1b1712] text-[#9d9282] hover:text-[#ede6d8] border border-[#2e2820]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>3. Live Raw .EML Preview</span>
            </button>
          </div>

          {/* TAB 1: How to Export */}
          {activeGuideTab === 'export' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-[#8a8070]">Select email service:</span>
                <button
                  onClick={() => setSelectedClient('gmail')}
                  className={`px-2.5 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                    selectedClient === 'gmail'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                      : 'bg-[#1b1712] text-[#8a8070] border border-[#2a241c] hover:text-[#ede6d8]'
                  }`}
                >
                  Gmail / Google Workspace
                </button>
                <button
                  onClick={() => setSelectedClient('outlook')}
                  className={`px-2.5 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                    selectedClient === 'outlook'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                      : 'bg-[#1b1712] text-[#8a8070] border border-[#2a241c] hover:text-[#ede6d8]'
                  }`}
                >
                  Microsoft Outlook
                </button>
                <button
                  onClick={() => setSelectedClient('apple')}
                  className={`px-2.5 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                    selectedClient === 'apple'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                      : 'bg-[#1b1712] text-[#8a8070] border border-[#2a241c] hover:text-[#ede6d8]'
                  }`}
                >
                  Apple Mail (macOS)
                </button>
                <button
                  onClick={() => setSelectedClient('thunderbird')}
                  className={`px-2.5 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                    selectedClient === 'thunderbird'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-[#1b1712] text-[#8a8070] border border-[#2a241c] hover:text-[#ede6d8]'
                  }`}
                >
                  Thunderbird
                </button>
              </div>

              {/* Instructions per client */}
              <div className="bg-[#110e0b] border border-[#2a241c] rounded p-4 font-mono text-xs space-y-3 leading-relaxed">
                {selectedClient === 'gmail' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <Mail className="w-4 h-4" />
                      <span>Downloading .EML from Google Mail (Gmail)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-[#b9af9c] font-sans text-xs">
                      <li>
                        <strong className="text-[#ede6d8]">Open the email</strong> you wish to inspect or analyze in Gmail.
                      </li>
                      <li>
                        In the top-right corner of the email message (next to the Reply arrow), click the <strong className="text-[#ede6d8]">three vertical dots (⋮ More)</strong> menu.
                      </li>
                      <li>
                        Select <span className="font-mono text-[#c9a227] bg-[#221c15] px-1.5 py-0.5 rounded border border-[#3a352c]">Download message</span> from the dropdown list.
                      </li>
                      <li>
                        Your browser will download the raw message as a <span className="font-mono text-emerald-400">.eml</span> file containing full unstripped RFC 822 headers, DKIM signatures, and MIME boundaries.
                      </li>
                      <li>
                        <strong className="text-[#ede6d8]">Drag and drop</strong> that file directly into the TraceXMail upload zone above.
                      </li>
                    </ol>
                  </div>
                )}

                {selectedClient === 'outlook' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <Mail className="w-4 h-4" />
                      <span>Downloading .EML from Microsoft Outlook (Web &amp; Desktop)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded bg-[#181410] border border-[#2e2820]">
                        <span className="text-[11px] font-bold text-blue-300 block mb-1">Outlook on the Web (Office 365):</span>
                        <p className="text-[11px] text-[#b9af9c] font-sans leading-relaxed">
                          Open the message &gt; click the <strong>&hellip; (More actions)</strong> button &gt; choose <strong>View &gt; View message source</strong> to copy raw headers, or click <strong>Save</strong> to export as <code>.eml</code>.
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[#181410] border border-[#2e2820]">
                        <span className="text-[11px] font-bold text-blue-300 block mb-1">Outlook Desktop (Windows/Mac):</span>
                        <p className="text-[11px] text-[#b9af9c] font-sans leading-relaxed">
                          Select the email in your list &gt; click <strong>File &gt; Save As</strong> &gt; select format <strong>Outlook Message Format (.eml or .msg)</strong>. Both formats are accepted by TraceXMail!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedClient === 'apple' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                      <Mail className="w-4 h-4" />
                      <span>Downloading .EML from Apple Mail (macOS)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-[#b9af9c] font-sans text-xs">
                      <li>Select the email in Apple Mail.</li>
                      <li>Go to the top system menu: <strong className="text-[#ede6d8]">File &gt; Save As…</strong></li>
                      <li>In the Format dropdown, select <span className="font-mono text-purple-300 bg-[#221c15] px-1.5 py-0.5 rounded border border-[#3a352c]">Raw Message Source</span>.</li>
                      <li>The resulting file will have the <span className="font-mono text-emerald-400">.eml</span> extension ready for drag &amp; drop inspection.</li>
                    </ol>
                  </div>
                )}

                {selectedClient === 'thunderbird' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <Mail className="w-4 h-4" />
                      <span>Downloading .EML from Mozilla Thunderbird</span>
                    </div>
                    <p className="text-xs text-[#b9af9c] font-sans leading-relaxed">
                      Right-click the message in your message list &gt; select <strong>Save As… &gt; File</strong>, or simply drag the message directly out of Thunderbird into your file manager or into the drop area above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Anatomy & Structure */}
          {activeGuideTab === 'anatomy' && (
            <div className="space-y-3">
              <p className="text-xs text-[#b9af9c] font-sans leading-relaxed">
                An <strong>.EML</strong> file is plain-text containing standardized <strong>RFC 5322</strong> headers followed by an empty line and <strong>MIME multipart</strong> boundaries. Here is how email forensic engines break down the file:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-3 rounded bg-[#181410] border border-emerald-900/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>1. Envelope &amp; Identity Headers</span>
                  </div>
                  <p className="text-[11px] text-[#9d9282] font-sans">
                    <code>From:</code>, <code>To:</code>, <code>Subject:</code>, <code>Date:</code>, and <code>Message-ID:</code> establish message identity and creation time.
                  </p>
                </div>

                <div className="p-3 rounded bg-[#181410] border border-cyan-900/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>2. Received Transit Hops</span>
                  </div>
                  <p className="text-[11px] text-[#9d9282] font-sans">
                    Each mail transfer agent (MTA) prepends a <code>Received: from ... by ...</code> header. The bottom hop identifies the true originating IP address.
                  </p>
                </div>

                <div className="p-3 rounded bg-[#181410] border border-amber-900/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>3. Cryptographic Verification</span>
                  </div>
                  <p className="text-[11px] text-[#9d9282] font-sans">
                    <code>DKIM-Signature:</code> (RSA/Ed25519 signature) and <code>Authentication-Results:</code> prove whether sender domain was spoofed (SPF, DKIM, DMARC).
                  </p>
                </div>

                <div className="p-3 rounded bg-[#181410] border border-purple-900/40 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>4. MIME Multipart &amp; Body Payload</span>
                  </div>
                  <p className="text-[11px] text-[#9d9282] font-sans">
                    Separated by unique boundary strings (e.g., <code>--boundary_xyz</code>), holding plaintext, HTML markup, and Base64 encoded attachments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Raw Sample Preview */}
          {activeGuideTab === 'sample' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs text-[#9d9282] font-mono">
                  Standard RFC 822 format of a deceptive payroll phish (.eml payload):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded bg-[#201c16] hover:bg-[#2a241c] border border-[#3a352c] text-xs font-mono text-[#ede6d8] flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Copy raw .EML text"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[var(--slate)]" />}
                    <span>{copied ? 'Copied' : 'Copy .EML'}</span>
                  </button>

                  <button
                    onClick={handleDownloadSample}
                    className="px-2.5 py-1 rounded bg-[#201c16] hover:bg-[#2a241c] border border-[#3a352c] text-xs font-mono text-[#ede6d8] flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Download benchmark .eml file"
                  >
                    <Download className="w-3.5 h-3.5 text-[#c9a227]" />
                    <span>Download .eml</span>
                  </button>

                  {onLoadSampleEml && (
                    <button
                      onClick={() => onLoadSampleEml(SAMPLE_EML_CONTENT, 'urgent_payroll_verification.eml')}
                      className="px-3 py-1 rounded bg-[#c9a227] hover:bg-[#d8b136] text-[#12100d] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                      title="Load this .eml directly into the inspector"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Analyze this .EML</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Code block */}
              <div className="relative rounded bg-[#0d0b09] border border-[#2a241c] p-3 sm:p-4 font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto shadow-inner text-[#ede6d8] select-all">
                <pre className="whitespace-pre-wrap break-all text-[#b9af9c]">
                  {SAMPLE_EML_CONTENT}
                </pre>
              </div>
            </div>
          )}

          {/* Quick Action Footer inside guide */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#2e2820] text-xs">
            <div className="flex items-center gap-2 text-[#9d9282] font-mono text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>TraceXMail preserves full header integrity and RFC 822 cryptographic timestamps.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSample}
                className="px-3 py-1.5 rounded bg-[#1e1913] hover:bg-[#272118] border border-[#3a352c] text-[#ede6d8] text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#c9a227]" />
                <span>Save Sample .EML</span>
              </button>
              {onLoadSampleEml && (
                <button
                  onClick={() => onLoadSampleEml(SAMPLE_EML_CONTENT, 'urgent_payroll_verification.eml')}
                  className="px-3 py-1.5 rounded bg-[var(--thread)] hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Test Upload with Sample .EML</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmlFormatGuide;
