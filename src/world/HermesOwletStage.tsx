import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { HermesOwlet, type HermesOwletHandle, type HermesOwletProps } from '../character/HermesOwlet';
import type { HermesOwletPhase } from '../character/state/HermesOwletState';
import { WorldScene, type WorldSceneHandle } from './WorldScene';

export interface HermesOwletStageProps extends HermesOwletProps {
  /** Fraction of the stage's smaller edge the head occupies. */
  scale?: number;
  /** Where the head sits, in 0..1 stage coordinates. */
  focus?: { x: number; y: number };
  parallax?: boolean;
  worldSeed?: number;
  stageClassName?: string;
}

/**
 * The companion window: the owl, and the sky it lives in.
 *
 * The world reads the same phase the character does, so the room and its
 * occupant are never out of step — the sky leans in when the agent listens and
 * draws its constellation while the agent reasons.
 */
export const HermesOwletStage = forwardRef<HermesOwletHandle, HermesOwletStageProps>(
  function HermesOwletStage(props, ref) {
    const {
      scale = 0.62,
      focus = { x: 0.5, y: 0.52 },
      parallax = true,
      worldSeed,
      stageClassName,
      ...owletProps
    } = props;

    const owlRef = useRef<HermesOwletHandle | null>(null);
    const worldRef = useRef<WorldSceneHandle | null>(null);
    const [phase, setPhase] = useState<HermesOwletPhase>(props.phase ?? 'idle');
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
      () =>
        owletProps.reducedMotion === 'auto' &&
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
      if (owletProps.reducedMotion !== 'auto' || typeof window.matchMedia !== 'function') {
        setPrefersReducedMotion(false);
        return;
      }
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (event: MediaQueryListEvent): void => setPrefersReducedMotion(event.matches);
      setPrefersReducedMotion(query.matches);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }, [owletProps.reducedMotion]);

    useEffect(() => {
      worldRef.current?.setFocus(focus.x, focus.y);
    }, [focus.x, focus.y]);

    useImperativeHandle(ref, () => {
      const owl = owlRef.current;
      return {
        setSpeechLevel: (level: number) => {
          owl?.setSpeechLevel(level);
          worldRef.current?.setSpeechLevel(level);
        },
        setGaze: (x: number, y: number) => owl?.setGaze(x, y),
        releaseGaze: () => owl?.releaseGaze(),
        blink: () => owl?.blink(),
        doubleBlink: () => owl?.doubleBlink(),
        play: (a) => owl?.play(a),
        setOverride: (k, v) => owl?.setOverride(k, v),
        getState: () => owl?.getState() ?? null,
      };
    }, []);

    const reduced =
      owletProps.reducedMotion === true ||
      (owletProps.reducedMotion === 'auto' && prefersReducedMotion);

    return (
      <div
        className={stageClassName}
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      >
        <WorldScene
          ref={worldRef}
          phase={phase}
          reducedMotion={reduced}
          parallax={parallax}
          seed={worldSeed}
        />
        <div
          style={{
            position: 'absolute',
            left: `${focus.x * 100}%`,
            top: `${focus.y * 100}%`,
            width: `${scale * 100}%`,
            aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <HermesOwlet
            {...owletProps}
            ref={owlRef}
            onPhaseChange={(next) => {
              setPhase(next);
              owletProps.onPhaseChange?.(next);
            }}
          />
        </div>
      </div>
    );
  },
);
