import React, {useMemo, useState} from 'react';
import {CalcShell, Verdict, calcStyles, fmt} from './CalcShell';

interface FunctionRow {
  fn: string;
  options: string[];
  /** Index of the chosen option, or null for undecided. */
  chosen: number | null;
}

interface Scored {
  cost: number;
  benefit: number;
}

const DEFAULT_ROWS: FunctionRow[] = [
  {fn: 'Acquire the element', options: ['Compliant rollers', 'Passive wedge', 'Claw'], chosen: 0},
  {fn: 'Move it into the robot', options: ['Belt path', 'Gravity chute', 'Carried by the claw'], chosen: 0},
  {fn: 'Raise it to height', options: ['Cascading slide', 'Pivoting arm', 'Continuous slide'], chosen: 0},
  {fn: 'Release it', options: ['Reverse the rollers', 'Tip a bucket', 'Open the claw'], chosen: 0},
];

/**
 * A morphological chart: solve each function separately, then combine.
 *
 * Teams generate whole-mechanism concepts and compare them, which produces
 * three or four ideas that are each somebody's favourite. Breaking the problem
 * into functions and listing ways to satisfy each one produces far more
 * combinations, most of which nobody would have proposed out loud, and it
 * separates "how do we lift it" from "how do we grab it" so the two can be
 * decided independently.
 *
 * The cost and benefit sliders then force the trade to be explicit, because a
 * combination that is best on capability and worst on build hours is a real
 * answer that a single score would have hidden.
 */
export default function ConceptCombiner(): React.JSX.Element {
  const [rows, setRows] = useState<FunctionRow[]>(DEFAULT_ROWS);
  const [scores, setScores] = useState<Record<string, Scored>>({});

  const totalCombinations = rows.reduce(
    (total, row) => total * Math.max(row.options.filter(Boolean).length, 1),
    1,
  );

  const current = rows
    .map((row) => (row.chosen === null ? null : row.options[row.chosen]))
    .filter(Boolean) as string[];
  const key = current.join(' + ');
  const score = scores[key] ?? {cost: 3, benefit: 3};

  const saved = useMemo(
    () =>
      Object.entries(scores)
        .map(([combo, s]) => ({combo, ...s, ratio: s.cost > 0 ? s.benefit / s.cost : 0}))
        .sort((a, b) => b.ratio - a.ratio),
    [scores],
  );

  function choose(rowIndex: number, optionIndex: number) {
    setRows((cur) =>
      cur.map((row, i) => (i === rowIndex ? {...row, chosen: optionIndex} : row)),
    );
  }

  function setOption(rowIndex: number, optionIndex: number, value: string) {
    setRows((cur) =>
      cur.map((row, i) =>
        i === rowIndex
          ? {...row, options: row.options.map((o, j) => (j === optionIndex ? value : o))}
          : row,
      ),
    );
  }

  return (
    <CalcShell
      title="Concept Combiner"
      subtitle="Solve each function separately, then combine. Score the trade before choosing."
      footnote="Cost is everything the combination consumes: build hours, money, weight, and complexity. Benefit is what it delivers against your requirements. Neither is a single number in reality, which is exactly why they are kept on separate axes here instead of collapsed into one score."
    >
      <div className={calcStyles.tableScroll}>
      <table className={calcStyles.table} style={{minWidth: '40rem'}}>
        <thead>
          <tr>
            <th>Function</th>
            <th colSpan={3}>Ways to satisfy it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.fn}>
              <td style={{width: '30%'}}>
                <input
                  className={calcStyles.input}
                  style={{fontSize: 'var(--tm-fs-2xs)', paddingInline: 'var(--tm-sp-1)'}}
                  type="text"
                  value={row.fn}
                  aria-label={`Function ${ri + 1}`}
                  onChange={(e) =>
                    setRows((cur) =>
                      cur.map((r, i) => (i === ri ? {...r, fn: e.target.value} : r)),
                    )
                  }
                />
              </td>
              {row.options.map((option, oi) => (
                <td key={oi} style={{width: '23%'}}>
                  <button
                    type="button"
                    className={`${calcStyles.preset} ${
                      row.chosen === oi ? calcStyles.presetActive : ''
                    }`}
                    style={{width: '100%', marginBottom: 4}}
                    aria-pressed={row.chosen === oi}
                    onClick={() => choose(ri, oi)}
                  >
                    {option || 'empty'}
                  </button>
                  <input
                    className={calcStyles.input}
                    style={{fontSize: 'var(--tm-fs-2xs)', paddingInline: 'var(--tm-sp-1)'}}
                    type="text"
                    value={option}
                    aria-label={`${row.fn} option ${oi + 1}`}
                    onChange={(e) => setOption(ri, oi, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className={calcStyles.rowActions}>
        <button
          type="button"
          className={calcStyles.button}
          onClick={() =>
            setRows((cur) => [
              ...cur,
              {fn: 'New function', options: ['Option A', 'Option B', 'Option C'], chosen: null},
            ])
          }
        >
          Add function
        </button>
        <button type="button" className={calcStyles.button} onClick={() => setRows(DEFAULT_ROWS)}>
          Reset
        </button>
      </div>

      <p className={calcStyles.presetLabel} style={{marginTop: '1rem'}}>
        This combination
      </p>
      <p style={{color: 'var(--tm-text-strong)', margin: '0 0 0.75rem'}}>
        {key || 'Pick one option per function.'}
      </p>

      {/* A five point ordinal scale, so discrete buttons rather than a
          slider: every value is reachable in one click and the chosen one is
          readable at a glance. */}
      <div className={calcStyles.inputs}>
        {([
          ['Cost to build', 'cost', '1 cheap, 5 expensive', 'Build hours, money, weight, complexity'],
          ['Benefit delivered', 'benefit', '1 low, 5 high', 'Against your written requirements'],
        ] as [string, 'cost' | 'benefit', string, string][]).map(([label, field, range, hint]) => (
          <div className={calcStyles.field} key={field}>
            <span className={calcStyles.fieldLabel}>
              {label}
              <span className={calcStyles.fieldValue}>{score[field]}</span>
            </span>
            <span className={calcStyles.presets} role="group" aria-label={`${label}, ${range}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${calcStyles.preset} ${score[field] === n ? calcStyles.presetActive : ''}`}
                  aria-pressed={score[field] === n}
                  aria-label={`${label} ${n} of 5`}
                  onClick={() => setScores((cur) => ({...cur, [key]: {...score, [field]: n}}))}
                >
                  {n}
                </button>
              ))}
            </span>
            <span className={calcStyles.fieldHint}>{hint}</span>
          </div>
        ))}
      </div>

      <p className={calcStyles.presetLabel} style={{marginTop: '1rem'}}>
        Combinations scored so far
      </p>
      {saved.length === 0 ? (
        <p className={calcStyles.footnote}>
          Score this one, then change a function and score the next.
        </p>
      ) : (
        <table className={calcStyles.table}>
          <thead>
            <tr>
              <th>Combination</th>
              <th>Cost</th>
              <th>Benefit</th>
              <th>Benefit per cost</th>
            </tr>
          </thead>
          <tbody>
            {saved.map((s) => (
              <tr key={s.combo} className={s.combo === key ? calcStyles.tableRowActive : undefined}>
                <td>{s.combo}</td>
                <td>{s.cost}</td>
                <td>{s.benefit}</td>
                <td>{fmt(s.ratio, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Verdict level={totalCombinations > 20 ? 'good' : 'warn'}>
        These {rows.length} functions generate <strong>{totalCombinations}</strong> possible
        combinations.{' '}
        {saved.length > 1
          ? 'Rank them by benefit per cost, then prototype the top two. Check that each option fits the team\'s build-hour budget.'
          : 'Score at least two combinations before deciding anything.'}
      </Verdict>
    </CalcShell>
  );
}
