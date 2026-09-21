import { ReactNode } from 'react';

/**
 * The app column. Full width on phones (no side gutters on any screen size);
 * a centred phone-shaped column on tablets and desktops. The width itself is
 * the `--app-max-width` variable in index.css, shared with every fixed bar.
 */
export function MobileContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-white sm:bg-[#F0F0F0] relative flex justify-center">
      <div className="w-full max-w-app min-h-[100dvh] bg-white relative overflow-x-hidden sm:shadow-[0_0_40px_rgba(0,0,0,0.12)]">
        {children}
      </div>
    </div>
  );
}
