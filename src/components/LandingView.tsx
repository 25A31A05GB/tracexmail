import React from 'react';
import { Shield, ArrowRight, Activity, Terminal } from 'lucide-react';
import { SAMPLE_ANALYSES } from '../data/samples';
import { EmailAnalysis } from '../types';

interface LandingViewProps {
  onOpenConsole: () => void;
  onOpenTrace: () => void;
  onRequestAccess?: () => void;
  onSelectCase?: (analysis: EmailAnalysis) => void;
}

export function LandingView({
  onOpenConsole,
  onOpenTrace,
  onRequestAccess,
  onSelectCase
}: LandingViewProps) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCaseRowClick = (caseIndex: number) => {
    const target = SAMPLE_ANALYSES[caseIndex] || SAMPLE_ANALYSES[0];
    if (onSelectCase) {
      onSelectCase(target);
    }
    onOpenConsole();
  };

  return (
    <div className="relative min-h-screen w-full bg-[var(--ink)] text-[var(--paper)] overflow-y-auto selection:bg-[var(--thread)] selection:text-[var(--paper)]">
      {/* Global Grain Filter */}
      <svg width="0" height="0" className="absolute">
        <filter id="landingGrainFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
        </filter>
      </svg>
      <div
        className="grain"
        style={{ filter: 'url(#landingGrainFilter)', background: '#fff' }}
      />

      {/* Top Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-[rgba(20,18,15,0.92)] backdrop-blur-md border-b border-[var(--line)]">
        <div className="max-w-[var(--maxw)] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[22px] h-[22px] border-[1.5px] border-[var(--thread)] rounded-full relative shrink-0">
              <div className="absolute inset-[5px] rounded-full bg-[var(--thread)]" />
            </div>
            <span className="font-display text-[19px] font-bold text-[var(--paper)] tracking-tight">
              TraceXMail
            </span>
            <span className="text-[var(--paper-dim)] text-[11px] tracking-wider mono ml-1">
              CASE-XM-01
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-[14.5px]">
            <button
              onClick={() => scrollToSection('pipeline')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              How it works
            </button>
            <button
              onClick={() => scrollToSection('product')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              Product
            </button>
            <button
              onClick={() => scrollToSection('exhibits')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              Under the hood
            </button>
            <button
              onClick={() => scrollToSection('roles')}
              className="text-[var(--paper-dim)] hover:text-[var(--paper)] transition-colors cursor-pointer bg-transparent border-0"
            >
              For your team
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenConsole}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius)] text-xs font-semibold border border-[var(--line)] hover:border-[var(--paper-dim)] bg-[var(--ink-2)] text-[var(--paper)] transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-[var(--slate)]" />
              <span>Operator Sign In</span>
            </button>
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="nav-cta"
            >
              Request Access
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-24 pb-20 border-b border-[var(--line)] overflow-hidden bg-[radial-gradient(ellipse_700px_380px_at_78%_8%,rgba(178,58,46,0.07),transparent_60%),var(--ink)]">
        <div className="max-w-[var(--maxw)] mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center relative z-10">
          <div>
            <div className="text-[var(--slate)] text-[13.5px] mb-4.5 flex items-center gap-2.5 font-medium">
              <span className="w-5.5 h-px bg-[var(--slate)] inline-block" />
              <span>Email forensic intelligence</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[50px] leading-[1.12] font-bold tracking-tight text-[var(--paper)] max-w-[14ch]">
              Every phishing email leaves a trail. We follow it to the source.
            </h1>

            <p className="mt-6 text-[var(--paper-dim)] text-[16.5px] leading-relaxed max-w-[46ch]">
              TraceXMail reconstructs an email&apos;s real path — headers, authentication, hops, and infrastructure — into evidence your SOC can act on and defend in front of whoever asks how you know.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 mt-8.5">
              <button
                onClick={onOpenConsole}
                className="btn-primary flex items-center gap-2"
              >
                <span>Launch SOC Console</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenTrace}
                className="btn-secondary"
              >
                Walk through a trace
              </button>
            </div>

            <div className="mt-7.5 text-[13.5px] text-[var(--paper-dim)] max-w-[40ch] border-l-2 border-[var(--line)] pl-3.5">
              Built for security teams who need to prove what happened — not guess at it.
            </div>
          </div>

          {/* Evidence Board (Hero Visual) */}
          <div className="board" aria-hidden="true">
            <svg className="threads" viewBox="0 0 400 440">
              <path className="board-path" d="M 60 106 C 120 78, 155 66, 196 76 C 246 88, 274 138, 306 186" />
              <path className="board-path" d="M 196 76 C 205 148, 196 200, 232 224" style={{ animationDelay: '.15s' }} />
              <path className="board-path" d="M 306 186 C 256 236, 200 268, 116 300" style={{ animationDelay: '.3s' }} />
            </svg>

            {/* Pinned Index Cards */}
            <div className="card card1">
              <div className="pin" />
              <div className="index-card">
                <div className="k">185.220.101.5</div>
                <div className="v">TOR EXIT NODE</div>
                <div className="bar"><i style={{ width: '92%' }} /></div>
              </div>
            </div>

            <div className="card card2">
              <div className="pin" />
              <div className="index-card">
                <div className="k">SPF · SOFTFAIL</div>
                <div className="v">UNAUTHORIZED SENDER</div>
                <div className="bar"><i style={{ width: '70%' }} /></div>
              </div>
            </div>

            <div className="card card3">
              <div className="pin" />
              <div className="index-card">
                <div className="k">AS200548</div>
                <div className="v">BULGARIA · ZETTAHOST</div>
                <div className="bar"><i style={{ width: '55%' }} /></div>
              </div>
            </div>

            <div className="card card4">
              <div className="pin" />
              <div className="index-card">
                <div className="k">paypal-secure-update.com</div>
                <div className="v">TYPOSQUAT DOMAIN</div>
                <div className="bar"><i style={{ width: '88%' }} /></div>
              </div>
            </div>

            {/* Circular Rubber Stamp */}
            <div className="stamp">
              VERDICT<br />PHISHING<br />CONFIRMED
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline Section */}
      <section className="py-22 border-b border-[var(--line)]" id="pipeline">
        <div className="max-w-[var(--maxw)] mx-auto px-8">
          <div className="max-w-[640px] mb-13">
            <h2 className="font-display text-3xl sm:text-[34px] text-[var(--paper)] font-bold tracking-tight">
              From inbox to verdict
            </h2>
            <p className="text-[var(--paper-dim)] mt-3.5 text-[15.5px] max-w-[52ch]">
              Six stages, run on every email, in the same order every time — so two analysts looking at the same message reach the same conclusion.
            </p>
          </div>

          <div className="pipeline-track">
            <div className="stage">
              <div className="stage-num">1</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Ingest</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                An email arrives — uploaded directly or synced live from a connected Gmail inbox.
              </p>
            </div>

            <div className="stage">
              <div className="stage-num">2</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Header forensics</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                Received chains, Message-ID, and Return-Path are parsed and checked for tampering.
              </p>
            </div>

            <div className="stage">
              <div className="stage-num">3</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Authentication</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                SPF, DKIM, DMARC, and ARC verified live against DNS — never assumed.
              </p>
            </div>

            <div className="stage">
              <div className="stage-num">4</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Origin &amp; geolocation</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                The real sending host and its place on the map, with untrusted hops excluded rather than guessed.
              </p>
            </div>

            <div className="stage">
              <div className="stage-num">5</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Correlation</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                Matched against other cases to surface a campaign, not just one message.
              </p>
            </div>

            <div className="stage">
              <div className="stage-num">6</div>
              <h3 className="font-sans font-semibold text-[15.5px] text-[var(--paper)] mb-2">Verdict</h3>
              <p className="text-[var(--paper-dim)] text-[13.8px] leading-relaxed">
                A forensic report with evidence IDs behind it, ready to hand to anyone who asks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Mockup Section */}
      <section className="py-22 border-b border-[var(--line)]" id="product">
        <div className="max-w-[var(--maxw)] mx-auto px-8">
          <div className="max-w-[640px] mb-13">
            <h2 className="font-display text-3xl sm:text-[34px] text-[var(--paper)] font-bold tracking-tight">
              What your analysts actually open
            </h2>
            <p className="text-[var(--paper-dim)] mt-3.5 text-[15.5px] max-w-[52ch]">
              The board on the left is the idea. This is the tool — the same cases, the same evidence, laid out for someone working a queue, not admiring a metaphor.
            </p>
          </div>

          <div className="mockup-wrap cursor-pointer" onClick={onOpenConsole}>
            <div className="mockup-chrome">
              <div className="mockup-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="mockup-url flex items-center justify-between">
                <span>app.tracexmail.io/cases/case-2291</span>
                <span className="text-[10px] text-[var(--slate)] font-sans uppercase font-bold tracking-wider">
                  Click to open live console →
                </span>
              </div>
            </div>

            <div className="mockup-body">
              <div className="mockup-side">
                <i className="on" />
                <i />
                <i />
                <i />
                <i />
              </div>

              <div className="mockup-main">
                <div className="mockup-stats">
                  <div className="mstat red">
                    <div className="lbl">Open cases</div>
                    <div className="num">14</div>
                  </div>
                  <div className="mstat">
                    <div className="lbl">Threat clusters</div>
                    <div className="num">3</div>
                  </div>
                  <div className="mstat blue">
                    <div className="lbl">Avg. threat score</div>
                    <div className="num">71</div>
                  </div>
                </div>

                <div className="mrow head">
                  <div>Case</div>
                  <div>Subject</div>
                  <div>Severity</div>
                  <div className="text-right">Score</div>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); handleCaseRowClick(0); }}
                  className="mrow hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="cid">CASE-2291</div>
                  <div className="subj">Urgent: Updated Direct Deposit Routing</div>
                  <div><span className="badge crit">CRITICAL</span></div>
                  <div className="score">94</div>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); handleCaseRowClick(1); }}
                  className="mrow hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="cid">CASE-2288</div>
                  <div className="subj">Action Required: Verify Office 365 Password</div>
                  <div><span className="badge high">HIGH</span></div>
                  <div className="score">86</div>
                </div>

                <div
                  onClick={(e) => { e.stopPropagation(); handleCaseRowClick(2); }}
                  className="mrow hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <div className="cid">CASE-2281</div>
                  <div className="subj">Your document is waiting for signature</div>
                  <div><span className="badge med">MEDIUM</span></div>
                  <div className="score">62</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4.5 flex-wrap gap-3">
            <p className="text-[var(--paper-dim)] text-[13.8px] m-0">
              Every row links back to the same evidence chain — headers, DNS results, and hop-by-hop geolocation an analyst can open, not a score they have to trust blind.
            </p>
            <button
              onClick={onOpenConsole}
              className="text-xs font-semibold text-[var(--slate)] hover:text-[var(--paper)] transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0"
            >
              <span>Explore Interactive Workstation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Exhibits Section */}
      <section className="py-22 border-b border-[var(--line)]" id="exhibits">
        <div className="max-w-[var(--maxw)] mx-auto px-8">
          <div className="max-w-[640px] mb-13">
            <h2 className="font-display text-3xl sm:text-[34px] text-[var(--paper)] font-bold tracking-tight">
              What&apos;s actually doing the work
            </h2>
            <p className="text-[var(--paper-dim)] mt-3.5 text-[15.5px] max-w-[52ch]">
              Four systems most email tools skip — because they&apos;re the difference between a plausible guess and evidence that holds up.
            </p>
          </div>

          <div className="exhibits">
            <div className="exhibit">
              <span className="exhibit-tab mono">EXHIBIT A</span>
              <h3 className="font-display text-[18px] mt-2.5 mb-3 font-semibold text-[var(--paper)]">
                Evidence Vault
              </h3>
              <p className="text-[var(--paper-dim)] text-[14.3px] leading-relaxed">
                Every finding is hashed and timestamped the moment it&apos;s produced. Nothing in a report can be quietly edited after the fact — a changed field means a new record, not an overwrite.
              </p>
            </div>

            <div className="exhibit">
              <span className="exhibit-tab mono">EXHIBIT B</span>
              <h3 className="font-display text-[18px] mt-2.5 mb-3 font-semibold text-[var(--paper)]">
                Trust-boundary origin engine
              </h3>
              <p className="text-[var(--paper-dim)] text-[14.3px] leading-relaxed">
                The earliest IP in a header isn&apos;t always the attacker&apos;s. TraceXMail knows which hops to trust before it names a source.
              </p>
            </div>

            <div className="exhibit">
              <span className="exhibit-tab mono">EXHIBIT C</span>
              <h3 className="font-display text-[18px] mt-2.5 mb-3 font-semibold text-[var(--paper)]">
                Attribution engine
              </h3>
              <p className="text-[var(--paper-dim)] text-[14.3px] leading-relaxed">
                Every verdict comes with the evidence behind it, labeled as a fact, a finding, or a hypothesis — never blurred together into one confident-sounding line.
              </p>
            </div>

            <div className="exhibit">
              <span className="exhibit-tab mono">EXHIBIT D</span>
              <h3 className="font-display text-[18px] mt-2.5 mb-3 font-semibold text-[var(--paper)]">
                Campaign correlation
              </h3>
              <p className="text-[var(--paper-dim)] text-[14.3px] leading-relaxed">
                One email rarely stands alone. Shared infrastructure and timing surface the wider campaign, tiered by how strong the link really is.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honesty Callout */}
      <section className="honesty">
        <div className="max-w-[var(--maxw)] mx-auto px-8 flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-14">
          <div className="honesty-stamp mono">
            UNKNOWN<br />IS A VALID<br />RESULT
          </div>
          <div className="honesty-copy">
            <h2 className="font-display text-2xl sm:text-[30px] font-bold tracking-tight text-[var(--paper)] mb-4 max-w-[16ch]">
              We&apos;d rather tell you we don&apos;t know.
            </h2>
            <p className="text-[var(--paper-dim)] text-[16px] leading-relaxed max-w-[56ch]">
              When the evidence doesn&apos;t support a verdict, TraceXMail says so — instead of manufacturing confidence your team would have to defend later, in front of a client or a regulator, without the evidence to back it up.
            </p>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-22 border-b border-[var(--line)]" id="roles">
        <div className="max-w-[var(--maxw)] mx-auto px-8">
          <div className="max-w-[640px] mb-13">
            <h2 className="font-display text-3xl sm:text-[34px] text-[var(--paper)] font-bold tracking-tight">
              Built around who&apos;s actually looking at it
            </h2>
            <p className="text-[var(--paper-dim)] mt-3.5 text-[15.5px] max-w-[52ch]">
              Access matches the job. Nobody sees more than they need, and nobody with real work to do is left waiting on a request.
            </p>
          </div>

          <div className="roles">
            <div className="role admin group hover:border-[var(--stamp)] transition-all">
              <div className="role-label mono flex items-center justify-between">
                <span>CLEARANCE · ADMIN</span>
                <span className="text-[10px] text-[var(--stamp)] font-bold">FULL CONTROL</span>
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[var(--paper)] mb-2.5">
                SOC Commander / Admin
              </h3>
              <p className="text-[var(--paper-dim)] text-[14px] leading-relaxed mb-4">
                Manages the organization, provisions operators, inspects raw telemetry, and controls unmasked evidence access.
              </p>
              <button
                onClick={onOpenConsole}
                className="text-xs text-[var(--stamp)] font-mono font-medium hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Launch with Admin Clearance →</span>
              </button>
            </div>

            <div className="role group hover:border-[var(--slate)] transition-all">
              <div className="role-label mono flex items-center justify-between">
                <span>CLEARANCE · ANALYST</span>
                <span className="text-[10px] text-[var(--slate)] font-bold">INVESTIGATION</span>
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[var(--paper)] mb-2.5">
                Forensic Analyst (Tier 2)
              </h3>
              <p className="text-[var(--paper-dim)] text-[14px] leading-relaxed mb-4">
                Uploads RFC822/EML streams, executes hop triangulation, correlates campaigns, and generates signed reports.
              </p>
              <button
                onClick={onOpenConsole}
                className="text-xs text-[var(--slate)] font-mono font-medium hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Launch with Analyst Clearance →</span>
              </button>
            </div>

            <div className="role readonly group hover:border-[var(--paper-dim)] transition-all">
              <div className="role-label mono flex items-center justify-between">
                <span>CLEARANCE · AUDITOR</span>
                <span className="text-[10px] text-[var(--paper-muted)] font-bold">PII MASKED</span>
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[var(--paper)] mb-2.5">
                Compliance Auditor
              </h3>
              <p className="text-[var(--paper-dim)] text-[14px] leading-relaxed mb-4">
                Inspects case findings and immutable cryptographic audit trails with personal identifiable data masked by default.
              </p>
              <button
                onClick={onOpenConsole}
                className="text-xs text-[var(--paper-dim)] font-mono font-medium hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
              >
                <span>Launch with Auditor Clearance →</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call To Action */}
      <section className="py-24" id="request">
        <div className="max-w-[var(--maxw)] mx-auto px-8">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-[var(--paper)] max-w-[16ch] leading-tight">
            Stop guessing where a threat came from.
          </h2>
          <p className="text-[var(--paper-dim)] my-5 mb-8 max-w-[48ch] text-[16px]">
            Request access and bring your team&apos;s next suspicious email — we&apos;ll trace it with you.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={onRequestAccess || onOpenConsole}
              className="btn-primary"
            >
              Request Clearance Access
            </button>
            <button
              onClick={onOpenConsole}
              className="btn-secondary"
            >
              Operator Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] py-9">
        <div className="max-w-[var(--maxw)] mx-auto px-8 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-2.5 text-[var(--paper-dim)] text-[13.5px]">
            <div className="w-4 h-4 border-[1.5px] border-[var(--thread)] rounded-full relative shrink-0">
              <div className="absolute inset-[3.5px] rounded-full bg-[var(--thread)]" />
            </div>
            <span>TraceXMail — email forensic intelligence</span>
          </div>
          <div className="foot-stamp mono text-[11px] text-[var(--paper-dim)] border border-[var(--line)] px-2.5 py-1 rounded-[2px]">
            CASE STATUS: OPEN
          </div>
        </div>
      </footer>
    </div>
  );
}
