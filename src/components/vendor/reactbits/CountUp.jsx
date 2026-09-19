import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart = undefined,
  onEnd = undefined
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = num => {
    const str = num.toString();

    if (str.includes('.')) {
      const decimals = str.split('.')[1];

      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }

    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    latest => {
      const hasDecimals = maxDecimals > 0;

      const options = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from);
    }
  }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') onStart();

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          // Write the exact figure when the animation is over. A spring
          // finishes by getting close rather than by arriving, so the last
          // frame it emits can be short of the target and format down: the
          // site has 173 lessons and this was settling on 172. Snapping on a
          // threshold was not enough, because the spring stops wherever its
          // velocity dies.
          if (ref.current) {
            ref.current.textContent = formatValue(direction === 'down' ? from : to);
          }
          if (typeof onEnd === 'function') onEnd();
        },
        delay * 1000 + duration * 1000 + 120
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration, formatValue]);

  useEffect(() => {
    const target = direction === 'down' ? from : to;

    const unsubscribe = springValue.on('change', latest => {
      if (!ref.current) return;
      // Snap to the target on the last stretch. A spring settles by
      // approaching its value, so the final frame can sit just under it and
      // format down: the site has 173 lessons and the counter was finishing on
      // 172. A number that lands wrong is worse than one that never moved.
      const settled = Math.abs(target - latest) < 0.5;
      ref.current.textContent = formatValue(settled ? target : latest);
    });

    return () => unsubscribe();
  }, [springValue, formatValue, direction, from, to]);

  return <span className={className} ref={ref} />;
}
