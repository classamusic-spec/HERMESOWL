import { forwardRef, useId } from 'react';
import {
  ANCHORS,
  BEAK_MAX_DROP,
  HERMES_COLORS as C,
  LID_TRAVEL,
  RIG_SHAPES,
  STROKE,
  VIEW_BOX,
} from './geometry';
import { SOURCE_ART, type ArtPath } from './sourceArt';

export interface HermesOwletSVGProps {
  /** Rendered size. Any CSS length; defaults to filling the parent. */
  size?: number | string;
  className?: string;
  /** Accessible name. Set to null for a purely decorative instance. */
  title?: string | null;
}

/**
 * The approved Hermes Owlet head.
 *
 * Every shape of the character is a path from `owl.svg`, unmodified and in the
 * source's own coordinate space — this component only groups them so the rig
 * can move them, and adds the handful of shapes a single static pose cannot
 * provide: eyelids, brows, and the inside of the beak.
 *
 * No filters and no blurs, so the head composites for free and stays crisp from
 * 64 px to 512 px.
 */
export const HermesOwletSVG = forwardRef<SVGSVGElement, HermesOwletSVGProps>(
  function HermesOwletSVG({ size, className, title = 'Hermes Owlet' }, ref) {
    // Clip ids must be unique per instance; the human-readable names live on
    // `data-ho` and `id`, which the rig and tooling read.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ID = (name: string): string => `${uid}-${name}`;
    const url = (name: string): string => `url(#${ID(name)})`;

    const art = (p: ArtPath, key: number): JSX.Element => (
      <path
        key={key}
        d={p.d}
        fill={p.fill ?? 'none'}
        stroke={p.stroke ?? 'none'}
        strokeWidth={p.sw}
        strokeLinecap={p.stroke ? 'round' : undefined}
        strokeLinejoin={p.stroke ? 'round' : undefined}
      />
    );
    const draw = (group: readonly ArtPath[]): JSX.Element[] => group.map(art);

    const b = ANCHORS.beak;
    const seam = ANCHORS.beakSeam.y;

    /** The white of one eye, plus the dark rim that sits on it. */
    const sclera = (side: 'left' | 'right'): JSX.Element => (
      <g id={`${side}-sclera`} data-ho={`${side}-sclera`}>
        {draw(side === 'left' ? SOURCE_ART.leftSclera : SOURCE_ART.rightSclera)}
      </g>
    );

    /**
     * Pupil, lids and brow for one eye. The pupil group translates for gaze and
     * is clipped to the white, so it can never escape the eye; the lids ride
     * over it and are clipped to the same shape.
     */
    const eye = (side: 'left' | 'right'): JSX.Element => {
      const a = side === 'left' ? ANCHORS.leftEye : ANCHORS.rightEye;
      const clip = side === 'left' ? 'clip-eye-l' : 'clip-eye-r';
      return (
        <g key={side} id={`${side}-eye`} data-ho={`${side}-eye`}>
          <g clipPath={url(clip)}>
            <g id={`${side}-pupil`} data-ho={`${side}-pupil`} transform="translate(0 0)">
              {draw(side === 'left' ? SOURCE_ART.leftPupil : SOURCE_ART.rightPupil)}
            </g>
            <g transform={`translate(${a.x} ${a.y})`}>
              <g
                id={`${side}-lid`}
                data-ho={`${side}-lid`}
                transform={`translate(0 ${LID_TRAVEL.upperParked})`}
              >
                <path
                  d={RIG_SHAPES.upperLid}
                  fill={C.cream}
                  stroke={C.navyDeep}
                  strokeWidth={STROKE.lid}
                  strokeLinejoin="round"
                />
              </g>
              <g
                id={`${side}-lower-lid`}
                data-ho={`${side}-lower-lid`}
                transform={`translate(0 ${LID_TRAVEL.lowerParked})`}
              >
                <path
                  d={RIG_SHAPES.lowerLid}
                  fill={C.cream}
                  stroke={C.navyDeep}
                  strokeWidth={STROKE.lid}
                  strokeLinejoin="round"
                />
              </g>
            </g>
          </g>
        </g>
      );
    };

    return (
      <svg
        ref={ref}
        className={className}
        viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
        width={size ?? '100%'}
        height={size ?? '100%'}
        role={title ? 'img' : 'presentation'}
        aria-label={title ?? undefined}
        aria-hidden={title ? undefined : true}
        shapeRendering="geometricPrecision"
        style={{ overflow: 'visible', display: 'block' }}
      >
        {title ? <title>{title}</title> : null}
        <defs>
          <clipPath id={ID('clip-eye-l')}>
            <path d={SOURCE_ART.leftSclera[0]!.d} />
          </clipPath>
          <clipPath id={ID('clip-eye-r')}>
            <path d={SOURCE_ART.rightSclera[0]!.d} />
          </clipPath>
          {/* Splitting the beak with two clips means the halves reassemble into
              the source diamond exactly when the beak is shut, and part with
              clean mandible edges when it opens. */}
          <clipPath id={ID('clip-beak-upper')}>
            <rect x={b.left - 4} y={b.top - 6} width={b.right - b.left + 8} height={seam - b.top + 6.25} />
          </clipPath>
          <clipPath id={ID('clip-beak-lower')}>
            <rect x={b.left - 4} y={seam} width={b.right - b.left + 8} height={b.bottom - seam + 8} />
          </clipPath>
        </defs>

        <g id="owlet-root" data-ho="owlet-root">
          {/* ---------------------------------------------------------- halo */}
          <g id="halo-group" data-ho="halo-group" transform="translate(0 0)">
            <g id="halo-ring" data-ho="halo-ring" transform="translate(0 0)">
              <ellipse
                id="halo-bloom"
                data-ho="halo-bloom"
                cx={ANCHORS.halo.cx}
                cy={ANCHORS.halo.cy}
                rx={ANCHORS.halo.rx}
                ry={ANCHORS.halo.ry}
                fill="none"
                stroke={C.goldBright}
                strokeWidth={STROKE.halo + 4}
                opacity={0}
                style={{ mixBlendMode: 'screen' }}
              />
              <g id="halo" data-ho="halo">
                {art(SOURCE_ART.halo[0]!, 0)}
              </g>
            </g>
            <g id="halo-spark" data-ho="halo-spark" transform="translate(0 0)">
              {art(SOURCE_ART.halo[1]!, 1)}
            </g>
          </g>

          {/* ---------------------------------------------------------- head */}
          <g id="head-root" data-ho="head-root" transform="translate(0 0)">
            <g id="ear-wings-back">
              <g id="left-wing" data-ho="left-wing" transform="rotate(0)">
                {draw(SOURCE_ART.leftWing)}
              </g>
              <g id="right-wing" data-ho="right-wing" transform="rotate(0)">
                {draw(SOURCE_ART.rightWing)}
              </g>
            </g>

            <g id="head-chin" data-ho="head-chin">{draw(SOURCE_ART.headChin)}</g>
            <g id="face-mask" data-ho="face-mask">{draw(SOURCE_ART.face)}</g>

            {/* The white of both eyes sits under the navy hood, exactly as the
                source stacks it — that overlap is the owl's brow. */}
            {sclera('left')}
            {sclera('right')}
            <g id="crown-tuft" data-ho="crown-tuft">{draw(SOURCE_ART.headMass)}</g>
            <g id="head-sides" data-ho="head-sides">{draw(SOURCE_ART.headSides)}</g>

            {/* ------------------------------------------------------ effects */}
            <g id="effects" data-ho="effects">
              <g
                id="listening-glow"
                data-ho="listening-glow"
                fill="none"
                stroke={C.cyanBright}
                strokeWidth={2.2}
                opacity={0}
              >
                <ellipse cx={ANCHORS.leftHeadphone.x} cy={ANCHORS.leftHeadphone.y} rx={11} ry={19} />
                <ellipse cx={ANCHORS.rightHeadphone.x} cy={ANCHORS.rightHeadphone.y} rx={11} ry={19} />
              </g>
              <g
                id="speaking-pulse"
                data-ho="speaking-pulse"
                fill="none"
                stroke={C.cyan}
                strokeWidth={1.6}
                opacity={0}
              >
                <ellipse cx={ANCHORS.leftHeadphone.x} cy={ANCHORS.leftHeadphone.y} rx={13} ry={22} />
                <ellipse cx={ANCHORS.rightHeadphone.x} cy={ANCHORS.rightHeadphone.y} rx={13} ry={22} />
              </g>
              <g id="thinking-spark" data-ho="thinking-spark" opacity={0} transform="translate(0 0)">
                <path d={SOURCE_ART.halo[1]!.d} fill={C.goldBright} transform="translate(-77 -27) scale(0.55) translate(77 27)" />
              </g>
              <path
                id="error-pulse"
                data-ho="error-pulse"
                d={SOURCE_ART.headChin[1]!.d}
                fill="none"
                stroke={C.concern}
                strokeWidth={2.4}
                opacity={0}
              />
            </g>

            {/* The face rides a fraction of the head tilt — features lead the
                form they are painted on. */}
            <g id="face-layer" data-ho="face-layer" transform="translate(0 0)">
              <g id="forehead-star-group" data-ho="forehead-star-group" transform="translate(0 0)">
                <g
                  id="forehead-star-bloom"
                  data-ho="forehead-star-bloom"
                  opacity={0}
                  style={{ mixBlendMode: 'screen' }}
                >
                  <path d={SOURCE_ART.star[0]!.d} fill={C.goldBright} stroke={C.goldBright} strokeWidth={2.4} />
                </g>
                <g id="forehead-star" data-ho="forehead-star">{draw(SOURCE_ART.star)}</g>
              </g>

              <g id="eyes">{[eye('left'), eye('right')]}</g>

              <g id="brows">
                {(['left', 'right'] as const).map((side) => {
                  const a = side === 'left' ? ANCHORS.leftEye : ANCHORS.rightEye;
                  return (
                    <g
                      key={side}
                      id={`${side}-brow`}
                      data-ho={`${side}-brow`}
                      transform={`translate(${a.x} ${a.y - 19})`}
                      opacity={0}
                    >
                      <path
                        d={RIG_SHAPES.brow}
                        fill="none"
                        stroke={C.navyDeep}
                        strokeWidth={STROKE.brow}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </g>

              {/* ------------------------------------------------------- beak */}
              <g id="beak" data-ho="beak">
                {/* Revealed as the mandible drops, so speech reads even at 64 px. */}
                {/* The mouth is a static lens spanning the full possible
                    opening, tapering to the beak's corners. The lower mandible
                    covers it when shut and uncovers it as it drops, so the
                    opening is mouth-shaped at every amplitude instead of a bar. */}
                <path
                  id="beak-gap"
                  data-ho="beak-gap"
                  d={
                    `M ${b.left + 0.9} ${seam} L ${b.right - 0.9} ${seam} ` +
                    `Q ${ANCHORS.beakSeam.x} ${seam + BEAK_MAX_DROP * 2.1} ${b.left + 0.9} ${seam} Z`
                  }
                  fill={C.navyDeepest}
                  stroke="none"
                />
                <g id="upper-beak" data-ho="upper-beak" clipPath={url('clip-beak-upper')}>
                  {draw(SOURCE_ART.beak)}
                </g>
                <g id="lower-beak" data-ho="lower-beak" transform="translate(0 0)">
                  <g clipPath={url('clip-beak-lower')}>{draw(SOURCE_ART.beak)}</g>
                </g>
              </g>
            </g>

            <g id="headphones">
              <g id="left-headphone" data-ho="left-headphone">
                {draw(SOURCE_ART.leftPhone)}
                <path
                  id="left-headphone-lit"
                  data-ho="left-headphone-lit"
                  d={SOURCE_ART.leftPhone[5]!.d}
                  fill={C.cyan}
                />
              </g>
              <g id="right-headphone" data-ho="right-headphone">
                {draw(SOURCE_ART.rightPhone)}
                <path
                  id="right-headphone-lit"
                  data-ho="right-headphone-lit"
                  d={SOURCE_ART.rightPhone[5]!.d}
                  fill={C.cyan}
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    );
  },
);
