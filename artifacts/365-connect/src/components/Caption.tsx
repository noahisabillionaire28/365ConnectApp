import { useLocation } from 'wouter';

/** Renders a caption with tappable #hashtags (→ /hashtag/:tag). */
export function Caption({ text, author }: { text: string; author?: string | null }) {
  const [, navigate] = useLocation();
  const parts = text.split(/(#[A-Za-z0-9_]+)/g);
  return (
    <>
      {author && <span className="font-semibold">@{author} </span>}
      {parts.map((p, i) =>
        p.startsWith('#') && p.length > 1 ? (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/hashtag/${p.slice(1).toLowerCase()}`); }}
            className="text-[#2563EB] font-medium"
          >
            {p}
          </button>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
