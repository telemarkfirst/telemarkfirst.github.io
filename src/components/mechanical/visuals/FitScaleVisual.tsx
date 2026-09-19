import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 175;

/**
 * Shaft inside hole with the clearance exaggerated enough to see. Real fit
 * clearances are a few hundredths of a millimetre, so a to-scale drawing
 * would show nothing at all.
 */
export default function FitScaleVisual({
  shaftMm,
  minHole,
  maxHole,
  nominalHole,
  fitLabel,
}: {
  shaftMm: number;
  minHole: number;
  maxHole: number;
  nominalHole: number;
  fitLabel: string;
}): React.JSX.Element {
  const cx = 130;
  const cy = 84;
  const scale = Math.min(90 / Math.max(shaftMm, 1), 12);
  const shaftR = (shaftMm * scale) / 2;

  // Exaggerate the gap so a 0.1 mm clearance is visible on screen.
  const EXAGGERATION = 26;
  const gapMin = ((minHole - shaftMm) / 2) * scale * EXAGGERATION;
  const gapMax = ((maxHole - shaftMm) / 2) * scale * EXAGGERATION;
  const interference = maxHole < shaftMm;

  return (
    <Figure
      caption={`${fitLabel} on a ${fmt(shaftMm, 1)} mm shaft`}
      description={`A ${fmt(shaftMm, 1)} millimetre shaft in a hole between ${fmt(minHole, 2)} and ${fmt(maxHole, 2)} millimetres. ${interference ? 'The hole is smaller than the shaft, so the parts interfere and must be pressed together.' : 'The hole is larger than the shaft, leaving clearance for it to turn or locate.'}`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#effbff', label: 'Shaft'},
        {color: interference ? '#f87171' : '#22d3ee', label: interference ? 'Interference' : 'Clearance'},
      ]}
      note={`Clearance is drawn about ${EXAGGERATION} times larger than life. A real ${fitLabel.toLowerCase()} gap of ${fmt(maxHole - shaftMm, 2)} mm is invisible at true scale, which is exactly why it has to be specified as a number rather than judged by eye.`}
    >
      {/* Hole limits */}
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(shaftR + gapMax, 4)}
        fill="none"
        stroke={interference ? '#f87171' : '#22d3ee'}
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(shaftR + gapMin, 3)}
        fill="none"
        stroke={interference ? 'rgba(248,113,113,0.55)' : 'rgba(34,211,238,0.55)'}
        strokeWidth="1.2"
      />

      {/* Shaft */}
      <circle cx={cx} cy={cy} r={shaftR} fill="rgba(239,251,255,0.22)" stroke="#effbff" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="2" fill="#effbff" opacity="0.6" />

      {/* Dimension line */}
      <line x1={cx} y1={cy} x2={cx + shaftR} y2={cy} stroke="#effbff" strokeWidth="0.9" opacity="0.7" />
      <text className={s.tickLabel} x={cx} y={cy + shaftR + 20} textAnchor="middle">
        shaft {fmt(shaftMm, 1)} mm
      </text>

      {/* Readouts */}
      <text className={s.axisLabel} x={250} y={40}>
        hole limits
      </text>
      <text className={s.pointLabel} x={250} y={62}>
        {fmt(nominalHole, 2)} mm nominal
      </text>
      <text className={s.tickLabel} x={250} y={82}>
        min {fmt(minHole, 2)} mm
      </text>
      <text className={s.tickLabel} x={250} y={98}>
        max {fmt(maxHole, 2)} mm
      </text>
      <text
        className={s.tickLabel}
        x={250}
        y={122}
        fill={interference ? '#f87171' : '#22d3ee'}
      >
        {interference
          ? `${fmt(Math.abs(maxHole - shaftMm), 2)} mm interference`
          : `${fmt(minHole - shaftMm, 2)} to ${fmt(maxHole - shaftMm, 2)} mm clearance`}
      </text>
      <text className={s.tickLabel} x={250} y={142} opacity="0.7">
        band {fmt(maxHole - minHole, 2)} mm
      </text>
    </Figure>
  );
}
