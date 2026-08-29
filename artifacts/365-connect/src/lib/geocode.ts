/**
 * Free address → coordinates lookup (OpenStreetMap / Nominatim). No API key.
 * Used to make the map/pin/directions match the address a shift was posted with,
 * even when the stored lat/lng are wrong (e.g. older shifts saved with the
 * poster's own location before geocoding-on-post existed).
 *
 * Results are cached in-module so re-visiting a shift doesn't re-hit Nominatim.
 */
export type Coords = { lat: number; lng: number };

const cache = new Map<string, Coords | null>();

export async function geocodeAddress(query: string): Promise<Coords | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
        encodeURIComponent(query),
      { headers: { Accept: 'application/json' } },
    );
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = Array.isArray(data) ? data[0] : undefined;
    if (hit) {
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const coords = { lat, lng };
        cache.set(key, coords);
        return coords;
      }
    }
  } catch { /* network / geocode failure — caller falls back to stored coords */ }
  cache.set(key, null);
  return null;
}
