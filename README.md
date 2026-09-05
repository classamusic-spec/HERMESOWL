# Hermes Owlet

The animated character head for the Nous Research Hermes Agent companion app.

A front-facing magical owl — deep navy head, cream face mask, very large eyes with a
cyan lower crescent, a gold diamond beak, a four-point forehead star, feather wings and
headphone discs at the sides, and a floating halo. Flat colours, one heavy navy outline,
no textures, no gradients, no body. It reacts to Hermes agent state in realtime.

Requires Node.js `^20.19.0` or `>=22.12.0`.

```
npm install
npm run dev          # interactive Hermes body at http://127.0.0.1:5178
npm run build        # typecheck + production bundle
npm run typecheck
npm run verify:art   # source-art coverage and semantic grouping regression
npm run verify:activity
npm run export:svg   # regenerate ../Art/hermes-owlet/hermes-owlet.svg from the geometry
```

The default dashboard is the Owlet's interactive body. When launched from Hermes Desktop,
its local-only activity bridge follows the active conversation: user input becomes listening,
model work becomes thinking, tool calls become tool use, and completed responses drive speaking
and success. Only session metadata crosses the bridge — message content, reasoning, tool
arguments, and tool results are never sent to the browser.
The bridge fingerprints SQLite's database and WAL files before querying, so an idle body does not
repeat database reads, and polling slows further while the dashboard is hidden. Read-only SQLite
access is bundled with the app, so the system `sqlite3` command is not required.

Open **Lab** (or `/?view=simulator`) for the full character simulator without Hermes running: every phase, every
micro-animation, gaze and glow sliders, a synthetic TTS amplitude source, a scripted Hermes
event session, a live state readout, an FPS badge, and a 64→512 px icon strip.

## Using the character

```tsx
import { HermesOwlet, type HermesOwletHandle } from './character';
import { HermesBridge, hermesEvents } from './bridge/HermesBridge';

const bridge = new HermesBridge();
const owl = useRef<HermesOwletHandle>(null);

// The head on its own …
<HermesOwlet ref={owl} bridge={bridge} size={128} />;

// … or the head in its world.
<HermesOwletStage ref={owl} bridge={bridge} scale={0.52} />;

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
    svg/sourceArt.ts             GENERATED — owl.svg's paths, verbatim
    svg/geometry.ts              anchors, palette, lids/brows/mouth
    svg/HermesOwletSVG.tsx       assembles the source paths into moving layers
    state/                       phase enum, priority, machine, phase poses, expressions
    controllers/                 eye, blink, gaze, beak, halo, headphone, wing, idle, micro
    animation/                   easing, springs, one-shot timelines, seeded RNG
    rig/                         rAF engine, node map, dirty-checked DOM writer
  world/
    HermesOwletStage.tsx         the companion window: owl + sky
    WorldScene.tsx               canvas host; parallax, visibility, resize
    WorldRenderer.ts             the night sky engine
    worldTheme.ts                a mood per phase, plus the constellation
  audio/SpeechMeter.ts           TTS amplitude -> 0..1, fast attack / slow release
  bridge/HermesBridge.ts         normalised Hermes events -> phase
  bridge/useHermesActivity.ts    privacy-minimal local conversation projection
  dashboard/                     interactive body HUD and signal view
  simulator/CharacterSimulator.tsx
scripts/
  hermes-activity-plugin.ts      local-only state.db metadata endpoint
  trace-art.mjs                  owl.svg -> sourceArt.ts
  verify-art.mjs                 source path/group regression
  verify-activity.mjs            conversation-to-phase regression
  export-static-svg.tsx          renders the real component to a standalone asset
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
HermesOwletStage
├── WorldScene                                   (canvas: sky, aurora, stars,
│                                                 constellation, motes, ripples)
└── HermesOwlet
    ├── halo-group ─ halo-ring (halo-bloom · halo) · halo-spark
    └── head-root                                (float · tilt · squash/stretch)
        ├── left-wing · right-wing
        ├── head-chin
        ├── face-mask
        ├── left-sclera · right-sclera           (under the navy hood: the brow)
        ├── crown-tuft                           (head mass + crest detail)
        ├── head-sides
        ├── effects ─ listening-glow · speaking-pulse · thinking-spark
        │             · error-pulse
        ├── face-layer                           (2.5D parallax plane)
        │   ├── forehead-star-group ─ forehead-star-bloom · forehead-star
        │   ├── eyes ─ {left,right}-eye
        │   │            └ {side}-pupil · {side}-lid · {side}-lower-lid
        │   ├── brows ─ left-brow · right-brow    (invisible at neutral)
        │   └── beak ─ beak-gap · upper-beak · lower-beak
        └── headphones ─ {side}-headphone · {side}-headphone-lit
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

## The art is the source, not a copy of it

`owl.svg` in this repository is the approved character. Rather than re-draw it,
`npm run trace:art` lifts all 51 of its paths **verbatim** into
`src/character/svg/sourceArt.ts`, grouped — and only grouped — into the layers
the rig needs to move. The component renders them in the source's own coordinate
space (156 x 144, windowed to a square view box), so nothing is rescaled and
nothing is approximated.

That is the whole reason the head is identical to the source: it *is* the
source. Every colour, curve and facet — the two-tone face shading, the four
faceted planes of the beak, the ear cups and their gold band, the feathered
wings — comes from the original file, not from a trace of a screenshot.

The rig adds only what a single static pose cannot contain: eyelids, brows, and
the inside of the beak.

## The talking animation

Speech has to be legible at 64 px, not just at 512, so the beak gets real
articulation rather than a hint of one.

The two mandibles are the **same source paths under two clip rectangles**, split
at the widest point of the diamond. Shut, they reassemble into the approved beak
exactly — no seam, no value step, nothing to give the trick away. Open, they part
with clean mandible edges, because a clipped path cuts flat where a real beak
hinges.

Behind them sits a static, tapering lens in the darkest navy of the palette,
spanning the full possible opening. The mandible *uncovers* it rather than
stretching it, so the mouth is mouth-shaped at every amplitude instead of a
widening bar. Full open is a quarter of the beak's height — well past subtle,
still nowhere near a puppet.

Amplitude is smoothed with a fast attack and a slow release, quantised to the
four locked shapes, then sprung, so syllables land crisply and trail off softly.
Measured live: **29 distinct beak positions in 1.6 s of speech**.

## The world

The owl lives somewhere. `HermesOwletStage` composes the character with
`WorldScene` — a night sky on a single canvas, reading the same phase the
character does, so the room and its occupant are never out of step.

| Layer | Behaviour |
| --- | --- |
| Sky | Three-stop gradient, blended between per-phase moods |
| Aurora | Two enormous soft veils drifting at different rates |
| Constellation | Draws itself in as the agent reasons; gone at idle |
| Stars | 190 across depth layers, twinkling, parallaxed by depth |
| Presence glow | A pool of light directly behind the head |
| Ripples | Rings leaving the owl while it speaks, on the beat of the amplitude |
| Motes | 46 drifting particles that lean toward the owl when it listens, and away when it speaks |
| Vignette | Corner falloff, pushing the eye to the character |

Moods per phase: idle is calm; **listening** brightens to cyan and the motes lean
in; **thinking** goes violet and connects the constellation; **tool use** runs warm
and fast; **speaking** pools gold and sheds rings; **success** blooms; **error**
shifts to a muted rose and the constellation goes out; **offline** is nearly black.
Phases blend rather than cut.

The presence glow is not decoration. The character's navy is nearly the value of
the night sky, so without a light behind it the silhouette dissolves and the owl
reads as a floating face. Lighting it from behind keeps the head readable — and
suits a character that already wears a halo.

Performance: everything soft is drawn by stamping one pre-rendered radial
sprite, tinted and cached by quantised colour, rather than building gradients per
frame. The canvas stops entirely when the tab is hidden or the stage scrolls out
of view.

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

Chromium, production build, **world and character both live**, in the `speaking`
phase — the busiest thing this renders:

```
frame time   median 16.70 ms   p95 16.80 ms   max 16.80 ms      → a locked 60 fps
```

Verified in the browser against the built page rather than asserted:

- 29 distinct beak positions in 1.6 s of speech; `INTERRUPTED` closes the beak
  within 90 ms
- squash and stretch, halo perspective, face parallax under tilt, a 298 ms gaze
  settle and the blink squash all confirmed live
- reduced motion freezes head, wings and spark while blink and beak keep working
- the scripted Hermes session walks
  `idle → listening → thinking → tool_use → speaking → success → idle`
- no page errors in any state

## Source reference

`reference/owl-source.svg` and `owl.svg` (repo root) are the original approved
Hermes Owlet art, preserved unchanged. The animated character is traced from it.
The animated character is not a trace of it — it renders the source's own paths.
See "The art is the source, not a copy of it" below.

## Where the art lives

`owl.svg` is the character. `npm run trace:art` lifts its paths verbatim into
`src/character/svg/sourceArt.ts`; `geometry.ts` holds only anchors, the palette and the
few shapes a static pose cannot contain; `HermesOwletSVG.tsx` is the one description of
how it is all assembled.

`npm run export:svg` renders **that actual component** through `react-dom/server` and
writes the result to `reference/hermes-owlet-animated.svg` and `public/hermes-owlet.svg`.
It does not re-template the markup — an exporter that duplicates the SVG is one that goes
stale the first time the art changes. Do not hand-edit the exported files.

`owl.svg` and `reference/owl-source.svg` are the original approved art, preserved
untouched — and now load-bearing rather than decorative.
