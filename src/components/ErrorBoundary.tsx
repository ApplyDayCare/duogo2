import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in component tree:", error, errorInfo);

    // If chunk loading failed (e.g. after a new deployment or network drop), attempt reload once
    if (
      error.message?.includes("dynamically imported module") ||
      error.message?.includes("Failed to fetch dynamically imported") ||
      error.message?.includes("Loading chunk")
    ) {
      const hasReloaded = sessionStorage.getItem("duogo_chunk_reload_attempted");
      if (!hasReloaded) {
        sessionStorage.setItem("duogo_chunk_reload_attempted", "true");
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    sessionStorage.removeItem("duogo_chunk_reload_attempted");
    window.location.reload();
  };

  private handleGoHome = () => {
    sessionStorage.removeItem("duogo_chunk_reload_attempted");
    window.location.href = "/dashboard";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[70vh] w-full flex-col items-center justify-center p-6 text-center font-sans bg-[#FAF7F2]">
          <div className="mx-auto max-w-sm rounded-3xl border border-[#EBE3D5] bg-white p-6 sm:p-8 shadow-soft space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0EB] text-[#FF5436]">
              <AlertCircle className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-serif text-xl font-bold text-[#181513]">
                Something went wrong
              </h2>
              <p className="text-xs text-[#666059] leading-relaxed">
                We encountered an unexpected glitch loading this view. You can refresh or return to your dashboard.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EBE3D5] text-[11px] text-[#666059] cursor-pointer">
                <summary className="font-semibold text-[#FF5436] hover:underline">
                  Error Details ({this.state.error.name || "Error"})
                </summary>
                <div className="mt-2 font-mono text-[10px] text-[#4A453F] break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {this.state.error.message || "Unknown error occurred"}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={this.handleReload}
                className="flex-1 rounded-full border-[#EBE3D5] text-xs font-semibold h-10 gap-1.5 hover:bg-[#FAF7F2]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="flex-1 rounded-full bg-[#FF5436] hover:bg-[#E03E22] text-white text-xs font-bold h-10 gap-1.5 shadow-2xs"
              >
                <Home className="h-3.5 w-3.5" />
                Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
