import type { HermesEmotion, HermesOwletPhase } from './HermesOwletState';

export type PresenceMood =
  | 'offline'
  | 'calm'
  | 'curious'
  | 'focused'
  | 'active'
  | 'warm'
  | 'excited'
  | 'alert'
  | 'concerned';

export interface AdaptivePresence {
  mood: PresenceMood;
  emotion: HermesEmotion;
  label: string;
  cue: string;
  /** Normalised visual intensity used by the HUD, 0..1. */
  energy: number;
}

/**
 * Human-readable emotional projection of an activity phase.
 *
 * The mapping stays metadata-only: it never inspects message text, reasoning,
 * tool arguments, or results. Phase tells the body what Hermes is doing;
 * adaptive presence makes the feeling legible before the response appears.
 */
export const ADAPTIVE_PRESENCE: Record<HermesOwletPhase, AdaptivePresence> = {
  offline: {
    mood: 'offline',
    emotion: 'neutral',
    label: 'Resting',
    cue: 'Presence dimmed until the conversation reconnects.',
    energy: 0.08,
  },
  waking: {
    mood: 'curious',
    emotion: 'curious',
    label: 'Waking up',
    cue: 'Attention is returning to the room.',
    energy: 0.55,
  },
  idle: {
    mood: 'calm',
    emotion: 'neutral',
    label: 'Calm',
    cue: 'Quiet, present, and ready for you.',
    energy: 0.22,
  },
  listening: {
    mood: 'curious',
    emotion: 'curious',
    label: 'Curious',
    cue: 'Eyes open and the atmosphere leans toward you.',
    energy: 0.62,
  },
  thinking: {
    mood: 'focused',
    emotion: 'focused',
    label: 'Focused',
    cue: 'The gaze narrows as the constellation forms.',
    energy: 0.72,
  },
  tool_use: {
    mood: 'active',
    emotion: 'focused',
    label: 'In motion',
    cue: 'Warm signals accelerate while work happens.',
    energy: 0.88,
  },
  speaking: {
    mood: 'warm',
    emotion: 'happy',
    label: 'Warm',
    cue: 'The field softens as the answer arrives.',
    energy: 0.68,
  },
  success: {
    mood: 'excited',
    emotion: 'excited',
    label: 'Excited',
    cue: 'A bright bloom marks the completed thought.',
    energy: 1,
  },
  interrupted: {
    mood: 'alert',
    emotion: 'curious',
    label: 'Alert',
    cue: 'Attention snaps back to your voice.',
    energy: 0.82,
  },
  error: {
    mood: 'concerned',
    emotion: 'concerned',
    label: 'Concerned',
    cue: 'The atmosphere quiets while recovery begins.',
    energy: 0.35,
  },
};

export const deriveAdaptivePresence = (phase: HermesOwletPhase): AdaptivePresence =>
  ADAPTIVE_PRESENCE[phase];
