import { useLocation } from 'wouter';

/**
 * Renders a caption with tappable #hashtags (→ /hashtag/:tag) and @mentions
 * (→ /worker/:username). Handles follow the same rules as usernames
 * (a-z, 0-9, _ and .), so a trailing full stop is left out of the link.
 */
const TOKEN = /(#[A-Za-z0-9_]+|@[A-Za-z0-9_.]*[A-Za-z0-9_])/g;

export function Caption({ text, author }: { text: string; author?: string | null }) {
  const [, navigate] = useLocation();
  const parts = text.split(TOKEN);
  return (
    <>
      {author && (
        <button type="button" className="font-semibold"
          onClick={(e) => { e.stopPropagation(); navigate(`/worker/${author}`); }}>
          @{author}{' '}
        </button>
      )}
      {parts.map((p, i) => {
        if (p.startsWith('#') && p.length > 1) {
          return (
            <button key={i} type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/hashtag/${p.slice(1).toLowerCase()}`); }}
              className="text-[#2563EB] font-medium">
              {p}
            </button>
          );
        }
        if (p.startsWith('@') && p.length > 1) {
          return (
            <button key={i} type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/worker/${p.slice(1).toLowerCase()}`); }}
              className="text-[#2563EB] font-medium">
              {p}
            </button>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
