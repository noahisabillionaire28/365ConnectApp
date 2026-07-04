import { useState } from 'react';
import { useLocation } from 'wouter';
import { Briefcase, HardHat } from 'lucide-react';

export function RoleSelectScreen() {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<'client' | 'worker' | null>(null);

  function handleContinue() {
    if (!selected) return;
    // Persist the role in sessionStorage so ProfileSetupScreen can read it
    sessionStorage.setItem('selectedRole', selected);
    navigate('/onboarding');
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 bg-black text-white">
      <div className="flex items-center gap-1.5 mb-12">
        <span className="text-primary font-bold text-[28px] leading-none tracking-tight">365</span>
        <span className="text-white font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
      </div>

      <h1 className="text-[26px] font-bold leading-tight mb-2">How are you joining?</h1>
      <p className="text-muted-foreground text-[14px] mb-10">Choose a role to get started.</p>

      <div className="flex flex-col gap-4 flex-1">
        {/* Hiring card */}
        <button
          onClick={() => setSelected('client')}
          className={`flex items-start gap-4 p-5 rounded-[14px] border-2 text-left transition-all active:scale-[0.98] ${
            selected === 'client'
              ? 'border-primary bg-[#1A1A1A]'
              : 'border-[#2A2A2A] bg-[#0E0E0E]'
          }`}
        >
          <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 ${
            selected === 'client' ? 'bg-primary' : 'bg-[#1A1A1A]'
          }`}>
            <Briefcase size={22} className={selected === 'client' ? 'text-black' : 'text-white'} />
          </div>
          <div>
            <p className="font-bold text-[17px] text-white mb-1">I'm Hiring</p>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Post shifts and find vetted event staff fast.
            </p>
          </div>
        </button>

        {/* Working card */}
        <button
          onClick={() => setSelected('worker')}
          className={`flex items-start gap-4 p-5 rounded-[14px] border-2 text-left transition-all active:scale-[0.98] ${
            selected === 'worker'
              ? 'border-primary bg-[#1A1A1A]'
              : 'border-[#2A2A2A] bg-[#0E0E0E]'
          }`}
        >
          <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 ${
            selected === 'worker' ? 'bg-primary' : 'bg-[#1A1A1A]'
          }`}>
            <HardHat size={22} className={selected === 'worker' ? 'text-black' : 'text-white'} />
          </div>
          <div>
            <p className="font-bold text-[17px] text-white mb-1">I'm Working</p>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Browse shifts, get booked, and build your reputation.
            </p>
          </div>
        </button>
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full bg-primary text-black font-bold text-[16px] py-[18px] rounded-[14px] mt-10 active:scale-[0.98] transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
