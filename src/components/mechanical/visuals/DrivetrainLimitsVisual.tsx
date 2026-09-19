import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 190;

/**
 * Shows which of the two limits binds, which is the whole design question in
 * Lesson 7.3. Being traction limited is the safe side; being motor limited
 * means the motors stall in a pushing match.
 */
export default function DrivetrainLimitsVisual({
  motorForceLbf,
  tractionLbf,
  pushingLbf,
  motorLimited,
  freeSpeedFps,
}: {
  motorForceLbf: number;
  tractionLbf: number;
  pushingLbf: number;
  motorLimited: boolean;
  freeSpeedFps: number;
}): React.JSX.Element {
  const barX = 118;
  const barW = 250;
  const max = Math.max(motorForceLbf, tractionLbf, 1e-9);
  const w = (value: number) => Math.max((value / max) * barW, 0);

  return (
    <Figure
      caption="Which limit binds"
      description={`The motors can deliver ${fmt(motorForceLbf, 1)} pounds of force and the tires can transmit ${fmt(tractionLbf, 1)} before slipping, so the robot pushes with ${fmt(pushingLbf, 1)} pounds and is ${motorLimited ? 'motor limited, which stalls the motors' : 'traction limited, which is the safe side'}.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#60a5fa', label: 'Motor limit'},
        {color: '#22d3ee', label: 'Traction limit'},
        {color: motorLimited ? '#f87171' : '#4ade80', label: 'Binding limit'},
      ]}
      note={
        motorLimited
          ? 'The shorter bar wins. Here the motors give out first, so the wheels grip and the motors stall at full current. Add reduction until the traction bar is the shorter one.'
          : 'The shorter bar wins. Here the tires slip before the motors stall, which protects the motors and gives the driver a predictable limit.'
      }
    >
      {/* Motor limit */}
      <text className={s.axisLabel} x={10} y={44}>
        motor limit
      </text>
      <rect x={barX} y={34} width={barW} height="16" fill="rgba(255,255,255,0.05)" rx="3" />
      <rect
        x={barX}
        y={34}
        width={w(motorForceLbf)}
        height="16"
        fill="#60a5fa"
        opacity={motorLimited ? 1 : 0.45}
        rx="3"
      />
      <text className={s.pointLabel} x={barX + w(motorForceLbf) + 6} y={46}>
        {fmt(motorForceLbf, 1)} lbf
      </text>

      {/* Traction limit */}
      <text className={s.axisLabel} x={10} y={82}>
        traction limit
      </text>
      <rect x={barX} y={72} width={barW} height="16" fill="rgba(255,255,255,0.05)" rx="3" />
      <rect
        x={barX}
        y={72}
        width={w(tractionLbf)}
        height="16"
        fill="#22d3ee"
        opacity={motorLimited ? 0.45 : 1}
        rx="3"
      />
      <text className={s.pointLabel} x={barX + w(tractionLbf) + 6} y={84}>
        {fmt(tractionLbf, 1)} lbf
      </text>

      {/* The binding limit, called out */}
      <text className={s.axisLabel} x={10} y={126}>
        you get
      </text>
      <rect x={barX} y={116} width={barW} height="20" fill="rgba(255,255,255,0.05)" rx="3" />
      <rect
        x={barX}
        y={116}
        width={w(pushingLbf)}
        height="20"
        fill={motorLimited ? 'rgba(248,113,113,0.75)' : 'rgba(74,222,128,0.7)'}
        rx="3"
      />
      <text className={s.pointLabel} x={barX + w(pushingLbf) + 6} y={130}>
        {fmt(pushingLbf, 1)} lbf
      </text>

      {/* Cut line at the binding value */}
      <line
        x1={barX + w(pushingLbf)}
        y1={26}
        x2={barX + w(pushingLbf)}
        y2={142}
        stroke={motorLimited ? '#f87171' : '#4ade80'}
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />

      <text
        className={s.pointLabel}
        x={barX}
        y={166}
        fill={motorLimited ? '#f87171' : '#4ade80'}
      >
        {motorLimited ? 'MOTOR LIMITED: motors stall first' : 'TRACTION LIMITED: wheels slip first'}
      </text>
      <text className={s.tickLabel} x={10} y={166}>
        {fmt(freeSpeedFps, 2)} ft/s free
      </text>
    </Figure>
  );
}
