import React from "react";

type ErrorBoundaryProps = {
  title: string;
  description?: string;
  autoReload?: boolean;
  reloadDelayMs?: number;
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

let reloadScheduled = false;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary caught:", error);
    if (this.props.autoReload && !reloadScheduled) {
      reloadScheduled = true;
      const delay = this.props.reloadDelayMs ?? 2000;
      window.setTimeout(() => window.location.reload(), delay);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <p className="text-base font-semibold text-rose-900">{this.props.title}</p>
        <p className="mt-2 text-rose-700">{this.props.description ?? "再試行してください。"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs text-rose-700"
            onClick={this.handleRetry}
          >
            再試行
          </button>
          <button
            type="button"
            className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            ページを再読み込み
          </button>
        </div>
      </div>
    );
  }
}
