import {animate, createTimeline, onScroll, stagger} from 'animejs';

/**
 * The site's motion vocabulary, in one place.
 *
 * Every animation here has a job: showing that a value changed, that a section
 * arrived, or that a mechanism is moving through its range. Decorative motion
 * is not in this file because it is not in the product.
 *
 * Everything routes through `allowed()`. A visitor who has asked their system
 * for reduced motion gets the finished state immediately rather than a shorter
 * animation, because the point of the setting is to remove the movement, not
 * to hurry it.
 */

export const DUR = {fast: 180, base: 320, slow: 640} as const;
/** Ease-out quint. Fast departure, long settle, no overshoot. */
export const EASE = 'cubicBezier(0.22, 1, 0.36, 1)';

export function allowed(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveals elements as they enter the viewport, staggered in document order.
 *
 * Returns a cleanup function. Elements are left visible if motion is off, so
 * nothing depends on the observer having fired.
 */
export function revealOnScroll(
  targets: string | Element | Element[],
  options: {delay?: number; distance?: number; container?: Element} = {},
): () => void {
  const list = resolve(targets, options.container);
  if (list.length === 0) return () => undefined;
  if (!allowed()) {
    list.forEach((el) => {
      (el as HTMLElement).style.opacity = '1';
      (el as HTMLElement).style.transform = 'none';
    });
    return () => undefined;
  }

  const animation = animate(list, {
    opacity: [0, 1],
    translateY: [options.distance ?? 14, 0],
    duration: DUR.slow,
    ease: EASE,
    delay: stagger(70, {start: options.delay ?? 0}),
    autoplay: onScroll({enter: 'bottom-=60 top', repeat: false}),
  });
  return () => animation.revert();
}

/**
 * Counts a number up to its new value.
 *
 * Used when a calculator result changes: the movement is what tells you which
 * number responded to the input you just edited, which a hard swap does not.
 */
export function countTo(
  el: Element | null,
  value: number,
  format: (n: number) => string,
  /**
   * Where to count from. Callers inside React must pass this: the framework has
   * already written the new value into the node by the time an effect runs, so
   * reading the DOM would animate from the answer to the answer.
   */
  from?: number,
): () => void {
  if (!el) return () => undefined;
  if (!allowed()) {
    el.textContent = format(value);
    return () => undefined;
  }
  const start = from ?? Number.parseFloat((el.textContent ?? '').replace(/[^\d.-]/g, ''));
  const state = {n: Number.isFinite(start) ? start : 0};
  const animation = animate(state, {
    n: value,
    duration: DUR.base,
    ease: EASE,
    onUpdate: () => {
      el.textContent = format(state.n);
    },
  });
  return () => animation.revert();
}

/** Draws attention to an element that just changed meaning, once. */
export function pulse(el: Element | null): void {
  if (!el || !allowed()) return;
  animate(el, {
    opacity: [0.35, 1],
    duration: DUR.base,
    ease: EASE,
  });
}

/**
 * A timeline for sequenced, explanatory motion such as an assembly order.
 *
 * @param loop Repeat forever. A sequence that ends by clearing itself needs
 *   this, or it plays once and leaves an empty frame behind for good.
 */
export function sequence(loop = false): ReturnType<typeof createTimeline> {
  return createTimeline({defaults: {duration: DUR.slow, ease: EASE}, loop});
}

function resolve(
  targets: string | Element | Element[],
  container?: Element,
): Element[] {
  if (typeof targets === 'string') {
    return Array.from((container ?? document).querySelectorAll(targets));
  }
  return Array.isArray(targets) ? targets : [targets];
}
