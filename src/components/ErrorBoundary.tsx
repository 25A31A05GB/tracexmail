import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Terminal, Sparkles, DownloadCloud } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const msg = String(error?.message || '');
    const isChunk =
      error?.name === 'ChunkLoadError' ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('dynamically imported module');

    return { hasError: true, error, isChunkError: isChunk };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = String(error?.message || '');
    const isChunk =
      error?.name === 'ChunkLoadError' ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('dynamically imported module');

    this.setState({ errorInfo, isChunkError: isChunk });
    console.error(
      '[TraceXMail Fatal Render Error] Uncaught runtime exception in component tree:\n',
      error,
      '\n[Stack]:\n',
      error.stack,
      '\n[Component Stack]:\n',
      errorInfo.componentStack
    );

    // Auto-reload once for dynamic chunk updates
    if (isChunk) {
      try {
        const lastAutoReload = sessionStorage.getItem('tracexmail_chunk_error_autoreload');
        const now = Date.now();
        if (!lastAutoReload || now - Number(lastAutoReload) > 20000) {
          sessionStorage.setItem('tracexmail_chunk_error_autoreload', String(now));
          console.info('[ErrorBoundary] Dynamic chunk load error detected. Performing automated refresh...');
          setTimeout(() => {
            window.location.reload();
          }, 400);
        }
      } catch {}
    }
  }

  private handleReload = () => {
    try {
      sessionStorage.removeItem('tracexmail_chunk_error_autoreload');
    } catch {}
    window.location.reload();
  };

  private handleHardReset = () => {
    try {
      localStorage.removeItem('tracexmail_enclave_session');
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred';
      const componentStack = this.state.errorInfo?.componentStack;
      const isChunkError = this.state.isChunkError;

      return (
        <div className="min-h-screen w-full bg-[#110f0c] text-[#ede6d8] flex items-center justify-center p-4 font-sans selection:bg-[#c9a227] selection:text-[#110f0c]">
          <div className="max-w-xl w-full bg-[#16130f] border border-[#3a352c] rounded-[4px] shadow-2xl p-6 relative overflow-hidden">
            {/* Header / Security Stamp */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#2e2a22]">
              <div className={`w-10 h-10 rounded-[3px] ${isChunkError ? 'bg-amber-950/60 border border-amber-600/60 text-amber-400' : 'bg-rose-950/60 border border-rose-700/60 text-rose-400'} flex items-center justify-center shrink-0`}>
                {isChunkError ? <DownloadCloud className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-base font-semibold font-display text-[#ede6d8]">
                  TraceXMail SOC Security Enclave
                </h1>
                <p className={`text-xs ${isChunkError ? 'text-amber-400/90' : 'text-rose-400/90'} font-mono tracking-wide uppercase`}>
                  {isChunkError ? 'Application Update Available' : 'Application Runtime Interruption'}
                </p>
              </div>
            </div>

            {/* Error Body */}
            {isChunkError ? (
              <div className="mb-4 space-y-2 text-xs text-[#b9af9c] leading-relaxed">
                <p>
                  A new build of the TraceXMail forensic enclave was deployed, or a momentary network interruption delayed module delivery.
                </p>
                <p className="text-[#ede6d8] font-medium">
                  Clicking <strong className="text-amber-300">Reload Application</strong> will instantly load the latest version with all forensic tools and active cases intact.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#b9af9c] leading-relaxed mb-4">
                A critical rendering or component lifecycle exception occurred. The error diagnostics have been captured in the browser console for investigation.
              </p>
            )}

            <div className="bg-[#0c0a08] border border-[#242019] rounded-[3px] p-3 mb-5 font-mono text-[11px] text-[#e0a82e] overflow-x-auto max-h-48 leading-normal">
              <div className={`flex items-center gap-1.5 ${isChunkError ? 'text-amber-400' : 'text-rose-400'} font-semibold mb-1`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              {this.state.error?.stack && (
                <pre className="text-[10px] text-[#8a8070] mt-2 whitespace-pre-wrap">
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
              {componentStack && (
                <details className="mt-2 text-[10px] text-[#7fa3ba] cursor-pointer">
                  <summary className="hover:underline">View component stack trace</summary>
                  <pre className="mt-1 whitespace-pre-wrap text-[#8a8070]">{componentStack}</pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                id="error-boundary-reload-btn"
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-[3px] bg-[#c9a227] hover:bg-[#d8b030] text-[#14120f] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                id="error-boundary-reset-btn"
                type="button"
                onClick={this.handleHardReset}
                className="py-2.5 px-4 rounded-[3px] bg-[#1a1712] hover:bg-[#242019] border border-[#3a352c] text-[#ede6d8] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-[#8a8070]" />
                <span>Reset Local Session &amp; Return</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
