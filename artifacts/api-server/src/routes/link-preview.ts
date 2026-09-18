import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

type Preview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };
const cache = new Map<string, { at: number; value: Preview | null }>();
const TTL = 6 * 60 * 60 * 1000;

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i');
  const m = html.match(re) ?? html.match(re2);
  return m?.[1]?.trim() || null;
}

/** GET /api/link-preview?url= — OpenGraph title/description/image for a link in chat. */
router.get('/', requireAuth, async (req, res) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  let url: URL;
  try { url = new URL(raw); } catch { return res.status(400).json({ error: 'Invalid url' }); }
  if (!['http:', 'https:'].includes(url.protocol)) return res.status(400).json({ error: 'Invalid url' });
  // Never fetch private/internal hosts.
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return res.status(400).json({ error: 'Blocked host' });

  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return res.json(hit.value);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(key, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 365ConnectBot/1.0)', Accept: 'text/html' }, redirect: 'follow' });
    clearTimeout(t);
    const type = r.headers.get('content-type') ?? '';
    if (!type.includes('text/html')) { cache.set(key, { at: Date.now(), value: null }); return res.json(null); }
    const html = (await r.text()).slice(0, 200_000);
    const title = meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null);
    let image = meta(html, 'og:image') ?? meta(html, 'twitter:image');
    if (image && image.startsWith('/')) image = `${url.origin}${image}`;
    const value: Preview = {
      url: key, title, description: meta(html, 'og:description') ?? meta(html, 'description'),
      image, site: meta(html, 'og:site_name') ?? url.hostname.replace(/^www\./, ''),
    };
    cache.set(key, { at: Date.now(), value });
    return res.json(value);
  } catch {
    cache.set(key, { at: Date.now(), value: null });
    return res.json(null);
  }
});

export default router;
