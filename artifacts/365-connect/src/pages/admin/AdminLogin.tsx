import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { adminLogin } from '@/store/adminStore';

export function AdminLogin() {
  const [, navigate]  = useLocation();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const ok = adminLogin(email.trim(), password);
    if (ok) { navigate('/admin/dashboard'); }
    else { setError('Invalid credentials. Check your email and password.'); setLoading(false); }
  }

  return (
    <div className="min-h-[100dvh] bg-white flex items-center justify-center px-5 py-12">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }} className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-[18px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center mb-4">
            <ShieldCheck size={32} aria-hidden className="text-black" />
          </div>
          <h1 className="text-black font-bold text-[28px] tracking-tight">365 Connect</h1>
          <p className="text-[#737373] text-[14px] font-medium mt-1 uppercase tracking-[0.18em]">Admin Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-black text-[12px] font-semibold uppercase tracking-wider">Email</label>
            <input id="email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="admin@365connect.com"
              aria-required="true" aria-describedby={error ? 'login-error' : undefined}
              className="h-[52px] rounded-[8px] bg-white border border-[#DBDBDB] px-4 text-black text-[15px] placeholder:text-[#AAAAAA] focus:outline-none focus:border-black transition-colors" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-black text-[12px] font-semibold uppercase tracking-wider">Password</label>
            <div className="relative">
              <input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                aria-required="true" aria-describedby={error ? 'login-error' : undefined}
                className="w-full h-[52px] rounded-[8px] bg-white border border-[#DBDBDB] px-4 pr-12 text-black text-[15px] placeholder:text-[#AAAAAA] focus:outline-none focus:border-black transition-colors" />
              <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#737373]">
                {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div id="login-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-[8px] px-3.5 py-3">
              <AlertCircle size={15} aria-hidden className="text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-[13px]">{error}</p>
            </motion.div>
          )}

          <motion.button type="submit" disabled={loading} aria-label="Sign in to admin panel"
            whileTap={!loading ? { scale: 0.97 } : {}}
            className={`w-full h-[52px] rounded-[8px] font-bold text-[16px] mt-2 transition-all duration-200 flex items-center justify-center gap-2 ${
              loading ? 'bg-black/50 text-white/50 cursor-not-allowed' : 'bg-black text-white'
            }`}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>
            ) : 'Sign In'}
          </motion.button>
        </form>

        <p className="text-center text-[#AAAAAA] text-[12px] mt-8">
          Restricted access — authorised personnel only
        </p>
      </motion.div>
    </div>
  );
}
