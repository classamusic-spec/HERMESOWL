import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const ROOT = new URL('../', import.meta.url);

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

const svg = await readFile(new URL('owl.svg', ROOT), 'utf8');
const sourceArtText = await readFile(new URL('src/character/svg/sourceArt.ts', ROOT), 'utf8');

const sourcePaths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/?\s*>/g)].map((match) => match[1]);
const compiled = await transform(sourceArtText, { loader: 'ts', format: 'esm' });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`;
const { SOURCE_ART } = await import(moduleUrl);

const generatedPaths = Object.values(SOURCE_ART).flat().map((path) => path.d);
const counts = (values) => {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};

const sourceCounts = counts(sourcePaths);
const generatedCounts = counts(generatedPaths);
const missing = sourcePaths.filter((path) => !generatedCounts.has(path));
const duplicated = [...generatedCounts].filter(([path, count]) => count !== sourceCounts.get(path));

const errors = [];
if (sourcePaths.length !== 51) errors.push(`expected 51 source paths, found ${sourcePaths.length}`);
if (generatedPaths.length !== 51) errors.push(`expected 51 generated paths, found ${generatedPaths.length}`);
if (missing.length) errors.push(`${missing.length} source path(s) missing from sourceArt.ts`);
if (duplicated.length) errors.push(`${duplicated.length} generated path count mismatch(es)`);

for (const [group, indices] of Object.entries(GROUPS)) {
  const actual = SOURCE_ART[group]?.map((path) => path.d) ?? [];
  const expected = indices.map((index) => sourcePaths[index]);
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    errors.push(`${group} does not match owl.svg path indices [${indices.join(', ')}]`);
  }
}

if (errors.length) {
  console.error(`Art verification failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Art verification passed: 51 source paths mapped exactly once with semantic groups intact.');
