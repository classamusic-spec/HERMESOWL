import { forwardRef, useId } from 'react';
import {
  ANCHORS,
  HALO_ARCS,
  HEAD_RIM_PATH,
  HEADPHONE,
  HERMES_COLORS as C,
  LID_TRAVEL,
  PAINT,
  PATHS,
  SHADING,
  STROKE,
  VIEW_BOX,
} from './geometry';

export interface HermesOwletSVGProps {
  /** Rendered size. Any CSS length; defaults to filling the parent. */
  size?: number | string;
  className?: string;
  /** Accessible name. Set to null for a purely decorative instance. */
  title?: string | null;
}

/**
 * The locked Hermes Owlet head, as layered vector art with a premium shading
 * pass laid over it.
 *
 * Nothing here animates on its own: every feature that moves is its own group
 * with a stable `data-ho` name and a neutral transform, which the rig drives.
 *
 * The shading follows one light from the upper right — the direction the locked
 * art already implies, with its upper-right eye specular and lower-left cyan
 * crescent. Volume comes from one two-stop ramp per major shape, a contact
 * occlusion band where layers overhang, and a single rim light; there are no
 * filters and no blurs, so the head still composites for free and stays crisp
 * at 64 px. Zero the values in `SHADING` and it collapses back to flat.
 */
export const HermesOwletSVG = forwardRef<SVGSVGElement, HermesOwletSVGProps>(
  function HermesOwletSVG({ size, className, title = 'Hermes Owlet' }, ref) {
    // Paint-server and clip ids must be unique per instance; the human-readable
    // names live on `data-ho` and `id`, which the rig and tooling read.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ID = (name: string): string => `${uid}-${name}`;
    const url = (name: string): string => `url(#${ID(name)})`;

    const e = ANCHORS.eye;
    const halo = ANCHORS.halo;

    /** One eye, mirrored by its sclera path. Shading is NOT mirrored — the
     *  light stays on the same side of the face for both eyes. */
    const eye = (side: 'left' | 'right'): JSX.Element => {
      const anchor = side === 'left' ? ANCHORS.leftEye : ANCHORS.rightEye;
      const sclera = side === 'left' ? PATHS.scleraLeft : PATHS.scleraRight;
      const clip = side === 'left' ? 'clip-eye-l' : 'clip-eye-r';
      return (
        <g
          key={side}
          id={`${side}-eye`}
          data-ho={`${side}-eye`}
          transform={`translate(${anchor.x} ${anchor.y})`}
        >
          <g clipPath={url(clip)}>
            <path d={sclera} fill={C.white} stroke="none" />
            <g id={`${side}-pupil`} data-ho={`${side}-pupil`} transform="translate(0 0)">
              <g clipPath={url('clip-iris')}>
                <circle cx={0} cy={0} r={e.irisRadius} fill={url('grad-iris')} stroke="none" />
                <circle
                  id={`${side}-pupil-core`}
                  data-ho={`${side}-pupil-core`}
                  cx={e.coreOffset.x}
                  cy={e.coreOffset.y}
                  r={e.irisRadius}
                  fill={url('grad-pupil')}
                  stroke="none"
                />
              </g>
              {/* Specular, then the bounce opposite it. Two lights read as glass. */}
              <circle
                id={`${side}-highlight`}
                cx={e.highlightOffset.x}
                cy={e.highlightOffset.y}
                r={e.highlightRadius}
                fill={C.white}
                stroke="none"
              />
              <circle
                id={`${side}-bounce`}
                cx={e.bounceOffset.x}
                cy={e.bounceOffset.y}
                r={e.bounceRadius}
                fill={C.white}
                stroke="none"
                opacity={SHADING.eyeBounce}
              />
            </g>
            {/* Lid shadow sits above the pupil but below the lids themselves. */}
            <path
              id={`${side}-eye-shade`}
              data-ho={`${side}-eye-shade`}
              d={PATHS.eyeLidShade}
              fill={C.navy}
              stroke="none"
              opacity={SHADING.eyeLid}
            />
            <g
              id={`${side}-lid`}
              data-ho={`${side}-lid`}
              transform={`translate(0 ${LID_TRAVEL.upperParked})`}
            >
              <path d={PATHS.upperLid} fill={C.cream} stroke={C.navy} strokeWidth={STROKE.detail} />
            </g>
            <g
              id={`${side}-lower-lid`}
              data-ho={`${side}-lower-lid`}
              transform={`translate(0 ${LID_TRAVEL.lowerParked})`}
            >
              <path d={PATHS.lowerLid} fill={C.cream} stroke={C.navy} strokeWidth={STROKE.detail} />
            </g>
          </g>
          <path d={sclera} fill="none" stroke={C.navy} strokeWidth={STROKE.silhouette} />
        </g>
      );
    };

    const headphone = (side: 'left' | 'right'): JSX.Element => {
      const a = side === 'left' ? ANCHORS.leftHeadphone : ANCHORS.rightHeadphone;
      return (
        <g
          key={side}
          id={`${side}-headphone`}
          data-ho={`${side}-headphone`}
          transform={`translate(${a.x} ${a.y})`}
        >
          <circle
            id={`${side}-headphone-glow`}
            data-ho={`${side}-headphone-glow`}
            r={HEADPHONE.glowRadius}
            fill="none"
            stroke={C.cyanBright}
            strokeWidth={10}
            opacity={0}
          />
          <circle r={HEADPHONE.outerRadius} fill={url('grad-gold')} />
          <circle r={HEADPHONE.cyanRadius} fill={C.cyanDim} strokeWidth={STROKE.fine} />
          <circle
            id={`${side}-headphone-lit`}
            data-ho={`${side}-headphone-lit`}
            r={HEADPHONE.cyanRadius}
            fill={url('grad-cyan')}
            strokeWidth={STROKE.fine}
            opacity={0}
          />
          <circle r={HEADPHONE.innerRadius} fill={C.navyDeep} stroke="none" />
          {/* Specular arc on the gold, upper right, matching the key light. */}
          <path
            d="M 10 -31 A 33 33 0 0 1 31 -10"
            fill="none"
            stroke={C.goldBright}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={SHADING.cupSpecular}
          />
        </g>
      );
    };

    const wing = (): JSX.Element[] => [
      ...PATHS.wingFeathers.map((d, i) => (
        <path key={`f${i}`} d={d} fill={url('grad-cream')} />
      )),
      ...PATHS.wingAccents.map((d, i) => (
        <path key={`a${i}`} d={d} fill={url('grad-gold')} strokeWidth={STROKE.fine} />
      )),
    ];

    return (
      <svg
        ref={ref}
        className={className}
        viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
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
            <path d={PATHS.scleraLeft} />
          </clipPath>
          <clipPath id={ID('clip-eye-r')}>
            <path d={PATHS.scleraRight} />
          </clipPath>
          <clipPath id={ID('clip-iris')}>
            <circle cx={0} cy={0} r={e.irisRadius} />
          </clipPath>
          <clipPath id={ID('clip-face')}>
            <path d={PATHS.faceMask} />
          </clipPath>
          <clipPath id={ID('clip-head')}>
            <path d={PATHS.headBase} />
          </clipPath>

          {/* One ramp per major shape. Offsets put the light upper-right. */}
          <radialGradient id={ID('grad-head')} cx="0.66" cy="0.26" r="1">
            <stop offset="0" stopColor={PAINT.headLit} />
            <stop offset="1" stopColor={PAINT.headShade} />
          </radialGradient>
          <radialGradient id={ID('grad-face')} cx="0.62" cy="0.22" r="1.05">
            <stop offset="0" stopColor={PAINT.faceLit} />
            <stop offset="1" stopColor={PAINT.faceShade} />
          </radialGradient>
          <linearGradient id={ID('grad-cream')} x1="1" y1="0.1" x2="0" y2="1">
            <stop offset="0" stopColor={PAINT.creamShade} />
            <stop offset="0.55" stopColor={PAINT.creamLit} />
            <stop offset="1" stopColor={PAINT.creamLit} />
          </linearGradient>
          <linearGradient id={ID('grad-iris')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={PAINT.irisTop} />
            <stop offset="1" stopColor={PAINT.irisBottom} />
          </linearGradient>
          {/* Deep navy almost everywhere; the bounce is a rim, not a fill. */}
          <radialGradient id={ID('grad-pupil')} cx="0.44" cy="0.7" r="0.78">
            <stop offset="0" stopColor={PAINT.pupilCore} />
            <stop offset="0.68" stopColor="#101B44" />
            <stop offset="1" stopColor={PAINT.pupilBounce} />
          </radialGradient>
          {/* User space, spanning the whole beak: an object-box ramp would
              restart on each half and put a value step back across the seam. */}
          <linearGradient
            id={ID('grad-beak')}
            gradientUnits="userSpaceOnUse"
            x1={244}
            y1={345}
            x2={266}
            y2={402}
          >
            <stop offset="0" stopColor={PAINT.beakLit} />
            <stop offset="1" stopColor={PAINT.beakShade} />
          </linearGradient>
          <linearGradient id={ID('grad-gold')} x1="0.75" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor={PAINT.goldLit} />
            <stop offset="1" stopColor={PAINT.goldShade} />
          </linearGradient>
          <linearGradient id={ID('grad-cyan')} x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor={PAINT.cyanShade} />
            <stop offset="1" stopColor={PAINT.cyanLit} />
          </linearGradient>
        </defs>

        <g
          id="owlet-root"
          data-ho="owlet-root"
          stroke={C.navy}
          strokeWidth={STROKE.silhouette}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        >
          {/* ---------------------------------------------------------- halo */}
          <g id="halo-group" data-ho="halo-group" transform="translate(0 0)">
            {/* Scaled vertically by the rig so the ring breathes in perspective. */}
            <g id="halo-ring" data-ho="halo-ring" transform="translate(0 0)">
              <ellipse
                id="halo-bloom"
                data-ho="halo-bloom"
                cx={halo.cx}
                cy={halo.cy}
                rx={halo.rx}
                ry={halo.ry}
                stroke={C.goldBright}
                strokeWidth={STROKE.halo + 12}
                opacity={0}
                style={{ mixBlendMode: 'screen' }}
              />
              {/* Far half, then near half. The split is what sells the ring. */}
              <path
                id="halo-back"
                data-ho="halo-back"
                d={HALO_ARCS.back}
                fill="none"
                stroke={C.goldDark}
                strokeWidth={STROKE.halo}
                strokeLinecap="butt"
              />
              <path
                id="halo"
                data-ho="halo"
                d={HALO_ARCS.front}
                fill="none"
                stroke={C.gold}
                strokeWidth={STROKE.halo}
                strokeLinecap="butt"
              />
            </g>
            <path
              id="halo-spark"
              data-ho="halo-spark"
              d={PATHS.haloSpark}
              fill={C.gold}
              stroke="none"
              transform={`translate(${halo.cx} ${halo.cy})`}
            />
          </g>

          {/* ---------------------------------------------------------- head */}
          <g id="head-root" data-ho="head-root" transform="translate(0 0)">
            <path
              id="crown-tuft"
              data-ho="crown-tuft"
              d={PATHS.crownTuft}
              fill={C.navy}
              transform="rotate(0)"
            />

            <g id="ear-wings-back">
              <g id="left-wing" data-ho="left-wing" transform="rotate(0)">
                {wing()}
              </g>
              <g id="right-wing" data-ho="right-wing" transform="rotate(0)">
                <g transform={`translate(${VIEW_BOX.width} 0) scale(-1 1)`}>{wing()}</g>
              </g>
            </g>

            <path id="head-base" data-ho="head-base" d={PATHS.headBase} fill={url('grad-head')} />

            {/* The crest drops a shadow on the skull: the same path, pushed
                down, clipped to the head. Cheapest honest contact shadow there
                is, and it stops the crest reading as a decal. */}
            <g clipPath={url('clip-head')}>
              <path
                id="tuft-shadow"
                data-ho="tuft-shadow"
                d={PATHS.crownTuft}
                fill={C.navyDeep}
                stroke="none"
                opacity={SHADING.tuftContact}
                transform="translate(2 7)"
              />
            </g>

            {/* Rim light along the lit shoulder. */}
            <path
              id="head-rim"
              data-ho="head-rim"
              d={HEAD_RIM_PATH}
              fill="none"
              stroke={PAINT.headRim}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={SHADING.headRim}
            />

            <path id="face-mask" data-ho="face-mask" d={PATHS.faceMask} fill={url('grad-face')} />

            {/* Occlusion where the navy overhangs the mask: the mask outline
                stroked inward, trimmed by its own clip. */}
            <g clipPath={url('clip-face')}>
              <path
                id="face-occlusion"
                data-ho="face-occlusion"
                d={PATHS.faceMask}
                fill="none"
                stroke={C.navy}
                strokeWidth={18}
                opacity={SHADING.faceOcclusion}
              />
            </g>

            {/* ------------------------------------------------------ effects */}
            <g id="effects" data-ho="effects">
              <path
                id="error-pulse"
                data-ho="error-pulse"
                d={PATHS.headBase}
                fill="none"
                stroke={C.concern}
                strokeWidth={7}
                opacity={0}
              />
              <g
                id="listening-glow"
                data-ho="listening-glow"
                fill="none"
                stroke={C.cyanBright}
                strokeWidth={7}
                opacity={0}
              >
                <circle cx={ANCHORS.leftHeadphone.x} cy={ANCHORS.leftHeadphone.y} r={44} />
                <circle cx={ANCHORS.rightHeadphone.x} cy={ANCHORS.rightHeadphone.y} r={44} />
              </g>
              <g
                id="speaking-pulse"
                data-ho="speaking-pulse"
                fill="none"
                stroke={C.cyan}
                strokeWidth={5}
                opacity={0}
              >
                <circle cx={ANCHORS.leftHeadphone.x} cy={ANCHORS.leftHeadphone.y} r={40} />
                <circle cx={ANCHORS.rightHeadphone.x} cy={ANCHORS.rightHeadphone.y} r={40} />
              </g>
              <path
                id="thinking-spark"
                data-ho="thinking-spark"
                d={PATHS.haloSpark}
                fill={C.goldBright}
                stroke="none"
                opacity={0}
                transform={`translate(${halo.cx} ${halo.cy}) scale(0.62)`}
              />
            </g>

            {/* The face sits on a slightly nearer plane than the skull. The rig
                shifts this group a fraction of the head tilt, which is the whole
                2.5D trick: features lead the form they are painted on. */}
            <g id="face-layer" data-ho="face-layer" transform="translate(0 0)">
              <g id="forehead-star-group" data-ho="forehead-star-group" transform="translate(0 0)">
                <path
                  id="forehead-star-bloom"
                  data-ho="forehead-star-bloom"
                  d={PATHS.foreheadStar}
                  fill={C.goldBright}
                  stroke={C.goldBright}
                  strokeWidth={11}
                  opacity={0}
                  style={{ mixBlendMode: 'screen' }}
                />
                <path
                  id="forehead-star"
                  data-ho="forehead-star"
                  d={PATHS.foreheadStar}
                  fill={C.gold}
                  stroke="none"
                />
              </g>

              <g id="eyes">{[eye('left'), eye('right')]}</g>

              <g id="brows">
                <g
                  id="left-brow"
                  data-ho="left-brow"
                  transform={`translate(${ANCHORS.leftEye.x} ${ANCHORS.leftEye.y - 60})`}
                  opacity={0}
                >
                  <path d={PATHS.brow} fill="none" stroke={C.navy} strokeWidth={STROKE.brow} />
                </g>
                <g
                  id="right-brow"
                  data-ho="right-brow"
                  transform={`translate(${ANCHORS.rightEye.x} ${ANCHORS.rightEye.y - 60})`}
                  opacity={0}
                >
                  <path d={PATHS.brow} fill="none" stroke={C.navy} strokeWidth={STROKE.brow} />
                </g>
              </g>

              <g id="beak" data-ho="beak">
                {/* Contact shadow, so the beak sits on the face rather than over it. */}
                <ellipse
                  id="beak-shadow"
                  data-ho="beak-shadow"
                  cx={255}
                  cy={394}
                  rx={19}
                  ry={7}
                  fill={C.navy}
                  stroke="none"
                  opacity={SHADING.beakContact}
                />
                <rect
                  id="beak-gap"
                  data-ho="beak-gap"
                  x={241}
                  y={374}
                  width={30}
                  height={2}
                  rx={3}
                  fill={C.navyDeep}
                  stroke="none"
                />
                <g id="upper-beak" data-ho="upper-beak">
                  <path d={PATHS.upperBeakFill} fill={url('grad-beak')} stroke="none" />
                  <path d={PATHS.upperBeakEdge} fill="none" strokeWidth={STROKE.detail} />
                </g>
                <g id="lower-beak" data-ho="lower-beak" transform="translate(0 0)">
                  <path d={PATHS.lowerBeakFill} fill={url('grad-beak')} stroke="none" />
                  <path d={PATHS.lowerBeakEdge} fill="none" strokeWidth={STROKE.detail} />
                </g>
              </g>
            </g>

            <g id="headphones">{[headphone('left'), headphone('right')]}</g>
          </g>
        </g>
      </svg>
    );
  },
);
