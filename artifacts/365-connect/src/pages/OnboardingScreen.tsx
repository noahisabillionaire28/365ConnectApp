/**
 * OnboardingScreen — /onboarding
 *
 * Three-slide feature walkthrough. Copy and icons vary by role.
 * After the last slide (or Skip), the user is sent to their role-specific
 * profile-setup screen.
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, DollarSign,
  Zap, Users, BarChart2,
  Building2, Cpu, LineChart,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const NAVY  = '#0A1628';
const MUTED = '#6B7280';
const TEXT  = '#111827';

type Role = 'worker' | 'client' | 'staffer';

const SLIDES: Record<Role, { icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>; title: string; body: string }[]> = {
  worker: [
    {
      icon:  Search,
      title: 'Get discovered',
      body:  'Build a profile that showcases your skills and schedule. Clients find you automatically.',
    },
    {
      icon:  Zap,
      title: 'Apply in seconds',
      body:  'Browse shifts near you, see the pay rate and requirements, and apply with one tap.',
    },
    {
      icon:  Star,
      title: 'Build your reputation',
      body:  'Earn verified reviews after every shift. A stronger rating unlocks better-paying opportunities.',
    },
  ],
  client: [
    {
      icon:  Zap,
      title: 'Post in minutes',
      body:  'Describe the shift, set your rate, and go live instantly. Workers start applying right away.',
    },
    {
      icon:  Users,
      title: 'Vetted talent, fast',
      body:  'Browse matched workers with verified ratings, past-event photos, and real reviews.',
    },
    {
      icon:  BarChart2,
      title: 'Manage everything',
      body:  'Track applications, confirm workers, handle time-sheets and payments — all in one place.',
    },
  ],
  staffer: [
    {
      icon:  Building2,
      title: 'Your agency, amplified',
      body:  'Manage your full roster, submit workers to open shifts, and scale your placements.',
    },
    {
      icon:  Cpu,
      title: 'Smart matching',
      body:  'AI-powered matching surfaces the right workers for every shift automatically.',
    },
    {
      icon:  LineChart,
      title: 'Full visibility',
      body:  'Real-time dashboards for active shifts, worker statuses, and agency revenue.',
    },
  ],
};


export function OnboardingScreen() {
  const [, navigate]     = useLocation();
  const { user }         = useAuth();
  const [role, setRole]  = useState<Role>('worker');
  const [slide, setSlide] = useState(0);

  // Fetch role directly so we don't rely on context timing after RoleSelect
  useEffect(() => {
    if (!user) return;
    apiClient(user.id).get<{ role: string | null }>('/users/me')
      .then((data) => { if (data?.role) setRole(data.role as Role); })
      .catch(() => {});
  }, [user?.id]);

  const slides = SLIDES[role];

  // After the walkthrough, go straight to the app. Profile setup is optional and
  // can be completed later (Profile → Edit); a bare profile still works.
  function advance() {
    if (slide < slides.length - 1) { setSlide(s => s + 1); return; }
    navigate('/home');
  }

  function skip() { navigate('/home'); }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white overflow-hidden">
      {/* Skip */}
      <div className="flex justify-end px-6 pt-10">
        <button
          onClick={skip}
          className="text-[14px] font-semibold py-1 px-3"
          style={{ color: MUTED }}
          data-testid="btn-walkthrough-skip"
        >
          Skip
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${role}-${slide}`}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex flex-col items-center w-full"
          >
            {(() => {
              const { icon: Icon, title, body } = slides[slide];
              return (
                <>
                  {/* Illustration circle */}
                  <div
                    className="w-[100px] h-[100px] rounded-full flex items-center justify-center mb-10"
                    style={{ background: '#F0F4FF', border: `2px solid #E0E8FF` }}
                  >
                    <Icon size={44} style={{ color: NAVY }} />
                  </div>

                  <h2
                    className="font-bold text-[28px] text-center leading-tight mb-3"
                    style={{ color: TEXT }}
                  >
                    {title}
                  </h2>
                  <p
                    className="text-[15px] text-center leading-relaxed max-w-[280px] mx-auto"
                    style={{ color: MUTED }}
                  >
                    {body}
                  </p>
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="w-full px-6 pb-14 pt-4">
        {/* Dots */}
        <div className="flex items-center justify-center gap-[7px] mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width:      slide === i ? 24 : 8,
                height:     8,
                background: slide === i ? NAVY : '#E5E7EB',
              }}
            />
          ))}
        </div>

        <button
          onClick={advance}
          className="w-full text-white font-bold text-[16px] h-[52px] rounded-[12px] active:scale-[0.98] transition-transform"
          style={{ background: NAVY }}
          data-testid="btn-walkthrough-next"
        >
          {slide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
