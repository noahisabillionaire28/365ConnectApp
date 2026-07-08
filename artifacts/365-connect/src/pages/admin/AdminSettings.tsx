import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Settings, ShieldCheck, Lock, Bell } from 'lucide-react';
import { isAdminAuthenticated } from '@/store/adminStore';

function SettingRow({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-[#DBDBDB] last:border-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
          <Icon size={14} aria-hidden className="text-black" />
        </div>
        <p className="text-black text-[14px] font-semibold">{label}</p>
      </div>
      <p className="text-[#737373] text-[13px]">{value}</p>
    </div>
  );
}

export function AdminSettings() {
  const [, navigate] = useLocation();

  useEffect(() => { if (!isAdminAuthenticated()) navigate('/admin/login'); }, [navigate]);
  if (!isAdminAuthenticated()) return null;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pt-[60px]">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-black font-bold text-[22px] tracking-tight">Settings</h1>
        <p className="text-[#737373] text-[13px] mt-0.5">Admin panel configuration</p>
      </div>

      <div className="mx-4 bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#DBDBDB]">
          <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.16em]">Security</p>
        </div>
        <SettingRow icon={ShieldCheck} label="Admin Token Auth"  value="Enabled" />
        <SettingRow icon={Lock}        label="Service Role Key"  value="Server-side" />
      </div>

      <div className="mx-4 bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#DBDBDB]">
          <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.16em]">Platform</p>
        </div>
        <SettingRow icon={Settings} label="Platform Fee"  value="8% of gross" />
        <SettingRow icon={Bell}     label="Pro Plan Fee"  value="$17 / month" />
      </div>

      <p className="text-center text-[#AAAAAA] text-[12px] px-8 leading-relaxed">
        Additional settings (notifications, rate limits, feature flags) will be available in a future release.
      </p>
    </div>
  );
}
