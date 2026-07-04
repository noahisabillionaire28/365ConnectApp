import { ReactNode } from 'react';

export function MobileContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-black relative flex justify-center">
      <div className="w-full max-w-[390px] min-h-[100dvh] bg-black relative overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
