import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 170;

/**
 * Draws the tap drill, the screw, and the clearance hole at the same scale.
 * The whole point of the lesson is that these three diameters are close
 * together and not interchangeable, which a table states and a drawing shows.
 */
export default function HoleScaleVisual({
  label,
  majorMm,
  tapDrillMm,
  closeFitMm,
  freeFitMm,
}: {
  label: string;
  majorMm: number;
  tapDrillMm: number;
  closeFitMm: number;
  freeFitMm: number;
}): React.JSX.Element {
  // A generous pixels-per-mm so sub-millimetre differences are visible.
  const scale = 13;
  const cy = 78;
  const items = [
    {x: 70, d: tapDrillMm, color: '#22d3ee', title: 'tap drill', sub: 'threads cut here'},
    {x: 180, d: majorMm, color: '#effbff', title: 'screw', sub: 'nominal diameter'},
    {x: 290, d: closeFitMm, color: '#60a5fa', title: 'close fit', sub: 'tight location'},
    {x: 380, d: freeFitMm, color: '#818cf8', title: 'free fit', sub: 'easy assembly'},
  ];

  return (
    <Figure
      caption={`${label} to scale`}
      description={`For ${label} the tap drill is ${fmt(tapDrillMm, 2)} millimetres, the screw is ${fmt(majorMm, 2)}, the close clearance hole is ${fmt(closeFitMm, 1)} and the free clearance hole is ${fmt(freeFitMm, 1)}. All four are drawn at the same scale.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'Tapped hole (smaller than the screw)'},
        {color: '#60a5fa', label: 'Clearance hole (larger)'},
      ]}
      note={`The tap drill and the clearance hole differ by only ${fmt(closeFitMm - tapDrillMm, 2)} mm, which is why they are so easily swapped. Mark every hole on the drawing as TAP or CL before anyone picks up a drill.`}
    >
      {items.map((item) => {
        const r = (item.d * scale) / 2;
        return (
          <g key={item.title}>
            <circle
              cx={item.x}
              cy={cy}
              r={r}
              fill={item.title === 'screw' ? 'rgba(239,251,255,0.22)' : 'none'}
              stroke={item.color}
              strokeWidth="2"
            />
            {/* Diameter dimension across the circle */}
            <line
              x1={item.x - r}
              y1={cy}
              x2={item.x + r}
              y2={cy}
              stroke={item.color}
              strokeWidth="0.9"
              opacity="0.6"
            />
            <text className={s.pointLabel} x={item.x} y={cy - r - 10} textAnchor="middle" fill={item.color}>
              {fmt(item.d, 2)}
            </text>
            <text className={s.tickLabel} x={item.x} y={cy + r + 18} textAnchor="middle">
              {item.title}
            </text>
            <text className={s.tickLabel} x={item.x} y={cy + r + 31} textAnchor="middle" opacity="0.7">
              {item.sub}
            </text>
          </g>
        );
      })}
      <text className={s.axisLabel} x={10} y={18}>
        all four drawn at the same scale, millimetres
      </text>
    </Figure>
  );
}
