import React, {useEffect, useRef} from 'react';
import {animate} from 'animejs';
import {allowed, DUR, EASE} from '@site/src/telemark/motion';
import Figure, {visualStyles as s} from './Figure';

/**
 * The same wire, unsupported and supported, flexed side by side.
 *
 * Static drawings cannot show this: the failure is that the bend happens
 * repeatedly at one point. Animating both at once makes the difference
 * obvious, because the unsupported wire hinges right at the connector while
 * the supported one bends along its free length and the pin never moves.
 */
export default function StrainRelief(): React.JSX.Element {
  const bad = useRef<SVGPathElement>(null);
  const good = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!allowed() || !bad.current || !good.current) return undefined;
    // Same cycle for both so the eye compares them rather than following one.
    const flexed = animate(bad.current, {
      // The whole bend lives in the first few millimetres past the housing.
      d: ['M74 62 C104 62 128 62 150 62', 'M74 62 C104 62 118 96 132 118'],
      duration: 1400,
      ease: EASE,
      alternate: true,
      loop: true,
    });
    const relieved = animate(good.current, {
      d: [
        'M248 62 C268 62 276 84 268 100 C262 112 250 118 236 118',
        'M248 62 C268 62 278 86 268 104 C260 118 244 126 228 126',
      ],
      duration: 1400,
      ease: EASE,
      alternate: true,
      loop: true,
    });
    return () => {
      flexed.revert();
      relieved.revert();
    };
  }, []);

  return (
    <Figure
      caption="A wire flexing at a connector, unsupported and with a service loop"
      description="Two connectors side by side with wires leaving them. The unsupported wire hinges sharply where it leaves the housing. The relieved wire leaves in a loop that is tied down, so the flexing happens along the loop and the connector pin does not move."
      viewBox="0 0 320 170"
      legend={[
        {color: '#f87171', label: 'Flex point'},
        {color: '#22d3ee', label: 'Tie down'},
      ]}
      note="The wire does not fail where it looks stressed. It fails where the bending happens in the same place every time, which is the last millimetre of unsupported copper at the pin."
    >
      {[
        {x: 40, label: 'No strain relief'},
        {x: 214, label: 'Service loop, tied'},
      ].map(({x, label}) => (
        <g key={label}>
          <rect x={x} y={48} width={34} height={28} rx="3" fill="rgba(148,170,189,0.1)" stroke="currentColor" strokeWidth="1.4" />
          <path d={`M${x + 8} 48 v28M${x + 17} 48 v28M${x + 26} 48 v28`} stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
          <text className={s.tickLabel} x={x + 17} y={40} textAnchor="middle">connector</text>
          <text className={s.pointLabel} x={x + 17} y={158} textAnchor="middle">{label}</text>
        </g>
      ))}

      <path ref={bad} d="M74 62 C104 62 128 62 150 62" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="76" cy="62" r="5" fill="none" stroke="#f87171" strokeWidth="1.6" />

      <path
        ref={good}
        d="M248 62 C268 62 276 84 268 100 C262 112 250 118 236 118"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path d="M262 104 h16" stroke="#22d3ee" strokeWidth="2.6" />
    </Figure>
  );
}
