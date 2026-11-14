/**
 * The one way to draw a person's (or business's) picture.
 *
 * `AvatarFill` fills whatever box it is placed in: the photo when there is
 * one, otherwise a two-letter monogram from the name (a leading "@" is
 * ignored, so a handle never renders as "@"), otherwise a person icon. A
 * photo that fails to load falls back the same way. `Avatar` is the same
 * thing with its own round box.
 */
import { useState } from 'react';
import { User } from 'lucide-react';
import { initials } from '@/lib/jobFormat';

export function AvatarFill({ src, name, className = 'text-[#6B7280] font-bold text-[16px]' }: {
  src?: string | null;
  /** Name or handle the monogram is taken from. */
  name?: string | null;
  /** Text classes for the monogram (size, weight, colour). */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" aria-hidden loading="lazy" decoding="async" onError={() => setFailed(true)}
      className="w-full h-full object-cover" />;
  }
  const letters = initials(name);
  return (
    <span aria-hidden className={`w-full h-full flex items-center justify-center ${className}`}>
      {letters === '·' ? <User size={18} aria-hidden /> : letters}
    </span>
  );
}

export function Avatar({ src, name, size = 40, className = '' }: {
  src?: string | null; name?: string | null; size?: number; className?: string;
}) {
  return (
    <div style={{ width: size, height: size }}
      className={`rounded-full bg-[#F3F4F6] border border-[#E5E7EB] overflow-hidden flex-shrink-0 ${className}`}>
      <AvatarFill src={src} name={name} className="text-[#374151] font-bold" />
    </div>
  );
}
