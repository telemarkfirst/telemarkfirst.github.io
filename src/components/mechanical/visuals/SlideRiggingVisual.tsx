import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 232;

/**
 * Draws the stages at a chosen point in the travel so the speed and force
 * trade is visible: a cascading rigging reaches further for the same string
 * take-up, and each stage carries a proportionally smaller share of the force.
 */
export default function SlideRiggingVisual({
  cascading,
  stages,
  multiplier,
  extendSpeedIps,
  liftForceLbf,
  loadWeightLb,
  travelIn,
  progress = 0.6,
}: {
  cascading: boolean;
  stages: number;
  multiplier: number;
  extendSpeedIps: number;
  liftForceLbf: number;
  loadWeightLb: number;
  travelIn: number;
  /** Fraction of full travel to draw, 0 retracted to 1 fully extended. */
  progress?: number;
}): React.JSX.Element {
  const stageCount = Math.max(1, Math.min(stages, 6));
  const baseX = 30;
  const baseY = 158;
  const stageGap = 13;
  /** Room on the right for the load marker and its label. */
  const rightPad = 36;

  // Stage length is derived rather than fixed. A cascading rigging pushes the
  // tip out by stageCount lengths plus the last stage's own body, so a constant
  // length ran the bars clean off the canvas as soon as the stage count or the
  // extension grew. Solving for the length that just fits at full extension
  // means the drawing always fills the width and never leaves it.
  const spans = cascading ? stageCount + 1 : 2;
  const stageLen = (W - baseX - rightPad) / spans;

  // Clamped so an animated value cannot push a stage off the drawing.
  const extension = Math.min(Math.max(progress, 0), 1);

  return (
    <Figure
      caption={cascading ? 'Cascading rigging' : 'Continuous rigging'}
      description={`${cascading ? `A cascading rigging with ${stageCount} moving stages extends ${multiplier} times faster than the string is taken up and divides the lifting force by ${multiplier}.` : 'A continuous rigging moves every stage at the same rate, with no speed or force multiplication.'} Extension speed is ${fmt(extendSpeedIps, 1)} inches per second and lifting force is ${fmt(liftForceLbf, 1)} pounds against a ${fmt(loadWeightLb, 1)} pound load.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'Stages'},
        {color: '#fbbf24', label: 'Load'},
        {color: '#60a5fa', label: 'String'},
      ]}
      note={
        cascading
          ? `Each stage adds its own travel, so the tip moves ${multiplier} times the string speed. The same factor divides the force, which is the trade teams forget when they size the motor for speed alone.`
          : 'Every stage moves at the string rate, so there is no multiplication in either direction. Slower to full extension, and it keeps the full lifting force.'
      }
    >
      {/* Fixed base stage */}
      <rect x={baseX} y={baseY} width={stageLen} height="9" rx="2" fill="rgba(203,230,241,0.22)" />
      <text className={s.tickLabel} x={baseX + stageLen + 6} y={baseY + 8}>
        fixed base
      </text>

      {/* Moving stages, staggered by their share of the travel */}
      {Array.from({length: stageCount}, (_, i) => {
        const offset = cascading
          ? (i + 1) * stageLen * extension
          : stageLen * extension;
        const y = baseY - (i + 1) * stageGap;
        return (
          <g key={i}>
            <rect
              x={baseX + offset}
              y={y}
              width={stageLen}
              height="9"
              rx="2"
              fill="#22d3ee"
              opacity={0.35 + (0.5 * (i + 1)) / stageCount}
            />
            <text className={s.tickLabel} x={baseX + offset + 3} y={y - 3}>
              stage {i + 1}
            </text>
          </g>
        );
      })}

      {/* Load at the tip of the last stage */}
      {(() => {
        const lastOffset = cascading
          ? stageCount * stageLen * extension
          : stageLen * extension;
        const tipX = baseX + lastOffset + stageLen;
        const tipY = baseY - stageCount * stageGap + 4;
        const short = liftForceLbf < loadWeightLb;
        return (
          <g>
            <circle
              cx={Math.min(tipX, W - 24)}
              cy={tipY}
              r="10"
              fill="rgba(251,191,36,0.25)"
              stroke={short ? '#f87171' : '#fbbf24'}
              strokeWidth="1.6"
            />
            <text className={s.tickLabel} x={Math.min(tipX, W - 24) - 10} y={tipY + 26}>
              {fmt(loadWeightLb, 1)} lb
            </text>
          </g>
        );
      })()}

      {/* Spool and string */}
      <circle cx={baseX + 14} cy={baseY + 30} r="10" fill="none" stroke="#60a5fa" strokeWidth="2" />
      <circle cx={baseX + 14} cy={baseY + 30} r="3" fill="#60a5fa" />
      <text className={s.tickLabel} x={baseX + 2} y={baseY + 54}>
        spool
      </text>
      <line
        x1={baseX + 24}
        y1={baseY + 30}
        x2={baseX + 100}
        y2={baseY + 30}
        stroke="#60a5fa"
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />
      <text className={s.tickLabel} x={baseX + 104} y={baseY + 34}>
        string take-up x{multiplier} at the tip
      </text>

      {/* Readouts run across the top rather than stacking in the right margin,
          which is the same margin the stages extend into. Stacked there they
          crowded the load marker at full extension and left the left third of
          the drawing empty. */}
      <text className={s.pointLabel} x={baseX} y={20}>
        {fmt(extendSpeedIps, 1)} in/s
      </text>
      <text className={s.tickLabel} x={baseX} y={34}>
        extension speed
      </text>
      <text
        className={s.pointLabel}
        x={baseX + 150}
        y={20}
        fill={liftForceLbf < loadWeightLb ? '#f87171' : '#22d3ee'}
      >
        {fmt(liftForceLbf, 1)} lbf
      </text>
      <text className={s.tickLabel} x={baseX + 150} y={34}>
        lifting force
      </text>
      <text className={s.pointLabel} x={baseX + 280} y={20}>
        {fmt(travelIn, 0)} in
      </text>
      <text className={s.tickLabel} x={baseX + 280} y={34}>
        total travel
      </text>
    </Figure>
  );
}
