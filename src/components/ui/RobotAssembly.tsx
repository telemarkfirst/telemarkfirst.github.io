import React, {useEffect, useRef} from 'react';
import {allowed, sequence} from '@site/src/telemark/motion';
import styles from './RobotAssembly.module.css';

/**
 * A robot drawing itself into place, part by part.
 *
 * Line art rather than a rendered video: the page is one accent on near black,
 * and a photographic robot would be the only full-colour object on the site.
 * White strokes on the page background keep it in the same register as the
 * rest of the page, and it costs a few kilobytes instead of a download.
 *
 * The order is the order a robot is actually built, which is also the order the
 * mechanical track teaches: chassis, drivetrain, then the mechanisms that sit
 * on top of it.
 *
 * Driven by a timeline rather than staggered CSS keyframes, because the parts
 * do different things: the plate fades up, the wheels drop onto it, the
 * uprights rise, and the dimension marks arrive last. Keyframes can only give
 * every part the same move at a different time.
 */
export default function RobotAssembly(): React.JSX.Element {
  const root = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = root.current;
    if (!svg) return undefined;
    const part = (n: number) => svg.querySelector(`[data-part="${n}"]`);
    const parts = [1, 2, 3, 4, 5, 6].map(part).filter(Boolean) as Element[];
    if (!allowed()) {
      parts.forEach((el) => el.setAttribute('opacity', '1'));
      return undefined;
    }

    // Loops. The sequence ends by fading the parts out, which without a loop
    // meant the robot assembled once and then left an empty space forever.
    const timeline = sequence(true);
    timeline
      .add(part(1) as Element, {opacity: [0, 1], scaleY: [0.7, 1]}, 0)
      // Wheels drop onto the plate rather than fading with it.
      .add(part(2) as Element, {opacity: [0, 1], translateY: [-10, 0]}, 400)
      .add(part(3) as Element, {opacity: [0, 1], scaleY: [0, 1]}, 800)
      .add(part(4) as Element, {opacity: [0, 1], translateY: [16, 0]}, 1200)
      .add(part(5) as Element, {opacity: [0, 1], scaleX: [0.6, 1]}, 1600)
      // Dimensions are what a drawing gets once the geometry stops moving.
      .add(part(6) as Element, {opacity: [0, 0.5]}, 2100)
      .add(parts, {opacity: 0, duration: 500, delay: 0}, 6400);
    timeline.init();

    return () => {
      timeline.revert();
    };
  }, []);

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        ref={root}
        viewBox="0 0 320 240"
        role="img"
        aria-label="A line drawing of an FTC robot assembling itself: chassis, wheels, linear slide, and intake."
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Build plate */}
          <g className={styles.part} data-part="1" strokeWidth="1.6">
            <rect x="70" y="150" width="180" height="46" rx="4" />
            <path d="M70 173h180" strokeWidth="0.8" opacity="0.45" />
          </g>

          {/* Drivetrain */}
          <g className={styles.part} data-part="2" strokeWidth="1.6">
            <circle cx="102" cy="196" r="18" />
            <circle cx="102" cy="196" r="6" strokeWidth="1" />
            <circle cx="218" cy="196" r="18" />
            <circle cx="218" cy="196" r="6" strokeWidth="1" />
            <path d="M102 214h116" strokeWidth="0.8" opacity="0.4" />
          </g>

          {/* Uprights and cross brace */}
          <g className={styles.part} data-part="3" strokeWidth="1.6">
            <path d="M96 150V78M224 150V78" />
            <path d="M96 104h128" strokeWidth="1" opacity="0.6" />
          </g>

          {/* Linear slide, drawn extended */}
          <g className={styles.part} data-part="4" strokeWidth="1.6">
            <rect x="140" y="44" width="40" height="106" rx="3" />
            <path d="M150 60v78M170 60v78" strokeWidth="0.8" opacity="0.5" />
          </g>

          {/* Intake */}
          <g className={styles.part} data-part="5" strokeWidth="1.6">
            <path d="M180 62h44a10 10 0 0 1 10 10v16" />
            <circle cx="234" cy="98" r="11" />
            <path d="M234 91v14" strokeWidth="0.8" opacity="0.6" />
          </g>

          {/* Measurement marks, the last thing added to any real drawing */}
          <g className={styles.part} data-part="6" strokeWidth="0.8" opacity="0.5">
            <path d="M70 214v10M250 214v10M70 219h180" />
            <path d="M262 44v152M258 44h8M258 196h8" />
          </g>
        </g>
      </svg>
      <figcaption className={styles.caption}>
        Chassis, drivetrain, structure, slide, intake. The order the track
        teaches, and the order a robot survives being built in.
      </figcaption>
    </figure>
  );
}
