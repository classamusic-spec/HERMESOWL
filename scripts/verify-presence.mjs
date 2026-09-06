import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const compiledPath = new URL('../node_modules/.cache/hermes-presence-verify.mjs', import.meta.url).pathname;
const entry = new URL('../src/character/state/adaptivePresence.ts', import.meta.url).pathname;

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: compiledPath,
  logLevel: 'silent',
});

const failures = [];
try {
  const { ADAPTIVE_PRESENCE, deriveAdaptivePresence } = await import(
    `${pathToFileURL(compiledPath).href}?${Date.now()}`
  );

  const expected = {
    offline: ['offline', 'neutral', 0.08],
    waking: ['curious', 'curious', 0.55],
    idle: ['calm', 'neutral', 0.22],
    listening: ['curious', 'curious', 0.62],
    thinking: ['focused', 'focused', 0.72],
    tool_use: ['active', 'focused', 0.88],
    speaking: ['warm', 'happy', 0.68],
    success: ['excited', 'excited', 1],
    interrupted: ['alert', 'curious', 0.82],
    error: ['concerned', 'concerned', 0.35],
  };

  for (const [phase, [mood, emotion, energy]] of Object.entries(expected)) {
    const actual = deriveAdaptivePresence(phase);
    if (actual !== ADAPTIVE_PRESENCE[phase]) {
      failures.push(`${phase}: deriveAdaptivePresence must return the canonical preset`);
    }
    if (actual.mood !== mood) failures.push(`${phase}: expected mood ${mood}, got ${actual.mood}`);
    if (actual.emotion !== emotion) failures.push(`${phase}: expected emotion ${emotion}, got ${actual.emotion}`);
    if (actual.energy !== energy) failures.push(`${phase}: expected energy ${energy}, got ${actual.energy}`);
    if (!actual.label || !actual.cue) failures.push(`${phase}: label and cue must be non-empty`);
  }

  const moods = new Set(Object.values(ADAPTIVE_PRESENCE).map((presence) => presence.mood));
  for (const mood of ['calm', 'curious', 'focused', 'warm', 'excited', 'concerned']) {
    if (!moods.has(mood)) failures.push(`missing readable mood: ${mood}`);
  }
} finally {
  rmSync(compiledPath, { force: true });
}

if (failures.length) {
  console.error(`Adaptive presence verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Adaptive presence verification passed: all 10 phases expose a readable mood, expression, cue, and energy level.');
