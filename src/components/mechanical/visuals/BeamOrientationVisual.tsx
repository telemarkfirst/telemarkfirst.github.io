import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 200;

/**
 * Draws the same beam in both orientations with their deflections scaled
 * against each other, so the cube law on section depth is visible rather than
 * merely stated.
 */
export default function BeamOrientationVisual({
  widthIn,
  heightIn,
  spanIn,
  deflectionIn,
  flippedDeflectionIn,
  cantilever,
}: {
  widthIn: number;
  heightIn: number;
  spanIn: number;
  deflectionIn: number;
  flippedDeflectionIn: number;
  cantilever: boolean;
}): React.JSX.Element {
  const beamX = 34;
  const beamW = 268;

  // Exaggerate the drawn droop so both cases are legible, holding their ratio.
  const worst = Math.max(deflectionIn, flippedDeflectionIn, 1e-9);
  const droop = (value: number) => (value / worst) * 34;

  const rows = [
    {label: 'as oriented', y: 60, defl: deflectionIn, color: '#22d3ee', thickness: heightIn},
    {label: 'rotated 90°', y: 140, defl: flippedDeflectionIn, color: '#fbbf24', thickness: widthIn},
  ];

  const ratio =
    deflectionIn > 0 && Number.isFinite(flippedDeflectionIn)
      ? flippedDeflectionIn / deflectionIn
      : 0;

  // Section thickness drawn to a shared scale.
  const maxDim = Math.max(widthIn, heightIn, 1e-9);
  const drawThickness = (t: number) => Math.max((t / maxDim) * 14, 3);

  return (
    <Figure
      caption="Section depth versus deflection"
      description={`Loaded as oriented the beam deflects ${fmt(deflectionIn, 4)} inches. Rotated ninety degrees the same beam deflects ${fmt(flippedDeflectionIn, 4)} inches, ${fmt(ratio, 1)} times more, because the depth in the load direction is cubed.`}
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: '#22d3ee', label: 'As oriented'},
        {color: '#fbbf24', label: 'Rotated 90 degrees'},
      ]}
      note={`Droop is drawn to an exaggerated but proportional scale. Same beam, same load, same span: only the depth in the load direction changed, and deflection changed by ${fmt(ratio, 1)} times.`}
    >
      {rows.map((row) => {
        const t = drawThickness(row.thickness);
        const d = droop(row.defl);
        const endY = row.y + d;
        // Cantilever droops from a fixed root; simple support sags at midspan.
        const path = cantilever
          ? `M ${beamX} ${row.y} Q ${beamX + beamW * 0.6} ${row.y + d * 0.45} ${beamX + beamW} ${endY}`
          : `M ${beamX} ${row.y} Q ${beamX + beamW / 2} ${row.y + d * 2} ${beamX + beamW} ${row.y}`;

        return (
          <g key={row.label}>
            {/* Label above the beam so the support block cannot cover it. */}
            <text className={s.axisLabel} x={beamX} y={row.y - 30}>
              {row.label}
            </text>

            {/* Undeflected reference */}
            <line
              className={s.grid}
              x1={beamX}
              y1={row.y}
              x2={beamX + beamW}
              y2={row.y}
              strokeDasharray="3 3"
            />

            {/* The beam, drawn with its section depth as stroke width */}
            <path d={path} fill="none" stroke={row.color} strokeWidth={t} strokeLinecap="round" />

            {/* Supports */}
            {cantilever ? (
              <rect x={beamX - 10} y={row.y - 14} width="8" height="28" fill="rgba(203,230,241,0.3)" />
            ) : (
              <>
                <path d={`M ${beamX} ${row.y + 6} l -6 10 l 12 0 z`} fill="rgba(203,230,241,0.35)" />
                <path
                  d={`M ${beamX + beamW} ${row.y + 6} l -6 10 l 12 0 z`}
                  fill="rgba(203,230,241,0.35)"
                />
              </>
            )}

            {/* Load arrow */}
            <line
              x1={cantilever ? beamX + beamW : beamX + beamW / 2}
              y1={row.y - 24}
              x2={cantilever ? beamX + beamW : beamX + beamW / 2}
              y2={row.y - 8}
              stroke="rgba(203,230,241,0.6)"
              strokeWidth="1.4"
            />
            <path
              d={`M ${(cantilever ? beamX + beamW : beamX + beamW / 2) - 3} ${row.y - 12} l 3 6 l 3 -6 z`}
              fill="rgba(203,230,241,0.6)"
            />

            {/* Deflection readout */}
            <text className={s.pointLabel} x={beamX + beamW + 8} y={endY + 4} fill={row.color}>
              {fmt(row.defl, 3)}″
            </text>
          </g>
        );
      })}

      <text className={s.tickLabel} x={beamX} y={H - 8}>
        span {fmt(spanIn, 1)} in
      </text>
      <text className={s.pointLabel} x={beamX + beamW} y={H - 8} textAnchor="end">
        {fmt(ratio, 1)}x penalty for rotating
      </text>
    </Figure>
  );
}
