import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 md:p-12 max-w-2xl mx-auto my-8 select-text font-sans">
          <div className="bg-white border border-rose-150 rounded-2xl p-6 md:p-8 shadow-md space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
              <div className="p-2.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#0F2B5B]">
                  Something went wrong in {this.props.fallbackName || "this view"}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  An unexpected JavaScript error occurred while rendering this module.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-205 rounded-xl p-4 space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-420 uppercase tracking-wider block">
                Technical Exception Details
              </span>
              <p className="text-xs font-mono text-rose-800 leading-relaxed font-bold select-all overflow-x-auto truncate max-w-full">
                {this.state.error?.toString() || "Unknown rendering exception"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2 bg-navy-primary hover:bg-[#1A3E75] text-white text-xs font-bold rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
