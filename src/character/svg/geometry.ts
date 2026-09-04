/**
 * Hermes Owlet — anchors, palette and the few shapes the source art does not
 * contain.
 *
 * The character itself lives in `sourceArt.ts`, lifted verbatim from `owl.svg`.
 * This module works in the source's own coordinate space rather than rescaling
 * it, so the rendered head is the approved art to the pixel and every number
 * below can be read straight off the original file.
 *
 * The source is 156 x 144 with content spanning x 1.4..154.7 and y 19.1..126.9.
 * The view box below is a square window centred on that content, so the head
 * still works as an app, tray or status icon.
 */

export const VIEW_BOX = { x: -2, y: -7, width: 160, height: 160 } as const;

/**
 * Colour tokens, sampled from the source art. The character's own shapes carry
 * their colours inline; these are for the state effects layered over it.
 */
export const HERMES_COLORS = {
  navy: '#1F3172',
  navyDeep: '#00113D',
  navyDeepest: '#001342',
  cream: '#FFF7EA',
  creamShade: '#FCF2E3',
  white: '#FFFFFF',
  cyan: '#00B4FE',
  cyanBright: '#5FD5FF',
  cyanDim: '#0B6FA8',
  gold: '#FFBE37',
  goldLight: '#FFC74A',
  goldDark: '#D89019',
  goldBright: '#FFE08A',
  concern: '#E8836F',
} as const;

export type HermesColorToken = keyof typeof HERMES_COLORS;

/**
 * Brightness is a flat colour step along this ramp, never a translucent layer
 * over navy — that only ever reads as grey. Index 0 is fully dimmed, 5 is the
 * source's locked gold, 10 is the brightest flash.
 */
export const GOLD_RAMP = [
  '#D89019',
  '#E0991F',
  '#E8A225',
  '#EFAC2B',
  '#F7B531',
  '#FFBE37',
  '#FFC548',
  '#FFCC58',
  '#FFD269',
  '#FFD979',
  '#FFE08A',
] as const;

/** The ear discs step along this ramp the same way. Index 5 is the source cyan. */
export const CYAN_RAMP = [
  '#0A3A5C',
  '#08547C',
  '#066E9D',
  '#0487BD',
  '#02A1DE',
  '#00BBFE',
  '#20C4FE',
  '#40CCFF',
  '#5FD5FF',
  '#7FDDFF',
  '#9FE6FF',
] as const;

/** Stroke weights, in source units. */
export const STROKE = {
  detail: 1.25,
  halo: 3.5998,
  brow: 2.4,
  lid: 1.25,
} as const;

/** Pivots and centres the rig animates around, all in source coordinates. */
export const ANCHORS = {
  /** The head tilts about a point low in the skull, so it reads as a neck tilt. */
  headPivot: { x: 78, y: 126 },
  leftWingPivot: { x: 33, y: 92 },
  rightWingPivot: { x: 123, y: 92 },
  leftEye: { x: 53.95, y: 93.95 },
  rightEye: { x: 101.8, y: 93.95 },
  leftHeadphone: { x: 24.7, y: 96.8 },
  rightHeadphone: { x: 130.4, y: 96.7 },
  halo: { cx: 76.95, cy: 26.85, rx: 30.75, ry: 7.75 },
  foreheadStar: { x: 77.6, y: 61.55 },
  /** Where the beak splits. The widest point of the diamond. */
  beakSeam: { x: 77.4, y: 104.6 },
  beak: { left: 71.3, right: 83.5, top: 97.4, bottom: 113.4 },
  eye: {
    /** Radius of the white of the eye. */
    scleraRadius: 14.9,
    /** The pupil never reaches the edge of the white. */
    maxGazeX: 2.2,
    maxGazeY: 1.6,
  },
} as const;

/**
 * How far the lower mandible drops at full amplitude, in source units — about a
 * quarter of the beak's height. Speech has to be legible at 64 px, so this is
 * deliberately more generous than a "barely moving" reading of the brief, while
 * still nowhere near a puppet.
 */
export const BEAK_MAX_DROP = 4;

/** Blink drive. Lids park off the eye at 0 and overlap at 1. */
export const LID_TRAVEL = {
  upperParked: -33,
  upperClosed: 4,
  lowerParked: 33,
  lowerClosed: 1.5,
} as const;

/**
 * Shapes the source art does not contain, because it is a single open-eyed
 * pose. All are in eye-local coordinates.
 */
export const RIG_SHAPES = {
  upperLid: 'M -23 -33 L 23 -33 L 23 -3.8 C 14.5 1.9 -14.5 1.9 -23 -3.8 Z',
  lowerLid: 'M -23 33 L 23 33 L 23 3.8 C 14.5 -1.9 -14.5 -1.9 -23 3.8 Z',
  /** Hidden at neutral, so the approved silhouette is untouched. */
  brow: 'M -9.5 0 C -4.5 -2.9 4.5 -2.9 9.5 0',
} as const;
