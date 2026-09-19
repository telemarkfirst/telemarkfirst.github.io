import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {RPM_TO_RAD_S, fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 220;
const PAD = {left: 40, right: 14, top: 14, bottom: 30};

/**
 * Torque-speed line with the operating point marked.
 *
 * This is the single most useful picture in the power transmission module:
 * it shows at a glance that the motor never runs at free speed while doing
 * work, and where peak power sits.
 */
export default function MotorCurveChart({
  freeRpm,
  stallTorqueNm,
  loadTorqueNm,
  loadedRpm,
}: {
  freeRpm: number;
  stallTorqueNm: number;
  loadTorqueNm: number;
  loadedRpm: number;
}): React.JSX.Element {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (rpm: number) =>
    PAD.left + (freeRpm > 0 ? (rpm / freeRpm) * plotW : 0);
  const y = (torque: number) =>
    PAD.top + plotH - (stallTorqueNm > 0 ? (torque / stallTorqueNm) * plotH : 0);

  // Power is torque times speed, which peaks at half of each.
  const powerPoints = Array.from({length: 41}, (_, i) => {
    const rpm = (i / 40) * freeRpm;
    const torque = stallTorqueNm * (1 - (freeRpm > 0 ? rpm / freeRpm : 0));
    return {rpm, power: torque * rpm * RPM_TO_RAD_S};
  });
  const peakPower = Math.max(...powerPoints.map((p) => p.power), 1e-9);
  const powerPath = powerPoints
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${x(p.rpm).toFixed(2)} ${(
          PAD.top +
          plotH -
          (p.power / peakPower) * plotH
        ).toFixed(2)}`,
    )
    .join(' ');

  const clampedLoad = Math.min(Math.max(loadTorqueNm, 0), stallTorqueNm);
  const overloaded = loadTorqueNm >= stallTorqueNm;

  return (
    <Figure
      caption="Torque, speed, and power"
      description={`Motor torque falls linearly from ${fmt(stallTorqueNm, 2)} newton meters at stall to zero at ${fmt(freeRpm, 0)} RPM. The load of ${fmt(loadTorqueNm, 2)} newton meters puts the operating point at ${fmt(loadedRpm, 0)} RPM. Peak power occurs at half free speed and half stall torque.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'Torque available'},
        {color: '#60a5fa', label: 'Power output'},
        {color: '#fbbf24', label: 'Your operating point'},
        {color: 'rgba(248,113,113,0.5)', label: 'Above 60% of stall'},
      ]}
      note="Power is drawn on its own scale so its shape is visible. The shaded band is the region where sustained operation heats the motor and leaves no margin for a low battery or extra friction."
    >
      {/* Danger band: above 60% of stall torque */}
      <rect
        x={PAD.left}
        y={y(stallTorqueNm)}
        width={plotW}
        height={y(stallTorqueNm * 0.6) - y(stallTorqueNm)}
        fill="rgba(248,113,113,0.12)"
      />

      {/* Gridlines at quarter intervals */}
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f}>
          <line
            className={s.grid}
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(stallTorqueNm * f)}
            y2={y(stallTorqueNm * f)}
          />
          <line
            className={s.grid}
            y1={PAD.top}
            y2={PAD.top + plotH}
            x1={x(freeRpm * f)}
            x2={x(freeRpm * f)}
          />
        </g>
      ))}

      {/* Axes */}
      <line className={s.axis} x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} />
      <line
        className={s.axis}
        x1={PAD.left}
        y1={PAD.top + plotH}
        x2={PAD.left + plotW}
        y2={PAD.top + plotH}
      />

      {/* Power curve */}
      <path d={powerPath} fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.85" />

      {/* Torque line: stall at zero speed to zero at free speed */}
      <line
        x1={x(0)}
        y1={y(stallTorqueNm)}
        x2={x(freeRpm)}
        y2={y(0)}
        stroke="#22d3ee"
        strokeWidth="2"
      />

      {/* Peak power marker at half and half */}
      <circle cx={x(freeRpm / 2)} cy={y(stallTorqueNm / 2)} r="3" fill="none" stroke="#60a5fa" strokeWidth="1.2" />
      <text className={s.tickLabel} x={x(freeRpm / 2) + 6} y={y(stallTorqueNm / 2) - 5}>
        peak power
      </text>

      {/* Operating point */}
      {!overloaded && (
        <>
          <line
            className={s.grid}
            x1={x(loadedRpm)}
            y1={y(clampedLoad)}
            x2={x(loadedRpm)}
            y2={PAD.top + plotH}
            stroke="#fbbf24"
            strokeDasharray="2 2"
            opacity="0.7"
          />
          <line
            className={s.grid}
            x1={PAD.left}
            y1={y(clampedLoad)}
            x2={x(loadedRpm)}
            y2={y(clampedLoad)}
            stroke="#fbbf24"
            strokeDasharray="2 2"
            opacity="0.7"
          />
          <circle cx={x(loadedRpm)} cy={y(clampedLoad)} r="4.5" fill="#fbbf24" />
          <text className={s.pointLabel} x={x(loadedRpm) + 7} y={y(clampedLoad) + 3}>
            {fmt(loadedRpm, 0)} RPM
          </text>
        </>
      )}
      {overloaded && (
        <>
          <circle cx={x(0)} cy={y(stallTorqueNm)} r="4.5" fill="#f87171" />
          <text className={s.pointLabel} x={x(0) + 8} y={y(stallTorqueNm) + 12} fill="#f87171">
            stalled
          </text>
        </>
      )}

      {/* Axis labels */}
      <text className={s.axisLabel} x={PAD.left} y={H - 8}>
        0
      </text>
      <text className={s.axisLabel} x={PAD.left + plotW} y={H - 8} textAnchor="end">
        {fmt(freeRpm, 0)} RPM
      </text>
      <text className={s.axisLabel} x={PAD.left + plotW / 2} y={H - 8} textAnchor="middle">
        output speed
      </text>
      <text
        className={s.axisLabel}
        transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}
        x={12}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
      >
        torque
      </text>
      <text className={s.tickLabel} x={PAD.left - 5} y={y(stallTorqueNm) + 3} textAnchor="end">
        {fmt(stallTorqueNm, 2)}
      </text>
      <text className={s.tickLabel} x={PAD.left - 5} y={PAD.top + plotH + 3} textAnchor="end">
        0
      </text>
    </Figure>
  );
}
