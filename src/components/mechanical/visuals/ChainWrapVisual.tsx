import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 190;

/**
 * The two pulleys drawn to scale at the resulting center distance, with the
 * belt path and the wrap arc on the small pulley highlighted.
 */
export default function ChainWrapVisual({
  teethA,
  teethB,
  centerIn,
  actualCenterIn,
  wrapAngleDeg,
  orderPitches,
  unit,
}: {
  teethA: number;
  teethB: number;
  centerIn: number;
  actualCenterIn: number;
  wrapAngleDeg: number;
  orderPitches: number;
  unit: string;
}): React.JSX.Element {
  // Scale so the whole layout fits regardless of the numbers entered.
  const maxTeeth = Math.max(teethA, teethB, 1);
  const rA = Math.max((teethA / maxTeeth) * 34, 8);
  const rB = Math.max((teethB / maxTeeth) * 34, 8);
  const span = Math.max(actualCenterIn, 0.1);
  const maxSpanPx = W - 150 - rA - rB;
  const centerPx = Math.min(Math.max(span * 14, rA + rB + 12), maxSpanPx);

  const ax = 70;
  const ay = 92;
  const bx = ax + centerPx;
  const by = ay;

  // Tangent geometry for the belt runs between two circles.
  const dx = bx - ax;
  const gamma = Math.asin(Math.min(Math.max((rB - rA) / Math.max(dx, 1e-6), -1), 1));
  const top = -Math.PI / 2 - gamma;
  const bottom = Math.PI / 2 + gamma;

  const p = (cx: number, cy: number, r: number, a: number) => ({
    x: cx + Math.cos(a) * r,
    y: cy + Math.sin(a) * r,
  });
  const a1 = p(ax, ay, rA, top);
  const b1 = p(bx, by, rB, top);
  const a2 = p(ax, ay, rA, bottom);
  const b2 = p(bx, by, rB, bottom);

  const lowWrap = wrapAngleDeg < 120;
  const wrapColor = lowWrap ? '#f87171' : '#4ade80';

  return (
    <Figure
      caption="Layout and wrap"
      description={`A ${teethA} tooth pulley drives a ${teethB} tooth pulley at a center distance of ${fmt(actualCenterIn, 2)} inches, using ${orderPitches} ${unit}. The belt wraps ${fmt(wrapAngleDeg, 0)} degrees of the small pulley.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#60a5fa', label: 'Driving'},
        {color: '#22d3ee', label: 'Driven'},
        {color: wrapColor, label: `Wrap ${fmt(wrapAngleDeg, 0)}°`},
      ]}
      note={
        lowWrap
          ? 'Wrap on the small pulley is below 120 degrees, so few teeth are in mesh and the belt is more likely to skip. Increase the center distance, use a larger small pulley, or add an idler on the slack side.'
          : 'Wrap on the small pulley is healthy. Remember the drive still needs a way to take up slack, because chain stretches and belts relax after their first hours of running.'
      }
    >
      {/* Belt runs */}
      <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke="#effbff" strokeWidth="2" opacity="0.75" />
      <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} stroke="#effbff" strokeWidth="2" opacity="0.75" />
      <path
        d={`M ${b1.x} ${b1.y} A ${rB} ${rB} 0 1 1 ${b2.x} ${b2.y}`}
        fill="none"
        stroke="#effbff"
        strokeWidth="2"
        opacity="0.75"
      />

      {/* Wrap arc on the small pulley, called out */}
      <path
        d={`M ${a2.x} ${a2.y} A ${rA} ${rA} 0 ${wrapAngleDeg > 180 ? 1 : 0} 1 ${a1.x} ${a1.y}`}
        fill="none"
        stroke={wrapColor}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Pulleys */}
      <circle cx={ax} cy={ay} r={rA} fill="rgba(96,165,250,0.12)" stroke="#60a5fa" strokeWidth="1.8" />
      <circle cx={bx} cy={by} r={rB} fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth="1.8" />
      <circle cx={ax} cy={ay} r="2.5" fill="#effbff" opacity="0.7" />
      <circle cx={bx} cy={by} r="2.5" fill="#effbff" opacity="0.7" />
      <text className={s.tickLabel} x={ax} y={ay + rA + 14} textAnchor="middle">
        {teethA}T
      </text>
      <text className={s.tickLabel} x={bx} y={by + rB + 14} textAnchor="middle">
        {teethB}T
      </text>

      {/* Center distance dimension */}
      <line x1={ax} y1={ay + 58} x2={bx} y2={by + 58} stroke="rgba(203,230,241,0.45)" strokeWidth="1" />
      <line x1={ax} y1={ay + 54} x2={ax} y2={ay + 62} stroke="rgba(203,230,241,0.45)" strokeWidth="1" />
      <line x1={bx} y1={by + 54} x2={bx} y2={by + 62} stroke="rgba(203,230,241,0.45)" strokeWidth="1" />
      <text className={s.tickLabel} x={(ax + bx) / 2} y={ay + 74} textAnchor="middle">
        {fmt(actualCenterIn, 2)} in centers
      </text>

      {/* Readouts */}
      <text className={s.pointLabel} x={W - 8} y={24} textAnchor="end">
        {orderPitches} {unit}
      </text>
      <text className={s.tickLabel} x={W - 8} y={38} textAnchor="end">
        order this length
      </text>
      {Math.abs(actualCenterIn - centerIn) > 0.06 && (
        <text className={s.tickLabel} x={W - 8} y={58} textAnchor="end" fill="#fbbf24">
          {fmt(Math.abs(actualCenterIn - centerIn), 3)} in from your target
        </text>
      )}
    </Figure>
  );
}
