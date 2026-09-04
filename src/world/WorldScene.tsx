import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { WorldRenderer } from './WorldRenderer';
import type { HermesOwletPhase } from '../character/state/HermesOwletState';

export interface WorldSceneHandle {
  setSpeechLevel(level: number): void;
  /** Where the character sits, in 0..1 scene coordinates. */
  setFocus(x: number, y: number): void;
}

export interface WorldSceneProps {
  phase: HermesOwletPhase;
  reducedMotion?: boolean;
  /** Follow the pointer for parallax. */
  parallax?: boolean;
  seed?: number;
  className?: string;
}

/**
 * The canvas the world is painted on. It sizes itself to its parent, follows
 * the pointer for parallax, and stops entirely when the tab is hidden or the
 * element scrolls out of view — a companion should not paint a sky nobody is
 * looking at.
 */
export const WorldScene = forwardRef<WorldSceneHandle, WorldSceneProps>(
  function WorldScene({ phase, reducedMotion = false, parallax = true, seed, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<WorldRenderer | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const renderer = new WorldRenderer(canvas, seed);
      rendererRef.current = renderer;
      renderer.start();

      const onResize = (): void => renderer.resize();
      const observer = new ResizeObserver(onResize);
      observer.observe(canvas);

      const onVisibility = (): void => {
        if (document.hidden) renderer.stop();
        else renderer.start();
      };
      document.addEventListener('visibilitychange', onVisibility);

      // Paint only while on screen.
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) renderer.start();
          else renderer.stop();
        },
        { threshold: 0 },
      );
      io.observe(canvas);

      return () => {
        observer.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        renderer.stop();
        rendererRef.current = null;
      };
    }, [seed]);

    useEffect(() => {
      rendererRef.current?.setPhase(phase);
    }, [phase]);

    useEffect(() => {
      rendererRef.current?.setReducedMotion(reducedMotion);
    }, [reducedMotion]);

    useEffect(() => {
      if (!parallax || reducedMotion) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const onMove = (event: PointerEvent): void => {
        const rect = canvas.getBoundingClientRect();
        rendererRef.current?.setPointer(
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height,
        );
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      return () => window.removeEventListener('pointermove', onMove);
    }, [parallax, reducedMotion]);

    useImperativeHandle(
      ref,
      (): WorldSceneHandle => ({
        setSpeechLevel: (level) => rendererRef.current?.setSpeechLevel(level),
        setFocus: (x, y) => rendererRef.current?.setFocus(x, y),
      }),
      [],
    );

    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    );
  },
);
