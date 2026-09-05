import {
  HermesOwletMachine,
  type HermesEvent,
} from '../character/state/HermesOwletMachine';
import type { HermesOwletPhase } from '../character/state/HermesOwletState';

export type PhaseHandler = (phase: HermesOwletPhase) => void;
export type SpeechHandler = (level: number) => void;

/**
 * The seam between the Hermes agent and the character.
 *
 * Everything Hermes emits is normalised into `HermesEvent` before it reaches
 * the machine, so the character has no idea what a run, a tool call or a TTS
 * chunk actually is. Speech amplitude bypasses the machine entirely: it is a
 * continuous signal and belongs on the beak, not in the phase.
 */
export class HermesBridge {
  readonly machine: HermesOwletMachine;

  private phaseHandlers = new Set<PhaseHandler>();
  private speechHandlers = new Set<SpeechHandler>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(connected = false) {
    this.machine = new HermesOwletMachine(connected);
    this.machine.subscribe((phase) => {
      for (const handler of this.phaseHandlers) handler(phase);
    });
  }

  /** Feed one normalised event. Returns the phase it resolved to. */
  send(event: HermesEvent): HermesOwletPhase {
    if (event.type === 'SPEECH_LEVEL') {
      for (const handler of this.speechHandlers) handler(event.level);
      return this.machine.currentPhase;
    }
    if (event.type === 'SPEECH_STOPPED' || event.type === 'INTERRUPTED') {
      for (const handler of this.speechHandlers) handler(0);
    }
    try {
      return this.machine.send(event);
    } finally {
      this.scheduleTick();
    }
  }

  onPhase(handler: PhaseHandler): () => void {
    this.phaseHandlers.add(handler);
    // Catch up if a transient expired while nobody was subscribed.
    try {
      this.machine.tick();
    } catch (error) {
      // A handler that fails during catch-up never receives an unsubscribe
      // function, so remove it before propagating the consumer error.
      this.phaseHandlers.delete(handler);
      throw error;
    } finally {
      this.scheduleTick();
    }
    return () => {
      this.phaseHandlers.delete(handler);
      this.maybeStopTicking();
    };
  }

  onSpeechLevel(handler: SpeechHandler): () => void {
    this.speechHandlers.add(handler);
    return () => this.speechHandlers.delete(handler);
  }

  get phase(): HermesOwletPhase {
    return this.machine.currentPhase;
  }

  get activeTool(): string | undefined {
    return this.machine.activeTool;
  }

  /** Jump straight to a phase. For the simulator and for tests only. */
  forcePhase(phase: HermesOwletPhase): void {
    try {
      this.machine.forcePhase(phase);
    } finally {
      this.scheduleTick();
    }
  }

  dispose(): void {
    this.phaseHandlers.clear();
    this.speechHandlers.clear();
    this.maybeStopTicking();
  }

  /**
   * Transient phases expire on a clock. Schedule only the next relevant
   * boundary instead of polling forever while the agent is idle or hidden.
   */
  private scheduleTick(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.phaseHandlers.size === 0) return;

    const now = Date.now();
    const next = this.machine.nextTickAt(now);
    if (next === null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.machine.tick();
      } finally {
        this.scheduleTick();
      }
    }, Math.max(0, next - now));
  }

  private maybeStopTicking(): void {
    if (this.phaseHandlers.size > 0 || this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Convenience helpers for the common Hermes call sites. */
export const hermesEvents = {
  connected: (): HermesEvent => ({ type: 'CONNECTED' }),
  disconnected: (): HermesEvent => ({ type: 'DISCONNECTED' }),
  listeningStarted: (): HermesEvent => ({ type: 'LISTENING_STARTED' }),
  listeningStopped: (): HermesEvent => ({ type: 'LISTENING_STOPPED' }),
  runStarted: (): HermesEvent => ({ type: 'RUN_STARTED' }),
  textDelta: (text: string): HermesEvent => ({ type: 'TEXT_DELTA', text }),
  toolStarted: (tool?: string): HermesEvent => ({ type: 'TOOL_STARTED', tool }),
  toolFinished: (success: boolean): HermesEvent => ({ type: 'TOOL_FINISHED', success }),
  speechStarted: (): HermesEvent => ({ type: 'SPEECH_STARTED' }),
  speechLevel: (level: number): HermesEvent => ({ type: 'SPEECH_LEVEL', level }),
  speechStopped: (): HermesEvent => ({ type: 'SPEECH_STOPPED' }),
  interrupted: (): HermesEvent => ({ type: 'INTERRUPTED' }),
  runComplete: (): HermesEvent => ({ type: 'RUN_COMPLETE' }),
  error: (message?: string): HermesEvent => ({ type: 'ERROR', message }),
} as const;
