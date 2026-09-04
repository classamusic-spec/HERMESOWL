# Hermes Owlet

The animated character head for the Nous Research Hermes Agent companion app.

A front-facing magical owl — deep navy head, cream face mask, very large eyes with a
cyan lower crescent, a gold diamond beak, a four-point forehead star, feather wings and
headphone discs at the sides, and a floating halo. Flat colours, one heavy navy outline,
no textures, no gradients, no body. It reacts to Hermes agent state in realtime.

```
npm install
npm run dev          # simulator at http://localhost:5178
npm run build        # typecheck + production bundle
npm run typecheck
npm run export:svg   # regenerate ../Art/hermes-owlet/hermes-owlet.svg from the geometry
```

The simulator is the whole character exercised without Hermes running: every phase, every
micro-animation, gaze and glow sliders, a synthetic TTS amplitude source, a scripted Hermes
event session, a live state readout, an FPS badge, and a 64→512 px icon strip.

## Using the character

```tsx
import { HermesOwlet, type HermesOwletHandle } from './character';
import { HermesBridge, hermesEvents } from './bridge/HermesBridge';

const bridge = new HermesBridge();
const owl = useRef<HermesOwletHandle>(null);

<HermesOwlet ref={owl} bridge={bridge} size={128} />;

bridge.send(hermesEvents.connected());       // → waking → idle
bridge.send(hermesEvents.listeningStarted()); // → listening
owl.current?.setSpeechLevel(0.62);            // drives the beak, at audio rate
```

Without a bridge, drive it directly: `<HermesOwlet phase="thinking" emotion="focused" />`.

`SpeechMeter` turns a `MediaStream`, an `<audio>` element or any `AudioNode` into the
0–1 amplitude the beak reads; `createSyntheticSpeech()` stands in for it during development.

## How it is put together

```
src/
  character/
    HermesOwlet.tsx              React surface: phase, emotion, imperative handle
    svg/geometry.ts              LOCKED art data — paths, anchors, colour tokens
    svg/HermesOwletSVG.tsx       layered SVG, one stable id per animated feature
    state/                       phase enum, priority, machine, phase poses, expressions
    controllers/                 eye, blink, gaze, beak, halo, headphone, wing, idle, micro
    animation/                   easing, springs, one-shot timelines, seeded RNG
    rig/                         rAF engine, node map, dirty-checked DOM writer
  audio/SpeechMeter.ts           TTS amplitude → 0..1, fast attack / slow release
  bridge/HermesBridge.ts         normalised Hermes events → phase
  simulator/CharacterSimulator.tsx
scripts/export-static-svg.ts     emits the standalone asset from the same geometry
```

**React never animates.** It holds the phase and the emotion; that is all. Every animated
value is integrated in `HermesOwletRig` inside a single `requestAnimationFrame` loop and
written straight to SVG transforms and opacities. Writes are dirty-checked, so a still
character costs almost nothing, and the loop stops entirely while the tab is hidden.

**The phase is derived, not assigned.** `HermesOwletMachine` tracks independent facts —
connected, listening, running, tool active, speaking — and resolves the phase by priority
(`error > interrupted > offline > speaking > tool_use > listening > thinking > success >
waking > idle`). Overlapping Hermes events therefore cannot make the character flicker;
a lower-priority phase also has to wait out a 200 ms dwell before it can take over.

## Layers

```
HermesOwlet
├── halo-group
│   ├── halo-ring ─ halo-bloom · halo-back (far half) · halo (near half)
│   └── halo-spark
└── head-root                                   (float · tilt · squash/stretch)
    ├── crown-tuft
    ├── ear-wings-back ─ left-wing · right-wing (3 cream feathers + 2 gold accents)
    ├── head-base
    ├── tuft-shadow                             (clipped to the head)
    ├── head-rim
    ├── face-mask
    ├── face-occlusion                          (clipped to the mask)
    ├── effects ─ error-pulse · listening-glow · speaking-pulse · thinking-spark
    ├── face-layer                              (2.5D parallax plane)
    │   ├── forehead-star-group ─ forehead-star-bloom · forehead-star
    │   ├── eyes ─ {left,right}-eye
    │   │            └ sclera · {side}-pupil (iris · {side}-pupil-core
    │   │              · highlight · bounce) · {side}-eye-shade
    │   │              · {side}-lid · {side}-lower-lid
    │   ├── brows ─ left-brow · right-brow       (invisible at neutral)
    │   └── beak ─ beak-shadow · beak-gap · upper-beak · lower-beak
    └── headphones ─ {side}-headphone
                       └ {side}-headphone-glow · gold ring · cyan ring
                         · {side}-headphone-lit · inner disc · specular
```

Every feature carries both a stable `id` (`#head-root`, `#left-eye`, `#beak` …) and a
`data-ho` attribute of the same name. The rig looks nodes up by `data-ho`, so several
Owlets can share a page without their ids colliding.

## States

| Phase | Reads as |
| --- | --- |
| `offline` | eyes 85 % closed, halo dim and faded, star and cups dark, a trace of float — asleep |
| `waking` | halo lights, star lights, cups glow, eyes open, small head lift (≈900 ms) |
| `idle` | 2 px float over 3.5–5 s, random blink every 2.5–7 s (12 % doubles), slow gaze drift, halo rocking |
| `listening` | eyes wider, head lifts, wings raise 5°, cyan rings bright with a 1.5 s pulse and an outer glow ring |
| `thinking` | 3° head tilt, gaze drifts up-right, eyes narrow slightly, forehead star pulses, spark orbits faster |
| `tool_use` | focused eyes, pupils 95 %, star at full, cups alternate left/right, a second spark orbits outside the halo |
| `speaking` | beak articulates from TTS amplitude, head bobs with it, blinking and gaze continue |
| `success` | happy eye curve, small bounce, wings lift 7°, halo and star flash (≈700 ms) then idle |
| `interrupted` | beak stops dead and closes, eyes widen, head recoils (180 ms) then listening |
| `error` | eyes lower, brows angle in and up, star and cups dim, halo tilts 7° off-centre and flickers **once** |

Expressions (`neutral`, `happy`, `curious`, `focused`, `concerned`, `surprised`) modify the
same layers on top of the phase pose. Brows are fully transparent at neutral, so the
approved silhouette is untouched unless an expression asks for them.

## The polish pass

The character is lit by **one key light from the upper right** — a direction the
locked art already implies, with its upper-right eye specular and lower-left cyan
crescent. Everything below agrees with it. There are no filters and no blurs
anywhere, so the head still composites for free.

**Form.** One two-stop ramp per major shape — head, face mask, wings, iris, pupil,
beak, gold, cyan. Each is a small value shift around the locked token: enough to
give the shape volume, never enough to read as a gradient. The beak's ramp is
`userSpaceOnUse` and spans both halves, because an object-box ramp restarts on
each half and puts a value step straight back across the seam.

**Contact.** The crest drops a shadow onto the skull (its own path, offset and
clipped to the head), the beak drops one onto the mask, and the mask carries an
inner occlusion band where the navy overhangs it. Without these the features read
as decals sitting on top of the head rather than parts of it.

**Eyes.** A lid shadow across the top of the sclera, a bounce light on the pupil
opposite the specular, and a rim on the cyan. Two lights is what makes an eye read
as glass instead of a flat disc — and the eyes are where all the appeal lives.

**The halo is two arcs, not an ellipse.** The far half sits a couple of steps down
the gold ramp from the near half, and the rig breathes the ring's vertical scale.
That single split is what turns a flat ellipse into a ring seen in perspective.

Every intensity lives in `SHADING` in `geometry.ts`. Zero those numbers and the
whole pass collapses back to flat, with the silhouette and colour identity
untouched.

### Motion craft

- **Squash and stretch.** Rising on the breath stretches the head a fraction;
  bottoming out squashes it. Volume-preserving, pivoted at the base of the skull,
  under a percent either way — felt rather than seen.
- **2.5D parallax.** The face rides a fraction of the head tilt, so the features
  lead the form they are painted on instead of being welded flat to it.
- **Saccades.** Real eyes dart and settle rather than drift. The gaze spring is
  quick with a whisper of overshoot — full travel in ~300 ms, and never a snap.
- **Blink weight.** The lids press the eye about 5 % flatter as they close, and
  the pupil rolls down with them, the way a real one does.

## Notes

- **Beak, not mouth.** The gold beak is the speaking element, split into an upper and lower
  half. Each half is a fill plus an *open* outline that skips the shared seam, so at rest
  the beak is one clean diamond with no line across it. Amplitude is smoothed (fast attack,
  slow release), quantised to `BEAK_CLOSED / SMALL / MEDIUM / OPEN`, then sprung. Maximum
  drop is 9 units — about 4 % of the face height. Tune it at `BEAK_MAX_DROP`.
- **Glow is a colour step, not a filter.** Brightness walks a flat gold ramp on the halo
  stroke and the star fill. A translucent light layer over navy just reads as grey, and
  filters cost GPU time a companion app should not spend. The only exception is the two
  bloom shapes, which use `mix-blend-mode: screen` and only appear above 0.7 brightness.
- **The halo never spins.** It rocks about 1.6°, and a single spark drifts around inside it
  over 15 s at idle (7 s under tool use). A fast ring would read as a loading spinner.
- **Reduced motion.** With `reducedMotion="auto"` (the default) the character follows
  `prefers-reduced-motion`. Reduced motion stops floating, gaze drift, halo motion, wing
  sway and random micro-animations; blinking, beak articulation and every state change stay.
- **Backgrounds.** The navy silhouette is the same navy as the outline, so on a very dark
  background the head loses its edge and reads as a floating cream face. That is inherent to
  the approved art. The simulator's light/dark toggle is there to check both; on a dark
  desktop, place the companion on a lighter plate or keep the background below `#0c1330`.

## Measured

Chromium 131, production build, `speaking` (the busiest phase, beak + head bob + blink +
gaze + halo + cup pulse all live):

```
frame time   median 16.70 ms   p95 16.80 ms   max 16.80 ms      → a locked 60 fps
```

The shading pass costs nothing measurable: gradients are paint servers, not
filters, and the frame budget is identical before and after it.

Verified in the browser rather than asserted: the head floats and the spark orbits over time,
`Blink` moves the lid from `translate(0 -104)` to `translate(0 11.35)`, the beak reaches 24
distinct positions in 1.4 s of speech (max gap 10.1 of a possible 11), `INTERRUPTED` resets
`lower-beak` to `translate(0 0)` within 90 ms, reduced motion freezes head, spark and wings
while blink and beak keep working, and the scripted Hermes session walks
`idle → listening → idle → thinking → tool_use → thinking → speaking → thinking → success → idle`.

## Source reference

`reference/owl-source.svg` and `owl.svg` (repo root) are the original approved
Hermes Owlet art, preserved unchanged. The animated character is traced from it.
Known intentional differences in this V1 trace: the headphones are drawn as
concentric gold/cyan rings rather than the source's solid cyan over-ear cups
with a gold headband, and the head is a touch rounder. Both are noted so they
can be reconciled without rediscovering them.

## Where the art lives

`src/character/svg/geometry.ts` holds the locked art data; `HermesOwletSVG.tsx` is the
one description of how it is assembled.

`npm run export:svg` renders **that actual component** through `react-dom/server` and
writes the result to `reference/hermes-owlet-animated.svg` and `public/hermes-owlet.svg`.
It does not re-template the markup — an exporter that duplicates the SVG is one that goes
stale the first time the art changes. Do not hand-edit the exported files.

`owl.svg` and `reference/owl-source.svg` are the original approved art, preserved
untouched.
