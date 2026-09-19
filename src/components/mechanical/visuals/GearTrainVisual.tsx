import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';
import type {GearStage} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 170;

/**
 * Draws each stage to scale by tooth count, so a reduction reads as a picture
 * of small gear driving large gear rather than as an abstract number.
 */
export default function GearTrainVisual({
  stages,
  ratio,
  inputRpm,
  outputRpm,
  spinning = false,
}: {
  stages: GearStage[];
  ratio: number;
  inputRpm: number;
  outputRpm: number;
  /** Rotates each gear at its true relative speed when true. */
  spinning?: boolean;
}): React.JSX.Element {
  const visible = stages.slice(0, 3);
  const allTeeth = visible.flatMap((stage) => [stage.driving, stage.driven]);
  const maxTeeth = Math.max(...allTeeth, 1);
  // Radius proportional to tooth count, which is how real gears scale.
  const radius = (teeth: number) => Math.max((teeth / maxTeeth) * 42, 8);

  const centerY = 78;
  let cursorX = 42;
  const drawn: {
    cx: number;
    cy: number;
    r: number;
    teeth: number;
    driven: boolean;
    stage: number;
    /** Speed relative to the input gear, used for the rotation duration. */
    relativeSpeed: number;
  }[] = [];
  let carriedRatio = 1;

  visible.forEach((stage, index) => {
    const rA = radius(stage.driving);
    const rB = radius(stage.driven);
    if (index > 0) cursorX += rA + 6;
    const drivingSpeed = carriedRatio;
    drawn.push({
      cx: cursorX, cy: centerY, r: rA, teeth: stage.driving,
      driven: false, stage: index, relativeSpeed: drivingSpeed,
    });
    carriedRatio = stage.driving > 0 ? drivingSpeed * (stage.driving / stage.driven) : drivingSpeed;
    const bx = cursorX + rA + rB;
    drawn.push({
      cx: bx, cy: centerY, r: rB, teeth: stage.driven,
      driven: true, stage: index, relativeSpeed: carriedRatio,
    });
    cursorX = bx;
  });

  const width = Math.max(cursorX + 50, W);

  return (
    <Figure
      caption="Gear train to scale"
      description={`${visible.length} stages reduce ${fmt(inputRpm, 0)} RPM to ${fmt(outputRpm, 0)} RPM, an overall reduction of ${fmt(ratio, 2)} to 1. Each gear is drawn with its radius proportional to its tooth count.`}
      viewBox={`0 0 ${width} ${H}`}
      legend={[
        {color: '#60a5fa', label: 'Driving (motor side)'},
        {color: '#22d3ee', label: 'Driven (output side)'},
      ]}
      note="Gear radius is proportional to tooth count, which is why a single very large reduction needs an impractically large gear and teams build the same ratio from several modest stages instead."
    >
      {/* Shaft line */}
      <line className={s.grid} x1={20} y1={centerY} x2={width - 20} y2={centerY} strokeDasharray="2 4" />

      {drawn.map((gear, i) => (
        <g key={i}>
          {/* Each gear turns at its own speed and meshing gears counter
              rotate, so a reduction reads as the output visibly lagging. */}
          {spinning && gear.relativeSpeed > 0 && (
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from={`0 ${gear.cx} ${gear.cy}`}
              to={`${gear.driven ? -360 : 360} ${gear.cx} ${gear.cy}`}
              dur={`${Math.min(Math.max(2 / gear.relativeSpeed, 0.6), 40)}s`}
              repeatCount="indefinite"
            />
          )}
          <circle
            cx={gear.cx}
            cy={gear.cy}
            r={gear.r}
            fill={gear.driven ? 'rgba(34,211,238,0.12)' : 'rgba(96,165,250,0.12)'}
            stroke={gear.driven ? '#22d3ee' : '#60a5fa'}
            strokeWidth="1.8"
          />
          {/* Tooth ticks around the rim, capped so dense gears stay legible */}
          {Array.from({length: Math.min(gear.teeth, 30)}, (_, t) => {
            const a = (t / Math.min(gear.teeth, 30)) * Math.PI * 2;
            const inner = gear.r - 3;
            return (
              <line
                key={t}
                x1={gear.cx + Math.cos(a) * inner}
                y1={gear.cy + Math.sin(a) * inner}
                x2={gear.cx + Math.cos(a) * gear.r}
                y2={gear.cy + Math.sin(a) * gear.r}
                stroke={gear.driven ? '#22d3ee' : '#60a5fa'}
                strokeWidth="1"
                opacity="0.7"
              />
            );
          })}
          <circle cx={gear.cx} cy={gear.cy} r="2.5" fill="#effbff" opacity="0.7" />
          <text className={s.tickLabel} x={gear.cx} y={gear.cy + gear.r + 12} textAnchor="middle">
            {gear.teeth}T
          </text>
        </g>
      ))}

      <text className={s.axisLabel} x={20} y={20}>
        {fmt(inputRpm, 0)} RPM in
      </text>
      <text className={s.pointLabel} x={width - 20} y={20} textAnchor="end">
        {fmt(outputRpm, 0)} RPM out
      </text>
      <text className={s.pointLabel} x={width / 2} y={H - 8} textAnchor="middle">
        {fmt(ratio, 2)}:1 overall
      </text>
      {stages.length > 3 && (
        <text className={s.tickLabel} x={width - 20} y={H - 8} textAnchor="end">
          showing first 3 of {stages.length} stages
        </text>
      )}
    </Figure>
  );
}
