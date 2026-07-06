import { Link } from 'wouter';

export function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-between min-h-[100dvh] px-6 py-12 bg-white">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Wordmark */}
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-black font-bold text-[42px] leading-none tracking-tight">365</span>
          <span className="text-black font-bold text-[42px] leading-none tracking-tight">CONNECT</span>
        </div>
        <p className="text-[#737373] text-[15px] tracking-wide font-medium">
          Staff smarter. Work better.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <Link
          href="/signup"
          className="w-full bg-black text-white font-bold text-center py-[16px] rounded-[8px] hover:bg-black/90 transition-colors active:scale-[0.98] text-[15px]"
          data-testid="button-signup"
        >
          Sign Up
        </Link>
        <Link
          href="/login"
          className="w-full bg-white text-black border border-[#DBDBDB] font-bold text-center py-[16px] rounded-[8px] hover:bg-[#FAFAFA] transition-colors active:scale-[0.98] text-[15px]"
          data-testid="button-login"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
