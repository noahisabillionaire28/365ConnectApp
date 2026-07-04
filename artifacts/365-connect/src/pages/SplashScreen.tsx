import { Link } from 'wouter';
import { Logo } from '@/components/Logo';

export function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-between min-h-[100dvh] px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Logo />
        <p className="text-muted-foreground mt-3 text-[15px] tracking-wide font-medium">
          Staff smarter. Work better.
        </p>
      </div>
      
      <div className="w-full flex flex-col gap-3">
        <Link 
          href="/signup" 
          className="w-full bg-primary text-primary-foreground font-bold text-center py-[18px] rounded-[14px] hover:bg-primary/90 transition-colors active:scale-[0.98] text-[15px]" 
          data-testid="button-signup"
        >
          Sign Up
        </Link>
        <Link 
          href="/login" 
          className="w-full bg-transparent text-white border border-[#2A2A2A] font-bold text-center py-[18px] rounded-[14px] hover:bg-white/5 transition-colors active:scale-[0.98] text-[15px]" 
          data-testid="button-login"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
