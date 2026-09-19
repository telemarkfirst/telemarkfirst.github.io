import {useEffect, type RefObject} from 'react';
import {revealOnScroll} from '@site/src/telemark/motion';

/**
 * Reveals a container's children as the container scrolls into view.
 *
 * Grids of fourteen cards arriving at once read as a page that finished
 * loading. Arriving in document order reads as a list you can follow, and it
 * gives the eye somewhere to start.
 */
export function useMotionReveal(
  container: RefObject<HTMLElement | null>,
  selector: string,
): void {
  useEffect(() => {
    if (!container.current) return undefined;
    return revealOnScroll(selector, {container: container.current});
  }, [container, selector]);
}
