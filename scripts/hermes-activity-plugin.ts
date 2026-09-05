import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const API_PATH = '/__hermes/activity';
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const CACHE_MS = 300;
const DATABASE_RETRY_MS = 5_000;
const ACTIVITY_FRESH_SECONDS = 4;
const TOOL_ACTIVITY_TIMEOUT_SECONDS = 10 * 60;

interface SessionRow {
  id: string;
  source: string;
  title: string | null;
  model: string | null;
  ended_at: number | null;
  message_count: number;
  tool_call_count: number;
  last_activity_at: number | null;
  last_activity_description: string | null;
  message_id: number | null;
  role: string | null;
  tool_name: string | null;
  has_tool_calls: number;
  finish_reason: string | null;
  message_timestamp: number | null;
  response_chars: number;
}

export interface HermesActivityPayload {
  connected: boolean;
  sessionId: string | null;
  sessionTitle: string;
  source: string;
  model: string;
  phase: 'offline' | 'listening' | 'thinking' | 'tool_use' | 'speaking' | 'success' | 'idle';
  toolName: string | null;
  messageCount: number;
  toolCallCount: number;
  lastMessageId: number | null;
  lastRole: string | null;
  updatedAt: number;
}

const offlinePayload = (): HermesActivityPayload => ({
  connected: false,
  sessionId: null,
  sessionTitle: 'No active Hermes session',
  source: 'desktop',
  model: 'Hermes Agent',
  phase: 'offline',
  toolName: null,
  messageCount: 0,
  toolCallCount: 0,
  lastMessageId: null,
  lastRole: null,
  updatedAt: Date.now(),
});

export const derivePhase = (row: SessionRow, nowSeconds: number): HermesActivityPayload['phase'] => {
  if (row.ended_at !== null) return 'offline';

  const messageAge = row.message_timestamp === null ? Number.POSITIVE_INFINITY : nowSeconds - row.message_timestamp;
  const latestActivityAt = Math.max(row.last_activity_at ?? 0, row.message_timestamp ?? 0);
  const activityAge = latestActivityAt > 0 ? nowSeconds - latestActivityAt : Number.POSITIVE_INFINITY;
  const activityIsFresh = activityAge < ACTIVITY_FRESH_SECONDS;

  if (row.role === 'user') {
    if (messageAge < 1.1) return 'listening';
    return activityIsFresh ? 'thinking' : 'idle';
  }

  if (
    row.role === 'assistant' &&
    row.has_tool_calls === 1 &&
    (activityIsFresh || messageAge < TOOL_ACTIVITY_TIMEOUT_SECONDS)
  ) return 'tool_use';
  if (row.role === 'tool') return activityIsFresh ? 'thinking' : 'idle';

  if (row.role === 'assistant') {
    const speakingSeconds = Math.min(8, Math.max(2, row.response_chars / 22));
    if (messageAge < speakingSeconds) return 'speaking';
    if (messageAge < speakingSeconds + 0.7) return 'success';
  }

  return activityIsFresh && row.last_activity_description ? 'thinking' : 'idle';
};

export const buildQuery = (): string => `
WITH candidates AS (
  SELECT s.*,
         (
           SELECT MAX(m.timestamp)
           FROM messages m
           WHERE m.session_id = s.id AND m.active = 1
         ) AS latest_message_at
  FROM sessions s
  WHERE s.ended_at IS NULL
    AND s.source = 'desktop'
), target AS (
  SELECT *
  FROM candidates
  ORDER BY CASE WHEN id = @preferredSessionId THEN 0 ELSE 1 END,
           MAX(COALESCE(last_activity_at, 0), COALESCE(latest_message_at, 0), COALESCE(started_at, 0)) DESC
  LIMIT 1
), latest AS (
  SELECT m.*
  FROM messages m
  JOIN target t ON t.id = m.session_id
  WHERE m.active = 1
  ORDER BY m.id DESC
  LIMIT 1
)
SELECT
  t.id,
  t.source,
  t.title,
  t.model,
  t.ended_at,
  t.message_count,
  t.tool_call_count,
  t.last_activity_at,
  t.last_activity_description,
  l.id AS message_id,
  l.role,
  COALESCE(
    l.tool_name,
    CASE WHEN json_valid(l.tool_calls)
      THEN CASE
        WHEN json_extract(l.tool_calls, '$[0].function.name') = 'tool_call'
          AND json_valid(json_extract(l.tool_calls, '$[0].function.arguments'))
        THEN COALESCE(
          json_extract(
            json_extract(l.tool_calls, '$[0].function.arguments'),
            '$.name'
          ),
          json_extract(l.tool_calls, '$[0].function.name')
        )
        ELSE json_extract(l.tool_calls, '$[0].function.name')
      END
      ELSE NULL
    END
  ) AS tool_name,
  CASE WHEN l.tool_calls IS NOT NULL AND l.tool_calls != '' THEN 1 ELSE 0 END AS has_tool_calls,
  l.finish_reason,
  l.timestamp AS message_timestamp,
  LENGTH(COALESCE(l.content, '')) AS response_chars
FROM target t
LEFT JOIN latest l ON 1 = 1;
`;

const readActivityRow = async (databasePath: string, preferredSessionId: string | null): Promise<SessionRow | null> => {
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
    timeout: 1500,
  });
  try {
    const row = database.prepare(buildQuery()).get({ preferredSessionId }) as SessionRow | undefined;
    return row ?? null;
  } finally {
    database.close();
  }
};

const activityFromRow = (row: SessionRow): HermesActivityPayload => {
  return {
    connected: true,
    sessionId: row.id,
    sessionTitle: row.title?.trim() || 'Untitled conversation',
    source: row.source,
    model: row.model?.trim() || 'Hermes Agent',
    phase: derivePhase(row, Date.now() / 1000),
    toolName: row.tool_name || null,
    messageCount: row.message_count || 0,
    toolCallCount: row.tool_call_count || 0,
    lastMessageId: row.message_id,
    lastRole: row.role,
    updatedAt: Date.now(),
  };
};

const fileVersion = async (path: string): Promise<string> => {
  try {
    const details = await stat(path);
    return `${details.mtimeMs}:${details.size}`;
  } catch {
    return 'missing';
  }
};

const databaseVersion = async (databasePath: string): Promise<string> => {
  const [database, wal] = await Promise.all([
    fileVersion(databasePath),
    fileVersion(`${databasePath}-wal`),
  ]);
  return `${database}|${wal}`;
};

export const hermesActivityPlugin = (): Plugin => {
  const hermesHome = process.env.HERMES_HOME || join(homedir(), '.hermes');
  const databasePath = join(hermesHome, 'state.db');
  const rawSessionId = process.env.HERMES_SESSION_ID || '';
  const preferredSessionId = SESSION_ID_PATTERN.test(rawSessionId) ? rawSessionId : null;
  let cachedAt = 0;
  let cached: HermesActivityPayload = offlinePayload();
  let cachedRow: SessionRow | null = null;
  let cachedDatabaseVersion = '';
  let failedDatabaseVersion = '';
  let failureRetryAt = 0;
  let pending: Promise<HermesActivityPayload> | null = null;

  const getActivity = async (): Promise<HermesActivityPayload> => {
    if (Date.now() - cachedAt < CACHE_MS) return cached;
    const version = await databaseVersion(databasePath);
    if (version === failedDatabaseVersion && Date.now() < failureRetryAt) {
      cached = offlinePayload();
      cachedAt = Date.now();
      return cached;
    }
    if (version === cachedDatabaseVersion) {
      cached = cachedRow ? activityFromRow(cachedRow) : offlinePayload();
      cachedAt = Date.now();
      return cached;
    }
    if (!pending) {
      pending = readActivityRow(databasePath, preferredSessionId)
        .then((row) => {
          cachedRow = row;
          cachedDatabaseVersion = version;
          failedDatabaseVersion = '';
          failureRetryAt = 0;
          return row ? activityFromRow(row) : offlinePayload();
        })
        .catch(() => {
          cachedRow = null;
          failedDatabaseVersion = version;
          failureRetryAt = Date.now() + DATABASE_RETRY_MS;
          return offlinePayload();
        })
        .then((next) => {
          cached = next;
          cachedAt = Date.now();
          pending = null;
          return next;
        });
    }
    return pending;
  };

  const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.setHeader('Allow', 'GET');
      response.end();
      return;
    }

    const payload = await getActivity();
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(JSON.stringify(payload));
  };

  return {
    name: 'hermes-activity',
    configureServer(server) {
      server.middlewares.use(API_PATH, handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(API_PATH, handler);
    },
  };
};
