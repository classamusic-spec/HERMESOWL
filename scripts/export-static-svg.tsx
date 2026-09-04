/**
 * Emits the standalone Hermes Owlet asset.
 *
 * This renders the real `HermesOwletSVG` component through react-dom/server
 * rather than re-templating the markup by hand. An exporter that duplicates the
 * SVG is an exporter that silently goes stale the first time the art changes —
 * so there is exactly one description of the character, and this reads it.
 *
 *   npm run export:svg
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HermesOwletSVG } from '../src/character/svg/HermesOwletSVG';

// Bundled to CJS (react-dom/server reaches for node builtins through require),
// so paths resolve from the package root that npm runs this in.
const root = process.cwd();
const targets = [
  resolve(root, 'reference/hermes-owlet-animated.svg'),
  resolve(root, 'public/hermes-owlet.svg'),
];

let markup = renderToStaticMarkup(
  createElement(HermesOwletSVG, { size: 512, title: 'Hermes Owlet' }),
);

// React omits the SVG namespace (the browser infers it inside a document); a
// standalone file needs it, plus the resting cyan the rig would otherwise fade in.
markup = markup.replace(
  '<svg ',
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ',
);
markup = markup.replace(/(data-ho="(?:left|right)-headphone-lit"[^>]*?)opacity="0"/g, '$1opacity="1"');

const svg = `${markup}\n`;

for (const out of targets) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg, 'utf8');
  console.log(`wrote ${out} (${svg.length} bytes)`);
}
