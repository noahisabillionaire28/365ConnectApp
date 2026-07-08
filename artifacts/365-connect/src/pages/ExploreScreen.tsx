import { BottomTabNav } from '@/components/BottomTabNav';

export function ExploreScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: '#FFFFFF' }}>
      <div className="flex-1 flex items-center justify-center pb-[56px]">
        <p className="text-[15px] font-medium" style={{ color: '#6B7280' }}>
          Explore — coming soon
        </p>
      </div>
      <BottomTabNav />
    </div>
  );
}
