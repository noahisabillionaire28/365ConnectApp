import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearQueryCache } from '@/lib/queryPersist';

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; message: string | null; }

const HOME_PATH = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/home`;

/**
 * Top-level error boundary.
 * Catches any React render error and shows a friendly recovery card
 * instead of a blank crash screen.
 *
 * Recovery clears the on-device query snapshot first: a stale cached object
 * from an older build is the most common reason a screen throws on render,
 * and reloading with the same snapshot would just crash again.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[365 Connect] Uncaught render error:', error, info.componentStack);
    clearQueryCache();
  }

  private retry = () => {
    clearQueryCache();
    window.location.reload();
  };

  private goHome = () => {
    clearQueryCache();
    window.location.assign(HOME_PATH);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center px-8 text-center gap-5">
        {/* Logo */}
        <div className="mb-2">
          <span className="text-[28px] font-bold tracking-tight text-black">
            365 CONNECT
          </span>
        </div>

        {/* Error icon */}
        <div className="w-16 h-16 rounded-full bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <span className="text-[28px] select-none">⚡</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-black font-bold text-[18px]">Something went wrong</p>
          <p className="text-[#737373] text-[13px] leading-relaxed max-w-[280px]">
            An unexpected error occurred. Your data is safe — tap below to reload the app.
          </p>
          {this.state.message && (
            <p className="text-[#AAAAAA] text-[11px] leading-relaxed max-w-[280px] mt-1 break-words">
              {this.state.message}
            </p>
          )}
        </div>

        <div className="w-full max-w-[280px] flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={this.retry}
            className="w-full h-[52px] rounded-[8px] bg-black text-white font-bold text-[15px]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.goHome}
            className="w-full h-[48px] rounded-[8px] bg-white border border-[#DBDBDB] text-[#111827] font-semibold text-[14px]"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
}
