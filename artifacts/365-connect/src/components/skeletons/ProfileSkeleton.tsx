/**
 * Skeleton for WorkerProfileScreen — shown while the Supabase fetch is in flight.
 * Matches the profile layout: square hero, username + role, bio, tags, stats bar, buttons, past shifts.
 */
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full bg-black overflow-y-auto">
      {/* Hero / avatar area */}
      <div className="w-full aspect-square bg-[#111] animate-pulse relative">
        {/* Back button placeholder */}
        <div className="absolute top-12 left-4 w-9 h-9 rounded-full bg-[#1A1A1A] animate-pulse" />
      </div>

      {/* Profile info */}
      <div className="px-5 pt-4 pb-6 flex flex-col gap-4">
        {/* Username + role */}
        <div className="flex flex-col gap-1.5">
          <div className="w-40 h-6 rounded-full bg-[#1A1A1A] animate-pulse" />
          <div className="w-16 h-4 rounded-full bg-[#1A1A1A] animate-pulse" />
        </div>

        {/* Bio lines */}
        <div className="flex flex-col gap-2">
          <div className="w-full h-3.5 rounded-full bg-[#1A1A1A] animate-pulse" />
          <div className="w-4/5 h-3.5 rounded-full bg-[#1A1A1A] animate-pulse" />
          <div className="w-2/3 h-3.5 rounded-full bg-[#1A1A1A] animate-pulse" />
        </div>

        {/* Job tags */}
        <div className="flex gap-2 flex-wrap">
          {[70, 90, 60, 80].map((w, i) => (
            <div key={i} className={`h-7 rounded-full bg-[#1A1A1A] animate-pulse`} style={{ width: w }} />
          ))}
        </div>

        {/* Stats bar */}
        <div className="h-[76px] rounded-[14px] bg-[#0E0E0E] border border-[#1E1E1E] animate-pulse" />

        {/* Action buttons */}
        <div className="flex gap-3">
          <div className="flex-1 h-[52px] rounded-[14px] bg-[#1A1A1A] animate-pulse" />
          <div className="flex-1 h-[52px] rounded-[14px] bg-[#1A1A1A] animate-pulse" />
          <div className="w-[52px] h-[52px] rounded-[14px] bg-[#1A1A1A] animate-pulse" />
        </div>

        {/* Past shifts section */}
        <div className="mt-2">
          <div className="w-24 h-3.5 rounded-full bg-[#1A1A1A] animate-pulse mb-4" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-4 bg-[#0E0E0E] border border-[#1E1E1E] rounded-[14px] p-4">
                <div className="w-11 h-11 rounded-[10px] bg-[#1A1A1A] animate-pulse flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="w-3/4 h-4 rounded-full bg-[#1A1A1A] animate-pulse" />
                  <div className="w-1/2 h-3 rounded-full bg-[#1A1A1A] animate-pulse" />
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <div className="w-16 h-3 rounded-full bg-[#1A1A1A] animate-pulse" />
                  <div className="w-8 h-3 rounded-full bg-[#1A1A1A] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
