import type { HermesOwletPhase } from '../character/state/HermesOwletState';

/**
 * The world Hermes Owlet lives in: a high, quiet night sky.
 *
 * Every phase gets a mood rather than a hard swap, and the renderer blends
 * between them, so the room the agent sits in changes with its state without
 * ever announcing it. Nothing here is decoration for its own sake — each value
 * is a channel the agent can speak through.
 */
export interface WorldMood {
  /** Sky gradient, top to horizon. */
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** Two aurora veils, drifting at different rates. */
  auroraA: string;
  auroraB: string;
  auroraIntensity: number;
  /** Star brightness and how hard they twinkle. */
  starIntensity: number;
  starTwinkle: number;
  /** Drifting motes: the visible "attention" of the world. */
  moteWarm: string;
  moteCool: string;
  moteIntensity: number;
  moteSpeed: number;
  /** 0 = motes drift freely, 1 = they are drawn toward the owl. */
  moteAttraction: number;
  /** How much of the constellation is drawn in. */
  constellation: number;
  /** Glow pooled beneath the character. */
  groundGlow: string;
  groundIntensity: number;
  /** Rings that leave the owl while it speaks. */
  ripple: number;
}

const NIGHT = {
  skyTop: '#03060F',
  skyMid: '#0A1330',
  skyBottom: '#111F4A',
} as const;

const base: WorldMood = {
  ...NIGHT,
  auroraA: '#26397F',
  auroraB: '#0E5C8C',
  auroraIntensity: 0.5,
  starIntensity: 0.75,
  starTwinkle: 0.5,
  moteWarm: '#FFBE37',
  moteCool: '#00B4FE',
  moteIntensity: 0.5,
  moteSpeed: 0.5,
  moteAttraction: 0,
  constellation: 0.12,
  groundGlow: '#1F3172',
  groundIntensity: 0.5,
  ripple: 0,
};

export const WORLD_MOODS: Record<HermesOwletPhase, WorldMood> = {
  idle: base,

  listening: {
    ...base,
    skyBottom: '#12274F',
    auroraA: '#1C4C8E',
    auroraB: '#0089C4',
    auroraIntensity: 0.82,
    starIntensity: 0.85,
    moteIntensity: 0.8,
    moteSpeed: 0.62,
    // The world leans in with the owl.
    moteAttraction: 0.85,
    constellation: 0.2,
    groundGlow: '#0E6FA8',
    groundIntensity: 0.8,
  },

  thinking: {
    ...base,
    skyMid: '#0B1234',
    auroraA: '#3B3390',
    auroraB: '#164E96',
    auroraIntensity: 0.7,
    starIntensity: 0.95,
    starTwinkle: 0.85,
    moteIntensity: 0.7,
    moteSpeed: 0.85,
    moteAttraction: 0.3,
    // Reasoning draws the constellation in.
    constellation: 1,
    groundGlow: '#2B3F8F',
    groundIntensity: 0.6,
  },

  tool_use: {
    ...base,
    auroraA: '#3A3470',
    auroraB: '#2E7BA8',
    auroraIntensity: 0.78,
    starIntensity: 0.9,
    starTwinkle: 0.7,
    moteWarm: '#FFD979',
    moteIntensity: 1,
    moteSpeed: 1.35,
    moteAttraction: 0.55,
    constellation: 0.75,
    groundGlow: '#8A6A1E',
    groundIntensity: 0.75,
  },

  speaking: {
    ...base,
    skyBottom: '#16234C',
    auroraA: '#2E3C82',
    auroraB: '#1C6E9E',
    auroraIntensity: 0.72,
    starIntensity: 0.85,
    moteWarm: '#FFCF63',
    moteIntensity: 0.75,
    moteSpeed: 0.6,
    moteAttraction: -0.5,
    constellation: 0.25,
    groundGlow: '#5C4A1E',
    groundIntensity: 0.85,
    ripple: 1,
  },

  success: {
    ...base,
    skyBottom: '#1B2C58',
    auroraA: '#2F5AA8',
    auroraB: '#1E9AC0',
    auroraIntensity: 1,
    starIntensity: 1,
    starTwinkle: 0.9,
    moteWarm: '#FFE08A',
    moteIntensity: 1,
    moteSpeed: 1.1,
    moteAttraction: -1,
    constellation: 0.5,
    groundGlow: '#B98B22',
    groundIntensity: 1,
  },

  interrupted: {
    ...base,
    auroraIntensity: 0.6,
    starIntensity: 0.8,
    moteIntensity: 0.6,
    moteSpeed: 0.9,
    moteAttraction: 0.4,
    groundIntensity: 0.6,
  },

  error: {
    ...base,
    skyTop: '#0A0710',
    skyMid: '#160E22',
    skyBottom: '#2A1730',
    auroraA: '#5A2E46',
    auroraB: '#7A4038',
    auroraIntensity: 0.42,
    starIntensity: 0.4,
    starTwinkle: 0.2,
    moteWarm: '#E8836F',
    moteCool: '#8A5A70',
    moteIntensity: 0.3,
    moteSpeed: 0.25,
    constellation: 0,
    groundGlow: '#6B2F3A',
    groundIntensity: 0.4,
  },

  offline: {
    ...base,
    skyTop: '#01030A',
    skyMid: '#04081A',
    skyBottom: '#070E24',
    auroraA: '#131C40',
    auroraB: '#0A2436',
    auroraIntensity: 0.16,
    starIntensity: 0.3,
    starTwinkle: 0.12,
    moteIntensity: 0.1,
    moteSpeed: 0.12,
    constellation: 0,
    groundGlow: '#0E1636',
    groundIntensity: 0.14,
  },

  waking: {
    ...base,
    auroraIntensity: 0.6,
    starIntensity: 0.8,
    moteIntensity: 0.7,
    moteSpeed: 0.8,
    moteAttraction: -0.4,
    constellation: 0.3,
    groundIntensity: 0.7,
  },
};

/** A small, deliberately owl-ish constellation, in 0..1 scene coordinates. */
export const CONSTELLATION = {
  stars: [
    { x: 0.13, y: 0.2 },
    { x: 0.24, y: 0.13 },
    { x: 0.35, y: 0.22 },
    { x: 0.3, y: 0.36 },
    { x: 0.17, y: 0.34 },
    { x: 0.78, y: 0.16 },
    { x: 0.88, y: 0.26 },
    { x: 0.82, y: 0.4 },
    { x: 0.69, y: 0.31 },
  ],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 0],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 5],
  ] as [number, number][],
} as const;
