import React, {useEffect, useRef, useState} from 'react';
import {usePrefersReducedMotion} from '@site/src/components/mechanical/useAnimation';
import styles from './CodeStream.module.css';

/** Real FTC lifecycle code, so the animation shows the thing it advertises. */
const LINES = [
  '@TeleOp(name = "Telemark Drive")',
  'public class Drive extends OpMode {',
  '  private DcMotor left, right;',
  '',
  '  @Override public void init() {',
  '    left  = hardwareMap.get(DcMotor.class, "left");',
  '    right = hardwareMap.get(DcMotor.class, "right");',
  '    right.setDirection(Direction.REVERSE);',
  '  }',
  '',
  '  @Override public void loop() {',
  '    double drive = -gamepad1.left_stick_y;',
  '    double turn  =  gamepad1.right_stick_x;',
  '    left.setPower(drive + turn);',
  '    right.setPower(drive - turn);',
  '    telemetry.addData("drive", drive);',
  '  }',
  '}',
];

const FULL = LINES.join('\n');
const CHARS_PER_TICK = 2;
const TICK_MS = 28;
const HOLD_MS = 2600;

/**
 * Types out an OpMode a character at a time.
 *
 * Deliberately monochrome: syntax highlighting would put five hues on a page
 * whose whole palette is one accent, and the point here is the motion of code
 * being written, not a colour-coded reading exercise. The text sits at the
 * body ink colour with the keyword weight carried by the mono face alone.
 *
 * The full text is always in the DOM for screen readers and for anyone with
 * reduced motion; only the visible slice animates.
 */
export default function CodeStream({compact = false}: {compact?: boolean} = {}): React.JSX.Element {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(FULL.length);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(FULL.length);
      return undefined;
    }
    let cancelled = false;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled) return;
      count = Math.min(count + CHARS_PER_TICK, FULL.length);
      setShown(count);
      if (count < FULL.length) {
        timer = setTimeout(step, TICK_MS);
      } else {
        // Hold the finished file, then rewrite it, so the loop reads as a
        // person typing rather than a flicker.
        timer = setTimeout(() => {
          count = 0;
          setShown(0);
          timer = setTimeout(step, TICK_MS);
        }, HOLD_MS);
      }
    };

    setShown(0);
    timer = setTimeout(step, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [reduced]);

  const visible = FULL.slice(0, shown);
  const typing = !reduced && shown < FULL.length;

  return (
    <div className={`${styles.editor} ${compact ? styles.compact : ''}`}>
      <div className={styles.chrome} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.fileName}>Drive.java</span>
      </div>
      <pre className={styles.code}>
        <code>
          {visible}
          {typing && <span className={styles.caret} aria-hidden="true" />}
        </code>
      </pre>
      <span className={styles.srOnly}>{FULL}</span>
    </div>
  );
}
