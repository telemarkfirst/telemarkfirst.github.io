import React from 'react';
import Figure, {visualStyles as s} from './Figure';
import {fmt, type ScoredOption} from '@site/src/telemark/mechanicalMath';

const W = 420;
const H = 160;

/**
 * Ranks the scored options as bars, with the gap to the runner up called out.
 * A narrow gap is the signal to prototype both rather than decide on paper.
 */
export default function MatrixScoreVisual({
  scored,
}: {
  scored: ScoredOption[];
}): React.JSX.Element {
  const ranked = [...scored].sort((a, b) => b.raw - a.raw).slice(0, 5);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const margin = best && runnerUp ? best.raw - runnerUp.raw : 0;
  const close = Boolean(runnerUp) && margin <= 2;

  const barX = 128;
  const barW = 230;
  const max = Math.max(...ranked.map((o) => o.raw), 1e-9);

  return (
    <Figure
      caption="Weighted scores"
      description={
        best
          ? `${best.name} leads with ${best.raw} points${runnerUp ? `, ${margin} ahead of ${runnerUp.name}` : ''}.`
          : 'No options to score yet.'
      }
      viewBox={`0 0 ${W} ${H}`}
      legend={[
        {color: close ? '#fbbf24' : '#4ade80', label: 'Leader'},
        {color: '#22d3ee', label: 'Other options'},
      ]}
      note={
        close
          ? 'The top two are within a few points, which is inside the noise of how people assign 1 to 5 scores. That is a real finding: prototype both rather than deciding here.'
          : 'A clear leader. Record the matrix in the notebook with one sentence per rejected option explaining what lost it.'
      }
    >
      {ranked.map((option, i) => {
        const y = 26 + i * 26;
        const w = (option.raw / max) * barW;
        const isBest = i === 0;
        return (
          <g key={option.name + i}>
            <text className={s.tickLabel} x={barX - 8} y={y + 11} textAnchor="end">
              {(option.name || 'unnamed').slice(0, 18)}
            </text>
            <rect x={barX} y={y} width={barW} height="15" rx="3" fill="rgba(255,255,255,0.04)" />
            <rect
              x={barX}
              y={y}
              width={Math.max(w, 2)}
              height="15"
              rx="3"
              fill={isBest ? (close ? '#fbbf24' : '#4ade80') : '#22d3ee'}
              opacity={isBest ? 0.9 : 0.55}
            />
            <text className={s.tickLabel} x={barX + Math.max(w, 2) + 6} y={y + 11}>
              {option.raw} ({fmt(option.percent, 0)}%)
            </text>
          </g>
        );
      })}

      {runnerUp && (
        <text
          className={s.tickLabel}
          x={barX}
          y={H - 12}
          fill={close ? '#fbbf24' : '#4ade80'}
        >
          {close
            ? `only ${margin} points apart: too close to call on paper`
            : `${margin} point margin over ${(runnerUp.name || 'the runner up').slice(0, 20)}`}
        </text>
      )}
    </Figure>
  );
}
