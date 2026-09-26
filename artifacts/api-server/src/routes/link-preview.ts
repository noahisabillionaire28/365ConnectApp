/**
 * GET /api/link-preview?url= — OpenGraph title/description/image for a link
 * pasted in chat.
 *
 * The server fetches a URL chosen by a user, so this is the one place the API
 * can be turned into a proxy into private networks. Guards:
 *   - http(s) only, hostname resolved with dns.lookup and every address
 *     checked against loopback / private / link-local / ULA / v4-mapped ranges
 *     (the literal-IP forms too);
 *   - redirects are not followed blindly: at most 3 hops, each re-checked;
 *   - at most 256 KB of the body is read, from a stream, with a 5 s timeout;
 *   - an LRU cache of 500 entries, and a per-user rate limit.
 * A DNS answer can still change between our lookup and fetch's own (rebinding);
 * the cap on bytes and the metadata-only parsing keep the blast radius small.
 */
import { Router } from 'express';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';

const router = Router();

type Preview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };

// ── LRU cache (Map keeps insertion order; re-insert on hit to bump) ──────────
const CACHE_MAX = 500;
const TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Preview | null }>();

function cacheGet(key: string): { value: Preview | null } | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at >= TTL) { cache.delete(key); return undefined; }
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: Preview | null): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

// ── Address checks ───────────────────────────────────────────────────────────
const MAX_BYTES = 256 * 1024;
const MAX_HOPS = 3;
const TIMEOUT_MS = 5000;

function v4Parts(ip: string): number[] | null {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/** True for any IPv4 that is not a public unicast address. */
function isPrivateV4(ip: string): boolean {
  const p = v4Parts(ip);
  if (!p) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;             // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true;             // carrier-grade NAT
  if (a === 169 && b === 254) return true;                       // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return true;              // private
  if (a === 192 && b === 168) return true;                       // private
  if (a === 192 && b === 0 && p[2] === 0) return true;           // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;          // benchmarking
  if (a >= 224) return true;                                     // multicast + reserved + broadcast
  return false;
}

/** Expand an IPv6 literal to eight 16-bit groups (null when malformed). */
function v6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  // Embedded IPv4 tail (::ffff:1.2.3.4) → two hex groups.
  const v4tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4tail) {
    const p = v4Parts(v4tail[1]);
    if (!p) return null;
    s = s.slice(0, -v4tail[1].length) + ((p[0] << 8) | p[1]).toString(16) + ':' + ((p[2] << 8) | p[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail].map((g) => parseInt(g || '0', 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

/** True for any IPv6 that is not a public unicast address. */
function isPrivateV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return true;
  const allZero = g.every((x) => x === 0);
  if (allZero) return true;                                                     // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true;           // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {                 // ::ffff:a.b.c.d
    return isPrivateV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) {                                       // 64:ff9b::/96 NAT64
    return isPrivateV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true;                                  // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true;                                  // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                                  // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;                          // documentation
  if (g[0] === 0x2002) return isPrivateV4(`${g[1] >> 8}.${g[1] & 255}.${g[2] >> 8}.${g[2] & 255}`); // 6to4
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind === 6) return isPrivateV6(ip);
  return true;
}

/** Resolve the URL's host and refuse it unless every address is public. */
async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Blocked host');
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('Blocked host');
    return;
  }
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error('Host not found');
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Blocked host');
}

// ── Fetch with manual, re-checked redirects and a byte cap ───────────────────
async function readCapped(res: Response, signal: AbortSignal): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, merged.length - off));
    merged.set(slice, off);
    off += slice.length;
    if (off >= merged.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

async function fetchHtml(start: URL): Promise<{ html: string; final: URL } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let url = start;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      await assertPublicHost(url);
      const r = await fetch(url.toString(), {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 365ConnectBot/1.0)', Accept: 'text/html' },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        r.body?.cancel().catch(() => {});
        if (!loc || hop === MAX_HOPS) return null;
        const next = new URL(loc, url);
        if (!['http:', 'https:'].includes(next.protocol)) return null;
        url = next;
        continue;
      }
      if (!r.ok) { r.body?.cancel().catch(() => {}); return null; }
      const type = r.headers.get('content-type') ?? '';
      if (!type.includes('text/html')) { r.body?.cancel().catch(() => {}); return null; }
      return { html: await readCapped(r, ctrl.signal), final: url };
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Metadata ─────────────────────────────────────────────────────────────────
function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i');
  const m = html.match(re) ?? html.match(re2);
  return m?.[1]?.trim() || null;
}

/** Only keep an image URL that is itself http(s) on a public-looking host. */
function safeImage(raw: string | null, base: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, base);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || (isIP(host) && isPrivateAddress(host))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const previewLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 60,
  keys: (req) => [`user:${req.userId ?? 'anon'}`],
  message: 'Too many link previews. Please wait a moment and try again.',
});

router.get('/', requireAuth, previewLimiter, async (req, res) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  let url: URL;
  try { url = new URL(raw); } catch { return res.status(400).json({ error: 'Invalid url' }); }
  if (!['http:', 'https:'].includes(url.protocol)) return res.status(400).json({ error: 'Invalid url' });
  if (url.username || url.password) return res.status(400).json({ error: 'Invalid url' });
  if (raw.length > 2048) return res.status(400).json({ error: 'Invalid url' });

  const key = url.toString();
  const hit = cacheGet(key);
  if (hit) return res.json(hit.value);

  try {
    await assertPublicHost(url);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked host' });
  }

  try {
    const got = await fetchHtml(url);
    if (!got) { cacheSet(key, null); return res.json(null); }
    const { html, final } = got;
    const title = meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null);
    const value: Preview = {
      url: key, title,
      description: meta(html, 'og:description') ?? meta(html, 'description'),
      image: safeImage(meta(html, 'og:image') ?? meta(html, 'twitter:image'), final),
      site: meta(html, 'og:site_name') ?? final.hostname.replace(/^www\./, ''),
    };
    cacheSet(key, value);
    return res.json(value);
  } catch {
    cacheSet(key, null);
    return res.json(null);
  }
});

export default router;
