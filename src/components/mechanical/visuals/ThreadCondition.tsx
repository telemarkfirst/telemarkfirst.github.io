import React from 'react';
import Figure, {visualStyles as s} from './Figure';

/** One thread profile: a triangular crest on the bore wall. */
function crest(x: number, y: number, worn: number): string {
  const depth = 7 * (1 - worn);
  return `M${x} ${y} l4 ${-depth} l4 ${depth}`;
}

/**
 * A good tapped hole beside a stripped one, in section.
 *
 * Drawn in section because that is the only view where the difference is
 * visible: from above, a stripped hole looks like a hole. The good side has
 * full triangular crests; the stripped side has crests worn down to almost
 * nothing, which is what "the threads let go" actually looks like.
 */
export default function ThreadCondition(): React.JSX.Element {
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <Figure
      caption="A sound tapped hole and a stripped one, in section"
      description="Two cross sections of tapped holes side by side. The left has full triangular thread crests along both walls. The right has crests worn nearly flat, so a screw has nothing to grip."
      viewBox="0 0 320 170"
      note="Both holes measure the same from above. The only way to tell them apart without a section is that the screw in the stripped one turns without ever getting tight."
    >
      {[
        {x: 40, worn: 0, label: 'Sound'},
        {x: 200, worn: 0.82, label: 'Stripped'},
      ].map(({x, worn, label}) => (
        <g key={label}>
          {/* plate section */}
          <path
            d={`M${x} 30 h80 v104 h-80 z`}
            fill="rgba(148,170,189,0.08)"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          {/* bore walls with thread crests facing into the hole */}
          {rows.map((r) => (
            <g key={r} stroke="currentColor" strokeWidth="1.3" fill="none">
              <path d={crest(x + 24, 44 + r * 16, worn)} />
              <path d={crest(x + 48, 44 + r * 16, worn)} transform={`scale(-1,1) translate(${-2 * (x + 56)},0)`} />
            </g>
          ))}
          <path d={`M${x + 28} 30 v104M${x + 52} 30 v104`} stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
          <text className={s.pointLabel} x={x + 40} y={152} textAnchor="middle">
            {label}
          </text>
        </g>
      ))}
      <text className={s.tickLabel} x={160} y={22} textAnchor="middle">
        section through the plate
      </text>
    </Figure>
  );
}
