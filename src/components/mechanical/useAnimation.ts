import {useEffect, useRef, useState} from 'react';

/**
 * Animation primitives for the engineering visuals.
 *
 * Every animation here is explanatory rather than decorative: an arm sweeping
 * through its range shows the cosine relationship in a way a static drawing
 * cannot. That also means none of it is essential, so all of it yields to
 * prefers-reduced-motion.
 */

/**
 * True when the visitor has asked for reduced motion.
 *
 * Returns false during server rendering and on the first client paint, then
 * corrects itself, so the markup is stable during hydration.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return reduced;
}

interface SweepOptions {
  from: number;
  to: number;
  durationMs: number;
  /** Reverse at each end instead of jumping back to the start. */
  pingPong?: boolean;
}

interface SweepResult {
  value: number;
  playing: boolean;
  toggle: () => void;
  stop: () => void;
  /** True when the browser asked for reduced motion, so playback is disabled. */
  disabled: boolean;
}

/**
 * Drives a value between two bounds with requestAnimationFrame.
 *
 * Playback never starts on its own. The student presses play, which keeps the
 * page still until they ask for motion and avoids animating content that is
 * scrolled out of view.
 */
export function useSweep({from, to, durationMs, pingPong = true}: SweepOptions): SweepResult {
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [value, setValue] = useState(from);
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!playing || reduced) return undefined;

    function step(now: number) {
      if (!startedAt.current) startedAt.current = now;
      const elapsed = now - startedAt.current;
      const cycle = pingPong ? durationMs * 2 : durationMs;
      const position = (elapsed % cycle) / durationMs;
      const progress = pingPong && position > 1 ? 2 - position : position;
      setValue(from + (to - from) * progress);
      frame.current = requestAnimationFrame(step);
    }

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      startedAt.current = 0;
    };
  }, [playing, reduced, from, to, durationMs, pingPong]);

  // Stop playback if the visitor turns reduced motion on mid-animation.
  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  return {
    value,
    playing,
    disabled: reduced,
    toggle: () => setPlaying((current) => !current),
    stop: () => {
      setPlaying(false);
      setValue(from);
    },
  };
}
