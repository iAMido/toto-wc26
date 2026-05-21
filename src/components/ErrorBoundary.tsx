import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  err: Error | null;
}

/**
 * Class-component error boundary — the only API React gives us for catching
 * render-time crashes. Without one, any thrown component blacks out the whole
 * page (this was happening on /admin before the users-RLS fix).
 *
 * On crash: show a tiny recovery card with the error message + Reload button.
 * Logs the error + componentStack to the console so we can grep prod logs.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    // Production logging hook — Sentry/PostHog could plug in here later.
    console.error('ErrorBoundary caught:', err);
    console.error('componentStack:', info.componentStack);
  }

  render() {
    if (!this.state.err) return this.props.children;

    const isHebrew = document.documentElement.lang === 'he';
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">⚠️</span>
        <h1 className="text-xl font-bold">
          {isHebrew ? 'משהו השתבש' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isHebrew
            ? 'אירעה שגיאה לא צפויה. רענן את הדף כדי לנסות שוב.'
            : 'An unexpected error happened. Try refreshing the page.'}
        </p>
        <pre
          className="text-[10px] text-destructive bg-destructive/10 rounded-lg p-3 max-w-md text-start overflow-auto"
          dir="ltr"
        >
          {this.state.err.message}
        </pre>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="bg-primary text-primary-foreground rounded-xl px-6 h-11 text-sm font-bold"
        >
          {isHebrew ? 'חזור לדף הבית' : 'Back to home'}
        </button>
      </div>
    );
  }
}
