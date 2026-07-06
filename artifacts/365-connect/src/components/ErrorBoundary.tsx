import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; }

/**
 * Top-level error boundary.
 * Catches any React render error and shows a friendly recovery card
 * instead of a blank white crash screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[365 Connect] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center px-8 text-center gap-5">
        {/* Logo */}
        <div className="mb-2">
          <span className="text-[28px] font-bold tracking-tight">
            <span className="text-primary">365</span>
            <span className="text-white"> CONNECT</span>
          </span>
        </div>

        {/* Error icon */}
        <div className="w-16 h-16 rounded-full bg-[#0E0E0E] border border-[#1E1E1E] flex items-center justify-center">
          <span className="text-[28px] select-none">⚡</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-white font-bold text-[18px]">Something went wrong</p>
          <p className="text-[#555] text-[13px] leading-relaxed max-w-[280px]">
            An unexpected error occurred. Your data is safe — tap below to reload the app.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 w-full max-w-[280px] h-[52px] rounded-[14px] bg-primary text-black font-bold text-[15px]"
        >
          Try again
        </button>
      </div>
    );
  }
}
