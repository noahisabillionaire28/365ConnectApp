import { BadgeCheck, Star, Award, TrendingUp } from 'lucide-react';

export type BadgeKey = 'pro' | 'top' | 'veteran' | 'rising';

const META: Record<BadgeKey, { label: string; icon: typeof Star; cls: string }> = {
  pro:     { label: 'Pro',         icon: BadgeCheck,  cls: 'bg-[#FFF7E0] border-[#FFE08A] text-[#B8860B]' },
  top:     { label: 'Top Rated',   icon: Star,        cls: 'bg-amber-50 border-amber-200 text-amber-700'  },
  veteran: { label: 'Veteran',     icon: Award,       cls: 'bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]' },
  rising:  { label: 'Rising Star', icon: TrendingUp,  cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
};

/** Earned badges from a worker's stats — gamified reputation, no backend. */
export function computeBadges(o: {
  isPro?: boolean; rating?: number; shifts?: number; reviews?: number;
}): BadgeKey[] {
  const b: BadgeKey[] = [];
  if (o.isPro) b.push('pro');
  if ((o.rating ?? 0) >= 4.8 && (o.reviews ?? 0) >= 3) b.push('top');
  if ((o.shifts ?? 0) >= 50) b.push('veteran');
  else if ((o.shifts ?? 0) >= 10) b.push('rising');
  return b;
}

export function ProfileBadges(props: {
  isPro?: boolean; rating?: number; shifts?: number; reviews?: number;
  className?: string;
}) {
  const badges = computeBadges(props);
  if (!badges.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${props.className ?? ''}`} aria-label="Badges">
      {badges.map((key) => {
        const m = META[key];
        const Icon = m.icon;
        return (
          <span key={key}
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${m.cls}`}>
            <Icon size={12} aria-hidden className={key === 'top' ? 'fill-amber-400' : ''} />
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
