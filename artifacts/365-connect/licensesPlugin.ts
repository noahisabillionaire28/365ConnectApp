/**
 * Writes /third-party-licenses.txt at build time: the license of every
 * open-source package that ends up in the shipped bundle (MIT/ISC/OFL and
 * friends all ask for their notice to travel with the software), plus the
 * assets that carry their own terms (icons, photos, map data).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const LICENSE_FILES = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

/** Assets that are not npm code but come with terms of their own. */
const ASSET_NOTICES = `
Assets with their own terms
===========================

Icons: Lucide (lucide.dev), ISC License; see "lucide-react" below.
Sign-in logos: the Google "G" is from Flat Color Icons (MIT, via react-icons),
  the Apple logo is from Font Awesome Free (CC BY 4.0,
  https://fontawesome.com/license/free, via react-icons). Both marks are
  trademarks of Google LLC and Apple Inc., used only to label their sign-in
  buttons.
Font: Space Grotesk, SIL Open Font License 1.1; see
  "@fontsource-variable/space-grotesk" below.
Shift cover photos: Unsplash (unsplash.com), used under the Unsplash License
  (https://unsplash.com/license).
Map data: © OpenStreetMap contributors (ODbL, openstreetmap.org/copyright);
  map tiles © CARTO; Apple Maps where available.
The 365 Connect name, logo and app icon are the property of 365 Connect.
`;

function packageRoot(id: string): string | null {
  const i = id.lastIndexOf('node_modules/');
  if (i < 0) return null;
  const rest = id.slice(i + 'node_modules/'.length).split('/');
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  return id.slice(0, i + 'node_modules/'.length) + name;
}

export function thirdPartyLicenses(): Plugin {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const roots = new Set<string>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of Object.keys(chunk.modules)) {
          const root = packageRoot(id.replace(/\\/g, '/').replace(/^\0/, ''));
          if (root) roots.add(root);
        }
      }
      const entries = new Map<string, string>();
      for (const root of roots) {
        let pkg: { name?: string; version?: string; license?: unknown; author?: unknown; homepage?: string };
        try { pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { continue; }
        if (!pkg.name || entries.has(pkg.name)) continue;
        const file = fs.readdirSync(root).find((f) => LICENSE_FILES.test(f));
        const text = file ? fs.readFileSync(path.join(root, file), 'utf8').trim() : '';
        const license = typeof pkg.license === 'string' ? pkg.license : 'see text';
        entries.set(pkg.name, `${pkg.name}@${pkg.version ?? ''} (${license})${pkg.homepage ? `\n${pkg.homepage}` : ''}\n\n${text || `Licensed under ${license}.`}`);
      }
      const body = [...entries.keys()].sort().map((k) => entries.get(k)).join('\n\n' + '-'.repeat(72) + '\n\n');
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source: `365 Connect: open-source software and third-party notices\n${ASSET_NOTICES}\nOpen-source packages\n====================\n\n${body}\n`,
      });
    },
  };
}
