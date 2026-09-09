import { Ban } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';

/**
 * Full-screen block shown to banned (suspended) accounts.
 *
 * Rendered by the app shell in place of the app whenever the signed-in user's
 * moderation status is 'suspended'. Admins are never gated. The only action is
 * to sign out; there is nothing else a suspended user can reach.
 */
export function SuspendedGate() {
  const { signOut } = useAuth();
  const { isAdmin } = useRole();

  // Never lock an admin out of their own panel.
  if (isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-5">
        <Ban size={30} className="text-red-500" aria-hidden />
      </div>
      <h1 className="text-[#0A1628] font-bold text-[22px] mb-2">Account Suspended</h1>
      <p className="text-[#6B7280] text-[14px] leading-relaxed max-w-[300px] mb-8">
        Your 365 Connect account has been suspended by an administrator. If you
        believe this is a mistake, please contact support at{' '}
        <a href="mailto:support@365connect.com" className="text-[#2563EB] font-semibold">
          support@365connect.com
        </a>.
      </p>
      <button type="button" onClick={() => void signOut()}
        className="h-[48px] px-8 rounded-[10px] bg-[#0A1628] text-white font-bold text-[15px] active:scale-[0.98] transition-transform">
        Log Out
      </button>
    </div>
  );
}
