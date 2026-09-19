import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 150;

/**
 * Shows the volts leaving the battery and the volts arriving at the motor,
 * with the difference lost as heat in the wire.
 */
export default function VoltageDropVisual({
  systemVolts,
  dropV,
  awg,
  lengthFt,
  currentA,
  maxDropPercent,
}: {
  systemVolts: number;
  dropV: number;
  awg: number | null;
  lengthFt: number;
  currentA: number;
  maxDropPercent: number;
}): React.JSX.Element {
  const barX = 30;
  const barW = 360;
  const arrivedFraction = systemVolts > 0 ? Math.max(1 - dropV / systemVolts, 0) : 0;
  const arrivedW = barW * arrivedFraction;
  const dropPercent = systemVolts > 0 ? (dropV / systemVolts) * 100 : 0;
  const overBudget = dropPercent > maxDropPercent;

  return (
    <Figure
      caption="Where the volts go"
      description={`${awg ? `${awg} AWG` : 'No workable gauge'} over a ${fmt(lengthFt, 1)} foot run at ${fmt(currentA, 1)} amps loses ${fmt(dropV, 3)} volts, so ${fmt(systemVolts - dropV, 2)} of ${fmt(systemVolts, 1)} volts reach the motor.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'Reaches the motor'},
        {color: overBudget ? '#f87171' : '#fbbf24', label: 'Lost as heat in the wire'},
      ]}
      note="Current flows out and back, so the drop is calculated over twice the run length. Both free speed and stall torque scale with voltage, so what is lost here is power the mechanism never receives."
    >
      <text className={s.axisLabel} x={barX} y={30}>
        battery {fmt(systemVolts, 1)} V
      </text>

      <rect x={barX} y={42} width={barW} height="26" rx="4" fill="rgba(255,255,255,0.05)" />
      <rect x={barX} y={42} width={arrivedW} height="26" rx="4" fill="#22d3ee" opacity="0.85" />
      <rect
        x={barX + arrivedW}
        y={42}
        width={Math.max(barW - arrivedW, 1.5)}
        height="26"
        rx="2"
        fill={overBudget ? '#f87171' : '#fbbf24'}
      />

      {/* Battery and motor ends */}
      <rect x={barX - 16} y={46} width="10" height="18" rx="2" fill="rgba(203,230,241,0.4)" />
      <rect x={barX + barW + 6} y={44} width="14" height="22" rx="3" fill="rgba(203,230,241,0.25)" stroke="#22d3ee" strokeWidth="1.2" />

      <text className={s.pointLabel} x={barX + 6} y={60}>
        {fmt(systemVolts - dropV, 2)} V arrives
      </text>

      {/* Drop callout */}
      <line
        x1={barX + arrivedW}
        y1={74}
        x2={barX + arrivedW}
        y2={92}
        stroke={overBudget ? '#f87171' : '#fbbf24'}
        strokeWidth="1.2"
      />
      <text
        className={s.tickLabel}
        x={barX + barW}
        y={104}
        textAnchor="end"
        fill={overBudget ? '#f87171' : '#fbbf24'}
      >
        {fmt(dropV, 3)} V lost ({fmt(dropPercent, 2)}%)
      </text>

      <text className={s.tickLabel} x={barX} y={104}>
        {awg ? `${awg} AWG` : 'no workable gauge'}, {fmt(lengthFt, 1)} ft, {fmt(currentA, 1)} A
      </text>
      <text
        className={s.tickLabel}
        x={barX}
        y={128}
        fill={overBudget ? '#f87171' : '#4ade80'}
      >
        {overBudget
          ? `over the ${fmt(maxDropPercent, 1)}% budget`
          : `within the ${fmt(maxDropPercent, 1)}% budget`}
      </text>
    </Figure>
  );
}
