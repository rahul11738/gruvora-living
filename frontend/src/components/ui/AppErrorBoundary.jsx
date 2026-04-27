import React from 'react';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Production-safe error logging
    const errorData = {
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      componentStack: errorInfo?.componentStack || 'No component stack',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location?.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };
    console.error('[app-error-boundary] runtime crash captured', errorData);
    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production' && window.gtag) {
      window.gtag('event', 'exception', {
        description: errorData.message,
        fatal: false,
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const errorMessage = error?.message || 'Unknown error';
    const isHelmetError = errorMessage.includes('Helmet') || errorMessage.includes('nest');

    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 md:p-6" data-testid="error-boundary">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-lg p-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-stone-900">Something went wrong</h2>
            <p className="text-sm text-stone-600 mt-1">
              {isHelmetError
                ? 'A display configuration error was detected. Please try refreshing the page.'
                : 'A runtime error was caught. You can retry without losing your session.'
              }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors shadow-sm"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
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