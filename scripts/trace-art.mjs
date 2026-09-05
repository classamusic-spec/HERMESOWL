/**
 * Regenerates `src/character/svg/sourceArt.ts` from `owl.svg`.
 *
 * The character's shapes are never re-drawn by hand — they are lifted from the
 * approved file in document order and only grouped, so "identical to the
 * source" stays a fact. GROUPS maps source path indices onto the layers the rig
 * needs to move; if the art is redrawn, re-check those indices.
 *
 *   node scripts/trace-art.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const GROUPS = {
  halo: [1, 0],
  leftWing: [16, 17, 26],
  rightWing: [15, 18, 25],
  headChin: [2, 3],
  face: [4, 5, 6],
  leftSclera: [7, 9],
  rightSclera: [8, 14],
  headMass: [10, 11],
  headSides: [12, 13, 29, 30],
  star: [37],
  leftPupil: [38, 39, 40],
  rightPupil: [41, 42, 43],
  beak: [44, 45, 46, 47, 48, 49, 50],
  leftPhone: [19, 27, 21, 22, 31, 33, 35],
  rightPhone: [20, 28, 23, 24, 32, 34, 36],
};

const svg = readFileSync(new URL('../owl.svg', import.meta.url), 'utf8');

const styles = new Map();
for (const m of svg.matchAll(/\.cls-(\d+)\s*\{([^}]+)\}/g)) {
  const decl = Object.fromEntries(
    m[2].split(';').filter(Boolean).map((d) => d.split(':').map((s) => s.trim())),
  );
  styles.set(`cls-${m[1]}`, decl);
}

const paths = [...svg.matchAll(/<path\b([^>]*)\/?\s*>/g)].map(([, rawAttributes]) => {
  const attrs = Object.fromEntries(
    [...rawAttributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
  if (!attrs.d) throw new Error('owl.svg contains a path without a d attribute');

  // Most source paths use a CSS class, while the large face base carries an
  // inline fill. Parse every path first, then let explicit attributes override
  // its class so no art silently disappears when the export style changes.
  const st = { ...(styles.get(attrs.class) ?? {}) };
  if (attrs.fill) st.fill = attrs.fill;
  if (attrs.stroke) st.stroke = attrs.stroke;
  if (attrs['stroke-width']) st['stroke-width'] = attrs['stroke-width'];

  const out = { d: attrs.d };
  if (st.fill && st.fill !== 'none') out.fill = st.fill.toUpperCase();
  if (st.stroke && st.stroke !== 'none') {
    out.stroke = st.stroke.toUpperCase();
    out.sw = Number(st['stroke-width'] ?? 1);
  }
  return out;
});

if (paths.length !== 51) throw new Error(`expected 51 paths in owl.svg, found ${paths.length}`);

const art = Object.fromEntries(
  Object.entries(GROUPS).map(([name, ids]) => [
    name,
    ids.map((i) => {
      const p = paths[i];
      if (!p) throw new Error(`owl.svg has no path at index ${i} (group ${name})`);
      return p;
    }),
  ]),
);

const header = `/**
 * Hermes Owlet — the approved art, verbatim.
 *
 * These path strings are lifted unmodified from \`owl.svg\`, the approved source
 * in this repository, and are grouped only so the rig can move them. Nothing is
 * re-traced and nothing is re-scaled: the coordinates are the source's own, and
 * the component renders them in the source's coordinate space. That is the only
 * way "identical to the source" can be a fact rather than a claim.
 *
 * Do not hand-edit. Regenerate with \`npm run trace:art\`.
 */

export interface ArtPath {
  d: string;
  fill?: string;
  stroke?: string;
  /** Stroke width, in source units. */
  sw?: number;
}

export const SOURCE_ART = `;

const body = JSON.stringify(art, null, 2).replace(/"(d|fill|stroke|sw)":/g, '$1:');
const out = new URL('../src/character/svg/sourceArt.ts', import.meta.url);
writeFileSync(out, `${header}${body} as const satisfies Record<string, readonly ArtPath[]>;\n`);
console.log(`traced ${paths.length} paths from owl.svg -> sourceArt.ts`);
