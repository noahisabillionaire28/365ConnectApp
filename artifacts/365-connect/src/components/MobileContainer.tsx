import { ReactNode } from 'react';

export function MobileContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#F0F0F0] relative flex justify-center">
      <div className="w-full max-w-[390px] min-h-[100dvh] bg-white relative overflow-x-hidden shadow-[0_0_40px_rgba(0,0,0,0.12)]">
        {children}
      </div>
    </div>
  );
}
