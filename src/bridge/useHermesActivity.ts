import { useEffect, useState } from 'react';
import type { HermesOwletPhase } from '../character/state/HermesOwletState';

export type HermesLinkState = 'connecting' | 'live' | 'unavailable';

export interface HermesActivity {
  connected: boolean;
  sessionId: string | null;
  sessionTitle: string;
  source: string;
  model: string;
  phase: HermesOwletPhase;
  toolName: string | null;
  messageCount: number;
  toolCallCount: number;
  lastMessageId: number | null;
  lastRole: string | null;
  updatedAt: number;
}

const INITIAL_ACTIVITY: HermesActivity = {
  connected: false,
  sessionId: null,
  sessionTitle: 'Finding Hermes…',
  source: 'desktop',
  model: 'Hermes Agent',
  phase: 'offline',
  toolName: null,
  messageCount: 0,
  toolCallCount: 0,
  lastMessageId: null,
  lastRole: null,
  updatedAt: 0,
};

const ACTIVITY_PHASES = new Set<HermesOwletPhase>([
  'offline',
  'waking',
  'idle',
  'listening',
  'thinking',
  'tool_use',
  'speaking',
  'success',
  'interrupted',
  'error',
]);

const isActivity = (value: unknown): value is HermesActivity => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HermesActivity>;
  const nullableString = (field: unknown): boolean => field === null || typeof field === 'string';
  const nullableNumber = (field: unknown): boolean => field === null || (typeof field === 'number' && Number.isFinite(field));
  return (
    typeof candidate.connected === 'boolean' &&
    nullableString(candidate.sessionId) &&
    typeof candidate.sessionTitle === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.model === 'string' &&
    typeof candidate.phase === 'string' &&
    ACTIVITY_PHASES.has(candidate.phase as HermesOwletPhase) &&
    nullableString(candidate.toolName) &&
    typeof candidate.messageCount === 'number' &&
    Number.isFinite(candidate.messageCount) &&
    typeof candidate.toolCallCount === 'number' &&
    Number.isFinite(candidate.toolCallCount) &&
    nullableNumber(candidate.lastMessageId) &&
    nullableString(candidate.lastRole) &&
    typeof candidate.updatedAt === 'number' &&
    Number.isFinite(candidate.updatedAt)
  );
};

/**
 * Read-only bridge to the local Hermes session store exposed by the Vite host.
 * Message contents and tool arguments never cross this boundary; the UI receives
 * only activity metadata needed to animate the character.
 */
export const useHermesActivity = (): { activity: HermesActivity; linkState: HermesLinkState } => {
  const [activity, setActivity] = useState<HermesActivity>(INITIAL_ACTIVITY);
  const [linkState, setLinkState] = useState<HermesLinkState>('connecting');

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let failures = 0;
    let polling = false;
    let refreshQueued = false;

    const schedule = (): void => {
      if (stopped) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void poll();
      }, document.hidden ? 2500 : 650);
    };

    const poll = async (): Promise<void> => {
      if (stopped) return;
      if (polling) {
        refreshQueued = true;
        return;
      }
      polling = true;
      controller = new AbortController();
      try {
        const response = await fetch('/__hermes/activity', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Hermes activity endpoint returned ${response.status}`);
        const next: unknown = await response.json();
        if (!isActivity(next)) throw new Error('Hermes activity endpoint returned an invalid payload');
        if (stopped) return;
        failures = 0;
        setActivity(next);
        setLinkState(next.connected ? 'live' : 'unavailable');
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
        failures += 1;
        if (failures >= 3) {
          setLinkState('unavailable');
          setActivity((current) => ({
            ...current,
            connected: false,
            phase: 'offline',
            toolName: null,
          }));
        }
      } finally {
        polling = false;
        controller = null;
        if (stopped) return;
        if (refreshQueued) {
          refreshQueued = false;
          void poll();
        } else {
          schedule();
        }
      }
    };

    const onVisibility = (): void => {
      if (document.hidden) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (polling) refreshQueued = true;
      else void poll();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void poll();

    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { activity, linkState };
};
