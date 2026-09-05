import { clamp01, damp, lerp } from '../character/animation/easing';
import { createRng, type Rng } from '../character/animation/random';
import { CONSTELLATION, WORLD_MOODS, type WorldMood } from './worldTheme';
import type { HermesOwletPhase } from '../character/state/HermesOwletState';

interface Star {
  x: number;
  y: number;
  r: number;
  /** 0 far .. 1 near; drives parallax and brightness. */
  depth: number;
  phase: number;
  speed: number;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  depth: number;
  drift: number;
  sway: number;
  phase: number;
  warm: boolean;
}

interface Ripple {
  t: number;
  strength: number;
}

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbStr = (c: RGB, a: number): string =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const lerpRgb = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Colour channels of a mood, kept separate so they can be blended numerically. */
const COLOR_KEYS = [
  'skyTop',
  'skyMid',
  'skyBottom',
  'auroraA',
  'auroraB',
  'moteWarm',
  'moteCool',
  'groundGlow',
] as const;
const NUMBER_KEYS = [
  'auroraIntensity',
  'starIntensity',
  'starTwinkle',
  'moteIntensity',
  'moteSpeed',
  'moteAttraction',
  'constellation',
  'groundIntensity',
  'ripple',
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type NumberKey = (typeof NUMBER_KEYS)[number];

/** Fraction of the gap left after one second while a mood changes. */
const MOOD_BLEND = 1e-3;

/**
 * The night sky the character sits in.
 *
 * One canvas, one rAF, and no per-frame allocation. Everything soft is drawn by
 * stamping a single pre-rendered radial sprite rather than building gradients
 * each frame, which is the difference between this costing nothing and this
 * costing more than the character does.
 */
export class WorldRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private raf = 0;
  private running = false;
  private lastTime = 0;
  private time = 0;

  private rng: Rng;
  private stars: Star[] = [];
  private motes: Mote[] = [];
  private ripples: Ripple[] = [];
  private rippleClock = 0;

  /** A white radial sprite, tinted at draw time. Built once. */
  private glow!: HTMLCanvasElement;
  /** Transparent centre fading to dark edges. Rebuilt only on resize. */
  private vignette: HTMLCanvasElement | null = null;

  private colors: Record<ColorKey, RGB>;
  private numbers: Record<NumberKey, number>;
  private target: WorldMood = WORLD_MOODS.offline;

  private speechLevel = 0;
  private reducedMotion = false;
  private pointer = { x: 0, y: 0 };
  private parallax = { x: 0, y: 0 };
  /** Where the character sits, in 0..1 scene coordinates. */
  private focus = { x: 0.5, y: 0.56 };
  private burst = 0;

  constructor(private canvas: HTMLCanvasElement, seed?: number) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.rng = createRng(seed ?? 7);

    this.colors = {} as Record<ColorKey, RGB>;
    for (const k of COLOR_KEYS) this.colors[k] = hexToRgb(WORLD_MOODS.offline[k]);
    this.numbers = {} as Record<NumberKey, number>;
    for (const k of NUMBER_KEYS) this.numbers[k] = WORLD_MOODS.offline[k];

    this.buildGlowSprite();
    this.seedField();
    this.resize();
  }

  // ------------------------------------------------------------------ inputs

  setPhase(phase: HermesOwletPhase): void {
    const next = WORLD_MOODS[phase];
    if (next === this.target) return;
    this.target = next;
    if (phase === 'success' && !this.reducedMotion) this.burst = 1;
  }

  setSpeechLevel(level: number): void {
    this.speechLevel = clamp01(level);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) {
      this.burst = 0;
      this.ripples.length = 0;
      this.parallax.x = 0;
      this.parallax.y = 0;
    }
  }

  /** Pointer position in 0..1, for the parallax. */
  setPointer(x: number, y: number): void {
    this.pointer.x = clamp01(x) - 0.5;
    this.pointer.y = clamp01(y) - 0.5;
  }

  /** Where the owl is on screen, so motes and ripples know where to gather. */
  setFocus(x: number, y: number): void {
    this.focus.x = x;
    this.focus.y = y;
  }

  // ------------------------------------------------------------------ set-up

  private buildGlowSprite(): void {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.09)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.glow = c;
  }

  private seedField(): void {
    this.stars = [];
    for (let i = 0; i < 190; i++) {
      const depth = this.rng.next();
      this.stars.push({
        x: this.rng.next(),
        y: this.rng.range(0, 0.82),
        r: lerp(0.5, 1.9, depth * depth),
        depth,
        phase: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(0.5, 2.1),
      });
    }
    this.motes = [];
    for (let i = 0; i < 46; i++) {
      const depth = this.rng.next();
      this.motes.push({
        x: this.rng.next(),
        y: this.rng.next(),
        r: lerp(1.1, 3.6, depth),
        depth,
        drift: this.rng.range(0.008, 0.03),
        sway: this.rng.range(0.15, 0.5),
        phase: this.rng.range(0, Math.PI * 2),
        warm: this.rng.chance(0.42),
      });
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildVignette();
  }

  /** Corner falloff, so the eye is pushed to the character. */
  private buildVignette(): void {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const g = c.getContext('2d');
    if (!g) return;
    const r = Math.hypot(this.width, this.height) * 0.62;
    const grad = g.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      r * 0.32,
      this.width * 0.5,
      this.height * 0.5,
      r,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad;
    g.fillRect(0, 0, this.width, this.height);
    this.vignette = c;
  }

  // -------------------------------------------------------------------- loop

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const frame = (now: number): void => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private update(dt: number): void {
    if (!this.reducedMotion) this.time += dt;
    for (const k of COLOR_KEYS) {
      const want = hexToRgb(this.target[k]);
      this.colors[k] = this.reducedMotion
        ? want
        : lerpRgb(this.colors[k], want, 1 - Math.pow(MOOD_BLEND, dt));
    }
    for (const k of NUMBER_KEYS) {
      this.numbers[k] = this.reducedMotion
        ? this.target[k]
        : damp(this.numbers[k], this.target[k], MOOD_BLEND, dt);
    }

    const px = this.reducedMotion ? 0 : this.pointer.x;
    const py = this.reducedMotion ? 0 : this.pointer.y;
    this.parallax.x = damp(this.parallax.x, px, 0.02, dt);
    this.parallax.y = damp(this.parallax.y, py, 0.02, dt);

    if (this.burst > 0) this.burst = Math.max(0, this.burst - dt / 0.9);

    // Motes drift, and lean toward or away from the owl as the mood asks.
    const speed = this.reducedMotion ? 0 : this.numbers.moteSpeed;
    const pull = this.numbers.moteAttraction;
    for (const m of this.motes) {
      m.y -= m.drift * speed * dt * 12;
      if (!this.reducedMotion) m.phase += dt * m.sway;
      if (!this.reducedMotion && pull !== 0) {
        m.x += (this.focus.x - m.x) * pull * 0.06 * dt;
        m.y += (this.focus.y - m.y) * pull * 0.06 * dt;
      }
      if (m.y < -0.06) {
        m.y = 1.06;
        m.x = this.rng.next();
      } else if (m.y > 1.1) {
        m.y = -0.05;
        m.x = this.rng.next();
      }
    }

    // Speech leaves rings behind it.
    if (!this.reducedMotion && this.numbers.ripple > 0.25 && this.speechLevel > 0.22) {
      this.rippleClock -= dt;
      if (this.rippleClock <= 0) {
        this.rippleClock = 0.42;
        this.ripples.push({ t: 0, strength: this.speechLevel });
        if (this.ripples.length > 6) this.ripples.shift();
      }
    }
    for (let i = this.ripples.length - 1; i >= 0 && !this.reducedMotion; i--) {
      const r = this.ripples[i]!;
      r.t += dt / 2.2;
      if (r.t >= 1) this.ripples.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------- paint

  /** Stamp the shared radial sprite, tinted and scaled. */
  private stamp(x: number, y: number, radius: number, color: RGB, alpha: number): void {
    if (alpha <= 0.002 || radius <= 0) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.glowTinted(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Tinted copies of the glow sprite, built on demand and cached by colour. */
  private tintCache = new Map<string, HTMLCanvasElement>();
  private glowTinted(color: RGB): HTMLCanvasElement {
    // Quantise so slow colour blends do not build a cache entry every frame.
    const key = `${color[0] >> 3}|${color[1] >> 3}|${color[2] >> 3}`;
    const hit = this.tintCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = this.glow.width;
    c.height = this.glow.height;
    const g = c.getContext('2d')!;
    g.drawImage(this.glow, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = rgbStr(color, 1);
    g.fillRect(0, 0, c.width, c.height);
    if (this.tintCache.size > 48) this.tintCache.clear();
    this.tintCache.set(key, c);
    return c;
  }

  private draw(): void {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const n = this.numbers;

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgbStr(this.colors.skyTop, 1));
    sky.addColorStop(0.55, rgbStr(this.colors.skyMid, 1));
    sky.addColorStop(1, rgbStr(this.colors.skyBottom, 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const t = this.reducedMotion ? 0 : this.time;
    const parX = this.parallax.x;
    const parY = this.parallax.y;

    // Aurora veils: two slow, enormous, very soft stamps.
    const auroraR = Math.max(W, H) * 0.75;
    this.stamp(
      W * (0.3 + Math.sin(t * 0.045) * 0.07) + parX * 26,
      H * (0.34 + Math.cos(t * 0.037) * 0.05) + parY * 18,
      auroraR,
      this.colors.auroraA,
      0.5 * n.auroraIntensity,
    );
    this.stamp(
      W * (0.72 + Math.cos(t * 0.032) * 0.08) + parX * 34,
      H * (0.46 + Math.sin(t * 0.051) * 0.06) + parY * 24,
      auroraR * 0.82,
      this.colors.auroraB,
      0.42 * n.auroraIntensity,
    );

    // Constellation, drawn in as the agent reasons.
    if (n.constellation > 0.02) {
      const c = CONSTELLATION;
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbStr(this.colors.auroraB, 0.5 * n.constellation);
      ctx.beginPath();
      for (const [a, bIdx] of c.edges) {
        const s0 = c.stars[a]!;
        const s1 = c.stars[bIdx]!;
        const px0 = s0.x * W + parX * 12;
        const py0 = s0.y * H + parY * 8;
        ctx.moveTo(px0, py0);
        ctx.lineTo(
          lerp(px0, s1.x * W + parX * 12, clamp01(n.constellation)),
          lerp(py0, s1.y * H + parY * 8, clamp01(n.constellation)),
        );
      }
      ctx.stroke();
      for (const s of c.stars) {
        this.stamp(
          s.x * W + parX * 12,
          s.y * H + parY * 8,
          5.5,
          this.colors.auroraB,
          0.7 * n.constellation,
        );
      }
    }

    // Stars.
    ctx.fillStyle = '#FFFFFF';
    for (const s of this.stars) {
      const tw = 1 - n.starTwinkle * 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      const a = n.starIntensity * tw * lerp(0.35, 1, s.depth);
      if (a <= 0.02) continue;
      const x = s.x * W + parX * lerp(4, 22, s.depth);
      const y = s.y * H + parY * lerp(3, 15, s.depth);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Glow pooled under the character, and the rings speech leaves behind.
    const fx = this.focus.x * W;
    const fy = this.focus.y * H;
    this.stamp(
      fx,
      fy + H * 0.2,
      Math.min(W, H) * 0.55,
      this.colors.groundGlow,
      0.5 * n.groundIntensity + this.burst * 0.3,
    );

    // A tighter, brighter pool directly behind the head. The character's navy
    // is nearly the value of the night sky, so without this the silhouette
    // dissolves and the owl reads as a floating face. Lighting it from behind
    // keeps the head readable AND suits a character with a halo.
    const presence = lerpRgb(this.colors.groundGlow, [235, 242, 255], 0.42);
    this.stamp(
      fx,
      fy,
      Math.min(W, H) * 0.33,
      presence,
      (0.3 + 0.34 * n.groundIntensity + this.burst * 0.35) * lerp(0.45, 1, n.starIntensity),
    );

    for (const r of this.ripples) {
      const radius = Math.min(W, H) * (0.12 + r.t * 0.42);
      const a = (1 - r.t) * 0.16 * r.strength * n.ripple;
      if (a <= 0.004) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = rgbStr(this.colors.moteWarm, 1);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(fx, fy, radius, radius * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Motes last, so they read as the nearest layer.
    for (const m of this.motes) {
      const a = n.moteIntensity * lerp(0.25, 0.85, m.depth);
      if (a <= 0.02) continue;
      const x = m.x * W + Math.sin(m.phase) * 8 + parX * lerp(10, 44, m.depth);
      const y = m.y * H + parY * lerp(6, 30, m.depth);
      const color = m.warm ? this.colors.moteWarm : this.colors.moteCool;
      this.stamp(x, y, m.r * lerp(3.4, 6, m.depth) * (1 + this.burst * 0.6), color, a * 0.5);
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = rgbStr(color, 1);
      ctx.beginPath();
      ctx.arc(x, y, m.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, W, H);
  }
}
