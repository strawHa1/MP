import React from 'react';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  error: Error | null;
}

/** Keeps the shell (sidebar/header) mounted if a page render throws. */
export class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 m-6 bg-[#0F1420] border border-red-500/30 rounded-2xl">
          <p className="text-red-400 font-bold text-sm">This page hit a rendering error.</p>
          <pre className="mt-3 text-xs text-slate-400 whitespace-pre-wrap font-mono">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-4 text-xs text-blue-400 hover:underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
