import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[app-error-boundary] runtime crash captured', { error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-stone-900">Something went wrong</h2>
          <p className="text-sm text-stone-600 mt-2">
            A runtime error was caught. You can retry without losing your session.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-3 py-2 text-sm rounded-lg bg-primary text-white"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-2 text-sm rounded-lg border border-stone-300 text-stone-700"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;