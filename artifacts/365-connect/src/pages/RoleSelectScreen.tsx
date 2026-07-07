import { useState } from 'react';
import { useLocation } from 'wouter';
import { Briefcase, HardHat, Building2 } from 'lucide-react';

type Role = 'client' | 'worker' | 'staffer';

export function RoleSelectScreen() {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<Role | null>(null);

  function handleContinue() {
    if (!selected) return;
    sessionStorage.setItem('selectedRole', selected);
    navigate('/onboarding');
  }

  const cards: { role: Role; icon: React.ReactNode; title: string; subtitle: string }[] = [
    {
      role: 'client',
      icon: <Briefcase size={22} />,
      title: "I'm Hiring",
      subtitle: 'Post shifts and find vetted event staff fast.',
    },
    {
      role: 'worker',
      icon: <HardHat size={22} />,
      title: "I'm Working",
      subtitle: 'Browse shifts, get booked, and build your reputation.',
    },
    {
      role: 'staffer',
      icon: <Building2 size={22} />,
      title: "I'm a Staffing Agency",
      subtitle: 'Manage your roster and place workers into shifts at scale.',
    },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-10 bg-white text-black">
      <div className="flex items-center gap-1.5 mb-12">
        <span className="text-black font-bold text-[28px] leading-none tracking-tight">365</span>
        <span className="text-black font-bold text-[28px] leading-none tracking-tight">CONNECT</span>
      </div>

      <h1 className="text-[26px] font-bold leading-tight mb-2">How are you joining?</h1>
      <p className="text-[#737373] text-[14px] mb-10">Choose a role to get started.</p>

      <div className="flex flex-col gap-4 flex-1">
        {cards.map(({ role, icon, title, subtitle }) => {
          const active = selected === role;
          return (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={`flex items-start gap-4 p-5 rounded-[12px] border-2 text-left transition-all active:scale-[0.98] ${
                active ? 'border-black bg-black/5' : 'border-[#DBDBDB] bg-white'
              }`}
            >
              <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 ${
                active ? 'bg-black' : 'bg-[#FAFAFA] border border-[#DBDBDB]'
              }`}>
                <span className={active ? 'text-white' : 'text-[#737373]'}>{icon}</span>
              </div>
              <div>
                <p className="font-bold text-[17px] text-black mb-1">{title}</p>
                <p className="text-[#737373] text-[13px] leading-relaxed">{subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full bg-black text-white font-bold text-[16px] py-[18px] rounded-[8px] mt-10 active:scale-[0.98] transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Continue
      </button>
    </div>
  );
}
