import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 178;

/**
 * Side view of the arm at its current angle, with the gravity torque curve.
 *
 * The cosine relationship is hard to feel from a number. Watching the arm
 * swing toward horizontal while the demand bar fills makes it obvious why the
 * worst case is at zero degrees.
 */
export default function ArmAngleVisual({
  angleDeg,
  armCgIn,
  payloadIn,
  requiredNm,
  worstCaseNm,
  availableNm,
}: {
  angleDeg: number;
  armCgIn: number;
  payloadIn: number;
  requiredNm: number;
  worstCaseNm: number;
  availableNm: number;
}): React.JSX.Element {
  const pivotX = 60;
  const pivotY = 118;
  const maxReach = 150;
  const scale = payloadIn > 0 ? maxReach / payloadIn : 1;

  const rad = (angleDeg * Math.PI) / 180;
  const tipX = pivotX + Math.cos(rad) * payloadIn * scale;
  // Screen y grows downward, so a positive angle lifts the arm.
  const tipY = pivotY - Math.sin(rad) * payloadIn * scale;
  const cgX = pivotX + Math.cos(rad) * armCgIn * scale;
  const cgY = pivotY - Math.sin(rad) * armCgIn * scale;

  // Demand bar, scaled against whichever is larger so both always fit.
  const barTop = 26;
  const barX = 250;
  const barW = 130;
  const barMax = Math.max(worstCaseNm, availableNm, 1e-9);
  const demandW = (requiredNm / barMax) * barW;
  const availableW = (availableNm / barMax) * barW;
  const worstW = (worstCaseNm / barMax) * barW;
  const short = requiredNm > availableNm;

  return (
    <Figure
      caption="Arm position and torque demand"
      description={`The arm sits at ${angleDeg} degrees from horizontal, demanding ${fmt(requiredNm, 2)} newton meters of the ${fmt(availableNm, 2)} available. The worst case at horizontal is ${fmt(worstCaseNm, 2)} newton meters.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'Arm'},
        {color: '#fbbf24', label: 'Demand at this angle'},
        {color: '#60a5fa', label: 'Available torque'},
      ]}
      note="Gravity torque follows the cosine of the angle from horizontal, so the demand bar is longest when the arm is flat and disappears when it points straight up."
    >
      {/* Ground and horizontal reference */}
      <line className={s.grid} x1={pivotX} y1={pivotY} x2={218} y2={pivotY} strokeDasharray="3 3" />
      <text className={s.tickLabel} x={pivotX} y={pivotY + 30}>
        horizontal reference
      </text>

      {/* Sweep arc showing the range already travelled */}
      <path
        d={`M ${pivotX + 34} ${pivotY} A 34 34 0 0 ${angleDeg >= 0 ? 0 : 1} ${
          pivotX + Math.cos(rad) * 34
        } ${pivotY - Math.sin(rad) * 34}`}
        fill="none"
        stroke="rgba(34,211,238,0.4)"
        strokeWidth="1"
      />
      <text className={s.tickLabel} x={pivotX + 40} y={pivotY - 16}>
        {angleDeg}°
      </text>

      {/* The arm itself */}
      <line x1={pivotX} y1={pivotY} x2={tipX} y2={tipY} stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />

      {/* Centre of gravity marker */}
      <circle cx={cgX} cy={cgY} r="3.5" fill="none" stroke="#effbff" strokeWidth="1.2" />
      <line x1={cgX} y1={cgY} x2={cgX} y2={cgY + 16} stroke="#effbff" strokeWidth="1" opacity="0.6" />
      <text className={s.tickLabel} x={cgX + 5} y={cgY + 22}>
        arm cg
      </text>

      {/* Payload */}
      <circle cx={tipX} cy={tipY} r="8" fill="rgba(251,191,36,0.25)" stroke="#fbbf24" strokeWidth="1.5" />
      <line x1={tipX} y1={tipY + 9} x2={tipX} y2={tipY + 26} stroke="#fbbf24" strokeWidth="1.4" />
      <path d={`M ${tipX - 3} ${tipY + 22} L ${tipX} ${tipY + 28} L ${tipX + 3} ${tipY + 22}`} fill="#fbbf24" />

      {/* Pivot */}
      <circle cx={pivotX} cy={pivotY} r="5" fill="#0d151e" stroke="#effbff" strokeWidth="2" />
      <rect x={pivotX - 12} y={pivotY + 5} width="24" height="8" fill="rgba(203,230,241,0.25)" />

      {/* Torque bars */}
      <text className={s.axisLabel} x={barX} y={barTop - 8}>
        torque
      </text>
      <rect x={barX} y={barTop} width={barW} height="9" fill="rgba(255,255,255,0.06)" rx="2" />
      <rect x={barX} y={barTop} width={Math.max(availableW, 0)} height="9" fill="#60a5fa" rx="2" />
      <text className={s.tickLabel} x={barX} y={barTop + 22}>
        available {fmt(availableNm, 2)}
      </text>

      <rect x={barX} y={barTop + 34} width={barW} height="9" fill="rgba(255,255,255,0.06)" rx="2" />
      <rect
        x={barX}
        y={barTop + 34}
        width={Math.max(demandW, 0)}
        height="9"
        fill={short ? '#f87171' : '#fbbf24'}
        rx="2"
      />
      <text className={s.tickLabel} x={barX} y={barTop + 56}>
        demand now {fmt(requiredNm, 2)}
      </text>

      {/* Worst case marker on the demand track */}
      <line
        x1={barX + worstW}
        y1={barTop + 30}
        x2={barX + worstW}
        y2={barTop + 47}
        stroke="#f87171"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      <text className={s.tickLabel} x={barX} y={barTop + 74} fill="#f87171">
        worst case {fmt(worstCaseNm, 2)} at 0°
      </text>
    </Figure>
  );
}
