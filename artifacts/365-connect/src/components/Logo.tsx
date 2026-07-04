export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-primary font-bold text-[40px] leading-none tracking-tight">365</span>
      <span className="text-white font-bold text-[40px] leading-none tracking-tight">CONNECT</span>
    </div>
  );
}
