import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, DollarSign, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, UserX,
} from 'lucide-react';
import { isAdminAuthenticated } from '@/store/adminStore';
import { AdminNav } from '@/components/AdminNav';
import { ADMIN_STATS, ADMIN_DISPUTES, ADMIN_SHIFTS, ADMIN_USERS } from '@/data/mockAdmin';

function StatCard({ label, value, sub, icon: Icon, delay = 0 }: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      className="bg-white border border-[#DBDBDB] rounded-[12px] p-4 flex flex-col gap-3">
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

function ActivityRow({ icon: Icon, color, text, time, delay = 0 }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; text: string; time: string; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay, ease: 'easeOut' }}
      className="flex items-start gap-3 py-3 border-b border-[#DBDBDB] last:border-none" role="listitem">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={14} aria-hidden className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-black text-[13px] leading-snug">{text}</p>
        <p className="text-[#737373] text-[11px] mt-0.5">{time}</p>
      </div>
    </motion.div>
  );
}

export function AdminDashboard() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAdminAuthenticated()) navigate('/admin/login');
  }, [navigate]);

  if (!isAdminAuthenticated()) return null;

  const openDisputes  = ADMIN_DISPUTES.filter((d) => d.status === 'open').length;
  const inProgress    = ADMIN_SHIFTS.filter((s) => s.status === 'in-progress').length;
  const suspended     = ADMIN_USERS.filter((u) => u.status === 'suspended').length;

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA] flex flex-col">
      <AdminNav />

      <main className="flex-1 px-4 pt-6 pb-12 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-black font-bold text-[22px] tracking-tight">Overview</h1>
          <p className="text-[#737373] text-[13px] mt-0.5">Saturday, July 4 · Miami Beach</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatCard label="Total Users" value={ADMIN_STATS.totalUsers.toLocaleString()}
            sub={`+${ADMIN_STATS.newSignupsToday} today`} icon={Users} delay={0} />
          <StatCard label="Active Shifts" value={String(ADMIN_STATS.activeShifts)}
            sub={`${inProgress} in progress`} icon={Briefcase} delay={0.05} />
          <StatCard label="Platform Revenue" value={`$${(ADMIN_STATS.platformRevenue / 1000).toFixed(1)}K`}
            sub="8% service fee" icon={DollarSign} delay={0.1} />
          <StatCard label="New Signups" value={String(ADMIN_STATS.newSignupsToday)}
            sub="today · +12% vs avg" icon={TrendingUp} delay={0.15} />
        </div>

        {(openDisputes > 0 || suspended > 0) && (
          <div className="flex gap-2.5 mb-8">
            {openDisputes > 0 && (
              <div role="status" aria-label={`${openDisputes} open disputes`}
                className="flex-1 flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2.5">
                <AlertTriangle size={14} aria-hidden className="text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-[12px] font-semibold">{openDisputes} open disputes</p>
              </div>
            )}
            {suspended > 0 && (
              <div role="status" aria-label={`${suspended} suspended accounts`}
                className="flex-1 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2.5">
                <UserX size={14} aria-hidden className="text-amber-500 flex-shrink-0" />
                <p className="text-amber-600 text-[12px] font-semibold">{suspended} suspended</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-[#DBDBDB] rounded-[12px] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#DBDBDB]">
            <p className="text-[#737373] text-[11px] font-bold uppercase tracking-[0.16em]">Recent Activity</p>
          </div>
          <div className="px-4" role="list" aria-label="Recent admin activity">
            <ActivityRow icon={TrendingUp}    color="bg-black"          text="47 new worker signups today — highest this week."                          time="Today, 9:00 AM"     delay={0.2}  />
            <ActivityRow icon={DollarSign}    color="bg-emerald-500"    text="Payment batch processed — $4,820 disbursed to 38 workers."                 time="Today, 8:30 AM"     delay={0.24} />
            <ActivityRow icon={AlertTriangle} color="bg-red-500"        text="Dispute #D-01 opened — @derek_s (2× no-show reported by @1hotel_sb)."      time="Today, 7:14 AM"     delay={0.28} />
            <ActivityRow icon={CheckCircle2}  color="bg-emerald-500"    text="Shift #S-07 completed — Event Host at Fontainebleau. Fee: $46."             time="Yesterday, 11 PM"   delay={0.32} />
            <ActivityRow icon={Clock}         color="bg-amber-400"      text="@derek_s account suspended after second no-show confirmed."                 time="Yesterday, 2:15 PM" delay={0.36} />
          </div>
        </div>
      </main>
    </div>
  );
}
