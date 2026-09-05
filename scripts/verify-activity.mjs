import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const entry = new URL('hermes-activity-plugin.ts', import.meta.url).pathname;
const compiledPath = join(process.cwd(), '.hermes-activity-verify.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  external: ['better-sqlite3'],
  platform: 'node',
  format: 'esm',
  outfile: compiledPath,
  logLevel: 'silent',
});
const moduleUrl = `${pathToFileURL(compiledPath).href}?${Date.now()}`;
const { buildQuery, derivePhase } = await import(moduleUrl);

const now = 10_000;
const base = {
  id: 'test-session',
  source: 'desktop',
  title: 'Test',
  model: 'test-model',
  ended_at: null,
  message_count: 1,
  tool_call_count: 0,
  last_activity_at: now,
  last_activity_description: 'receiving stream response',
  message_id: 1,
  role: 'assistant',
  tool_name: null,
  has_tool_calls: 0,
  finish_reason: 'stop',
  message_timestamp: now - 1,
  response_chars: 66,
};

const cases = [
  ['ended sessions go offline', { ...base, ended_at: now }, 'offline'],
  ['new user input reads as listening', { ...base, role: 'user', message_timestamp: now - 0.4 }, 'listening'],
  ['active user turn reads as thinking', { ...base, role: 'user', message_timestamp: now - 2 }, 'thinking'],
  ['assistant tool call reads as tool use', { ...base, has_tool_calls: 1, finish_reason: 'tool_calls' }, 'tool_use'],
  ['fresh tool result returns to thinking', { ...base, role: 'tool', message_timestamp: now - 0.2 }, 'thinking'],
  ['fresh message overrides stale session activity', { ...base, role: 'tool', last_activity_at: now - 40, message_timestamp: now - 0.2 }, 'thinking'],
  ['orphaned tool calls expire to idle', { ...base, has_tool_calls: 1, finish_reason: 'tool_calls', last_activity_at: now - 900, message_timestamp: now - 900 }, 'idle'],
  ['fresh final response reads as speaking', { ...base, message_timestamp: now - 1 }, 'speaking'],
  ['completed response flashes success', { ...base, response_chars: 44, message_timestamp: now - 2.3 }, 'success'],
  ['settled response returns to idle', { ...base, last_activity_at: now - 20, message_timestamp: now - 20 }, 'idle'],
];

const failures = [];
for (const [label, row, expected] of cases) {
  const actual = derivePhase(row, now);
  if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
}

const fixtureDirectory = mkdtempSync(join(tmpdir(), 'hermes-activity-'));
const fixtureDatabase = join(fixtureDirectory, 'state.db');
let database;
try {
  database = new Database(fixtureDatabase);
  database.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, source TEXT, title TEXT, model TEXT, ended_at REAL,
      message_count INTEGER, tool_call_count INTEGER, last_activity_at REAL,
      last_activity_description TEXT, started_at REAL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, session_id TEXT, active INTEGER, timestamp REAL,
      role TEXT, tool_name TEXT, tool_calls TEXT, finish_reason TEXT, content TEXT
    );
    INSERT INTO sessions VALUES
      ('old-session', 'desktop', 'Old', 'model', NULL, 1, 0, 9950, NULL, 9000),
      ('fresh-message', 'desktop', 'Fresh', 'model', NULL, 1, 0, 9000, NULL, 9000);
    INSERT INTO messages VALUES
      (1, 'old-session', 1, 9900, 'assistant', NULL, NULL, 'stop', 'old'),
      (2, 'fresh-message', 1, 9998, 'user', NULL, NULL, NULL, 'fresh');
  `);

  const query = (preferredSessionId) => database.prepare(buildQuery()).get({ preferredSessionId });
  const fallback = query(null);
  const preferred = query('old-session');
  if (fallback?.id !== 'fresh-message') {
    failures.push(`fallback selection ignored newest message: expected fresh-message, got ${fallback?.id}`);
  }
  if (preferred?.id !== 'old-session') {
    failures.push(`preferred session selection failed: expected old-session, got ${preferred?.id}`);
  }

  const wrappedCall = JSON.stringify([{
    function: {
      name: 'tool_call',
      arguments: JSON.stringify({ name: 'process_manage', arguments: { action: 'poll' } }),
    },
  }]);
  database.prepare('UPDATE messages SET tool_calls = ? WHERE id = 1').run(wrappedCall);
  const wrapped = query('old-session');
  if (wrapped?.tool_name !== 'process_manage') {
    failures.push(`wrapped tool name extraction failed: expected process_manage, got ${wrapped?.tool_name}`);
  }
} finally {
  database?.close();
  rmSync(fixtureDirectory, { recursive: true, force: true });
  rmSync(compiledPath, { force: true });
}

if (failures.length) {
  console.error(`Activity verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Activity verification passed: ${cases.length} conversation states, 2 session selections, and wrapped tool names mapped correctly.`);
