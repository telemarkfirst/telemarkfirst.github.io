import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt, type BudgetRow} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 150;
const PALETTE = ['#22d3ee', '#60a5fa', '#818cf8', '#38bdf8', '#4ade80', '#fbbf24', '#f472b6'];

/**
 * Stacked bar of the subsystems against the target, so the heaviest one is
 * obvious and going over budget is visible rather than merely reported.
 */
export default function BudgetBarVisual({
  rows,
  total,
  target,
}: {
  rows: BudgetRow[];
  total: number;
  target: number;
}): React.JSX.Element {
  const barX = 20;
  const barW = 380;
  // Scale to whichever is larger so an over-budget bar still fits.
  const scaleMax = Math.max(total, target, 1e-9);
  const px = (value: number) => (value / scaleMax) * barW;
  const over = total > target;

  let cursor = barX;
  const segments = rows
    .filter((row) => Number.isFinite(row.weight) && row.weight > 0)
    .map((row, i) => {
      const w = px(row.weight);
      const seg = {x: cursor, w, row, color: PALETTE[i % PALETTE.length]};
      cursor += w;
      return seg;
    });

  return (
    <Figure
      caption="Where the weight is"
      description={`${rows.length} subsystems total ${fmt(total, 1)} pounds against a target of ${fmt(target, 1)}. ${over ? `That is ${fmt(total - target, 1)} pounds over budget.` : `That leaves ${fmt(target - total, 1)} pounds remaining.`}`}
      viewBox={`0 0 ${W} ${H}`}
      legend={segments.slice(0, 6).map((seg) => ({
        color: seg.color,
        label: `${seg.row.name || 'unnamed'} ${fmt(seg.row.weight, 1)}`,
      }))}
      note="Cut from the widest band first. A 10% reduction on the heaviest subsystem saves more than removing a small part entirely, and weight high on the robot costs more than weight low down."
    >
      <rect x={barX} y={48} width={barW} height="30" rx="4" fill="rgba(255,255,255,0.04)" />
      {segments.map((seg, i) => (
        <g key={i}>
          <rect x={seg.x} y={48} width={Math.max(seg.w - 1, 0)} height="30" fill={seg.color} opacity="0.85" />
          {seg.w > 34 && (
            <text className={s.tickLabel} x={seg.x + seg.w / 2} y={67} textAnchor="middle" fill="#05080d">
              {fmt(seg.row.weight, 1)}
            </text>
          )}
        </g>
      ))}

      {/* Target line */}
      <line
        x1={barX + px(target)}
        y1={38}
        x2={barX + px(target)}
        y2={90}
        stroke={over ? '#f87171' : '#4ade80'}
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <text
        className={s.tickLabel}
        x={barX + px(target)}
        y={32}
        textAnchor="middle"
        fill={over ? '#f87171' : '#4ade80'}
      >
        target {fmt(target, 1)} lb
      </text>

      <text className={s.pointLabel} x={barX} y={110}>
        {fmt(total, 1)} lb total
      </text>
      <text
        className={s.tickLabel}
        x={barX + barW}
        y={110}
        textAnchor="end"
        fill={over ? '#f87171' : '#4ade80'}
      >
        {over ? `${fmt(total - target, 1)} lb over` : `${fmt(target - total, 1)} lb remaining`}
      </text>
    </Figure>
  );
}
