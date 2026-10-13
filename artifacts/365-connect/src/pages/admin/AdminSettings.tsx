import { useState } from 'react';
import { Settings, ShieldCheck, Lock, Bell, Mail } from 'lucide-react';
import { useAdminGate } from '@/hooks/useAdminGate';
import { adminApi } from '@/lib/adminApi';

function SettingRow({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-[#E5E7EB] last:border-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
          <Icon size={14} aria-hidden className="text-black" />
        </div>
        <p className="text-black text-[14px] font-semibold">{label}</p>
      </div>
      <p className="text-[#6B7280] text-[13px]">{value}</p>
    </div>
  );
}

export function AdminSettings() {
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg]   = useState<string | null>(null);
  const [testTo, setTestTo]       = useState('');

  const adminReady = useAdminGate();
  if (!adminReady) return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
    </div>
  );

  async function handleTestEmail() {
    setEmailBusy(true); setEmailMsg(null);
    try {
      const r = await adminApi.sendTestEmail(testTo.trim() || undefined);
      if (r.sent) setEmailMsg(`✓ Sent to ${r.to}. Check your inbox (and spam).`);
      else if (!r.configured) setEmailMsg('✗ RESEND_API_KEY is not set on the API server yet.');
      else setEmailMsg(`✗ ${r.reason || 'Resend rejected the send. Check the domain and From address.'}`);
    } catch (e) {
      // A thrown TypeError means the request never got an answer; anything
      // else is the server's own reason, shown as-is so it can be acted on.
      setEmailMsg(e instanceof TypeError
        ? '✗ Could not reach the server. Check your connection and try again.'
        : `✗ ${e instanceof Error ? e.message : 'The server refused the request.'}`);
    } finally { setEmailBusy(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pt-[60px]">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-black font-bold text-[22px] tracking-tight">Settings</h1>
        <p className="text-[#6B7280] text-[13px] mt-0.5">Admin panel configuration</p>
      </div>

      <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <p className="text-[#6B7280] text-[10px] font-bold uppercase tracking-[0.16em]">Security</p>
        </div>
        <SettingRow icon={ShieldCheck} label="Admin Token Auth"  value="Enabled" />
        <SettingRow icon={Lock}        label="Service Role Key"  value="Server-side" />
      </div>

      <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <p className="text-[#6B7280] text-[10px] font-bold uppercase tracking-[0.16em]">Platform</p>
        </div>
        <SettingRow icon={Settings} label="Platform Fee"  value="8% of gross" />
        <SettingRow icon={Bell}     label="Pro Plan Fee"  value="$17 / month" />
      </div>

      <div className="mx-4 bg-white border border-[#E5E7EB] rounded-[12px] overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[#E5E7EB]">
          <p className="text-[#6B7280] text-[10px] font-bold uppercase tracking-[0.16em]">Email</p>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
              <Mail size={14} aria-hidden className="text-black" />
            </div>
            <div>
              <p className="text-black text-[14px] font-semibold">Transactional Email</p>
              <p className="text-[#6B7280] text-[12px]">
                Sends a sample notification from the app's sender address to check delivery.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
              placeholder="Send to… (blank = your account email)"
              aria-label="Test recipient email"
              className="flex-1 h-[38px] rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] px-3 text-[13px] text-black placeholder:text-[#6B7280] outline-none focus:border-black" />
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

      <p className="text-center text-[#6B7280] text-[12px] px-8 leading-relaxed">
        Additional settings (rate limits, feature flags) will be available in a future release.
      </p>
    </div>
  );
}
