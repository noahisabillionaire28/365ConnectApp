import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, DollarSign, TrendingUp, AlertTriangle, FileText,
} from 'lucide-react';
import { isAdminAuthenticated, initAdminSession } from '@/store/adminStore';
import { useAdminStats } from '@/hooks/useAdminData';

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-20 bg-[#E5E7EB] rounded-full" />
        <div className="w-8 h-8 rounded-[8px] bg-[#E5E7EB]" />
      </div>
      <div className="h-8 w-16 bg-[#E5E7EB] rounded-[6px]" />
      <div className="h-2.5 w-24 bg-[#E5E7EB] rounded-full" />
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({
  label, value, sub, icon: Icon, delay = 0,
}: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.16em]">{label}</p>
        <div className="w-8 h-8 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center">
          <Icon size={15} className="text-black" aria-hidden />
        </div>
      </div>
      <p className="text-black font-bold leading-none" style={{ fontSize: 30 }}>{value}</p>
      <p className="text-[#737373] text-[12px] font-medium">{sub}</p>
    </motion.div>
  );
}

/* ── AdminDashboard ───────────────────────────────────────────────────────── */
export function AdminDashboard() {
  const [, navigate] = useLocation();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    initAdminSession().then((ok) => {
      if (!ok) { navigate('/admin/login'); } else { setAuthReady(true); }
    });
  }, [navigate]);

  const { data: stats, isLoading, isError } = useAdminStats();

  if (!authReady) return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
    </div>
  );

  const fmtK = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] pt-[60px]">
      <main className="px-4 pt-6 pb-12 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-black font-bold text-[22px] tracking-tight">Overview</h1>
          <p className="text-[#737373] text-[13px] mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {isError && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3 mb-6">
            <AlertTriangle size={15} aria-hidden className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-[13px]">
              Could not load stats — check API server and Supabase connection.
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : stats ? (
            <>
              <StatCard label="Total Users"    value={stats.totalUsers.toLocaleString()}
                sub={`+${stats.newSignupsToday} today`} icon={Users} delay={0} />
              <StatCard label="Total Shifts"   value={stats.totalShifts.toLocaleString()}
                sub={`${stats.activeShifts} active`} icon={Briefcase} delay={0.05} />
              <StatCard label="Applications"   value={stats.totalApps.toLocaleString()}
                sub="across all shifts" icon={FileText} delay={0.1} />
              <StatCard label="Platform Fees"  value={fmtK(stats.platformFeeRev)}
                sub="8% of gross revenue" icon={DollarSign} delay={0.15} />
              <StatCard label="Gross Revenue"  value={fmtK(stats.totalRevenue)}
                sub="all payments" icon={TrendingUp} delay={0.2} />
              <StatCard label="Open Disputes"  value={String(stats.openDisputes)}
                sub="require attention" icon={AlertTriangle} delay={0.25} />
            </>
          ) : null}
        </div>

        {/* Alert banners */}
        {stats && stats.openDisputes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            role="status" aria-label={`${stats.openDisputes} open disputes`}
            className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3 mb-4"
          >
            <AlertTriangle size={15} aria-hidden className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-[13px] font-semibold">
              {stats.openDisputes} open dispute{stats.openDisputes !== 1 ? 's' : ''} need review
            </p>
          </motion.div>
        )}

        {/* Quick-nav tiles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.25 }}
          className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-[#DBDBDB]">
            <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.16em]">Quick Access</p>
          </div>
          {[
            { label: 'Manage Users',   path: '/admin/users',    icon: Users,         sub: 'View, flag, or suspend accounts' },
            { label: 'Monitor Shifts', path: '/admin/shifts',   icon: Briefcase,     sub: 'Track active and past shifts' },
            { label: 'Revenue',        path: '/admin/revenue',  icon: DollarSign,    sub: 'All payments and platform fees' },
            { label: 'Disputes',       path: '/admin/disputes', icon: AlertTriangle, sub: 'Case management and moderation' },
          ].map(({ label, path, icon: Icon, sub }, i) => (
            <a key={path} href={path}
              className="flex items-center gap-4 px-4 py-4 border-b border-[#DBDBDB] last:border-none transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="w-9 h-9 rounded-[8px] bg-[#FAFAFA] border border-[#DBDBDB] flex items-center justify-center flex-shrink-0">
                <Icon size={16} aria-hidden className="text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-black text-[14px] font-semibold">{label}</p>
                <p className="text-[#737373] text-[12px]">{sub}</p>
              </div>
            </a>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
