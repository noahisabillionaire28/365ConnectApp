import { BottomTabNav } from '@/components/BottomTabNav';

export function JobsScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col pb-[72px]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-white font-bold text-4xl mb-3 tracking-tight">Jobs</h1>
        <p className="text-[#9A9A9A] text-[15px]">Coming soon</p>
      </div>
      <BottomTabNav />
    </div>
  );
}
