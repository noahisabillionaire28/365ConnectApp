import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Settings, ShieldCheck, Lock, Bell, Mail } from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { adminApi } from '@/lib/adminApi';

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
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg]   = useState<string | null>(null);
  const [testTo, setTestTo]       = useState('');

  useEffect(() => { initAdminSession().then((ok) => { if (!ok) navigate('/admin/login'); }); }, [navigate]);
  if (!isAdminAuthenticated()) return null;

  async function handleTestEmail() {
    setEmailBusy(true); setEmailMsg(null);
    try {
      const r = await adminApi.sendTestEmail(testTo.trim() || undefined);
      if (r.sent) setEmailMsg(`✓ Sent to ${r.to}. Check your inbox (and spam).`);
      else if (!r.configured) setEmailMsg('✗ RESEND_API_KEY is not set on the API server yet.');
      else setEmailMsg('✗ Resend rejected the send — check your domain/From address.');
    } catch {
      setEmailMsg('✗ Could not reach the server. Try again.');
    } finally { setEmailBusy(false); }
  }

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

      <div className="mx-4 bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#DBDBDB]">
          <p className="text-[#737373] text-[10px] font-bold uppercase tracking-[0.16em]">Email</p>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
              <Mail size={14} aria-hidden className="text-black" />
            </div>
            <div>
              <p className="text-black text-[14px] font-semibold">Transactional Email</p>
              <p className="text-[#737373] text-[12px]">
                While unverified, Resend only delivers to your Resend signup email.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
              placeholder="Send to… (blank = your account email)"
              aria-label="Test recipient email"
              className="flex-1 h-[38px] rounded-[8px] border border-[#DBDBDB] bg-[#FAFAFA] px-3 text-[13px] text-black placeholder:text-[#AAAAAA] outline-none focus:border-black" />
            <button type="button" onClick={() => void handleTestEmail()} disabled={emailBusy}
              className="px-3.5 h-[38px] rounded-[8px] bg-[#0A1628] text-white text-[13px] font-bold disabled:opacity-60 flex-shrink-0">
              {emailBusy ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </div>
        {emailMsg && (
          <p className={`px-4 pb-4 text-[12px] font-medium ${emailMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
            {emailMsg}
          </p>
        )}
      </div>

      <p className="text-center text-[#AAAAAA] text-[12px] px-8 leading-relaxed">
        Additional settings (rate limits, feature flags) will be available in a future release.
      </p>
    </div>
  );
}
