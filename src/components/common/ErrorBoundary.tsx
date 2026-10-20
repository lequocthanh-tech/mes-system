/* Hallmark · component: ErrorBoundary · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary - ${this.props.moduleName || 'System'}] Caught error:`, error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const mod = this.props.moduleName || 'Phân hệ MES';

      return (
        <div className="w-full min-h-[380px] p-6 flex items-center justify-center bg-slate-900/60 rounded-lg border border-red-500/30">
          <div className="max-w-2xl w-full p-6 bg-slate-950 border border-red-500/40 rounded-lg shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-md text-red-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs font-mono uppercase tracking-wider bg-red-950 text-red-300 border border-red-800 rounded">
                    CRITICAL ISOLATION
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ISA-95 L3 EXCEPTION
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-semibold text-slate-100 tracking-tight">
                  Lỗi thực thi tại {mod}
                </h3>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                  Phân hệ đã kích hoạt cơ chế tự cô lập lỗi (Fault Isolation Boundary) để bảo vệ toàn vẹn luồng dữ liệu SCADA &amp; ERP. Các phân hệ khác tiếp tục vận hành bình thường.
                </p>

                {this.state.error && (
                  <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded font-mono text-xs text-red-300 overflow-x-auto max-h-40">
                    <div className="font-semibold text-red-200">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="mt-2 text-[11px] text-slate-400 whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="h-10 px-4 inline-flex items-center gap-2 rounded bg-sky-600 hover:bg-sky-500 active:translate-y-px text-white text-sm font-medium transition-colors border border-sky-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Khôi phục {mod}</span>
                  </button>

                  <button
                    type="button"
                    onClick={this.handleReload}
                    className="h-10 px-4 inline-flex items-center gap-2 rounded bg-slate-800 hover:bg-slate-700 active:translate-y-px text-slate-200 text-sm font-medium transition-colors border border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Tải lại trang</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
