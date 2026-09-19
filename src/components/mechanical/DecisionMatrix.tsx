import React, {useState} from 'react';
import {CalcShell, NumberField, TextField, Verdict, calcStyles} from './CalcShell';
import {
  fmt,
  scoreMatrix,
  type Criterion,
  type MatrixOption,
} from '@site/src/telemark/mechanicalMath';
import MatrixScoreVisual from './visuals/MatrixScoreVisual';

type Option = MatrixOption;

const DEFAULT_CRITERIA: Criterion[] = [
  {name: 'Cycle time', weight: 5},
  {name: 'Build difficulty', weight: 3},
  {name: 'Reliability', weight: 5},
  {name: 'Weight', weight: 2},
];

const DEFAULT_OPTIONS: Option[] = [
  {name: 'Active roller intake', scores: [5, 3, 4, 3]},
  {name: 'Passive wedge intake', scores: [3, 5, 5, 5]},
  {name: 'Claw on a wrist', scores: [2, 2, 3, 4]},
];

/**
 * Weighted decision matrix.
 *
 * Judges consistently reward teams that can show why a design was chosen. A
 * matrix does not make the decision for you, but it forces the criteria to be
 * named and weighted before anyone starts defending a favourite.
 */
export default function DecisionMatrix(): React.JSX.Element {
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [options, setOptions] = useState<Option[]>(DEFAULT_OPTIONS);

  const scored = scoreMatrix(criteria, options);

  const best = [...scored].sort((a, b) => b.raw - a.raw)[0];
  const runnerUp = [...scored].sort((a, b) => b.raw - a.raw)[1];
  const margin = best && runnerUp ? best.raw - runnerUp.raw : 0;

  function setScore(optionIndex: number, criterionIndex: number, value: number) {
    setOptions((current) =>
      current.map((option, index) => {
        if (index !== optionIndex) return option;
        const scores = [...option.scores];
        scores[criterionIndex] = value;
        return {...option, scores};
      }),
    );
  }

  return (
    <CalcShell
      title="Weighted Decision Matrix"
      subtitle="Score each option 1 to 5 against criteria your team weighted first."
      footnote="Weight the criteria before you score the options. Doing it the other way around lets the team quietly tune the weights until the favourite wins, which produces a matrix that documents a bias instead of a decision."
    >
      <div className={calcStyles.rows}>
        {criteria.map((criterion, index) => (
          <div
            key={`criterion-${index}`}
            className={calcStyles.row}
            style={{gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto'}}
          >
            <TextField
              label={`Criterion ${index + 1}`}
              value={criterion.name}
              onChange={(next) =>
                setCriteria((current) =>
                  current.map((item, i) => (i === index ? {...item, name: next} : item)),
                )
              }
            />
            <NumberField
              label="Weight (1-5)"
              value={criterion.weight}
              onChange={(next) =>
                setCriteria((current) =>
                  current.map((item, i) => (i === index ? {...item, weight: next} : item)),
                )
              }
              min={1}
              max={5}
              step={1}
            />
            <button
              type="button"
              className={calcStyles.removeButton}
              onClick={() => {
                setCriteria((current) => current.filter((_, i) => i !== index));
                setOptions((current) =>
                  current.map((option) => ({
                    ...option,
                    scores: option.scores.filter((_, i) => i !== index),
                  })),
                );
              }}
              aria-label={`Remove criterion ${criterion.name}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className={calcStyles.rowActions}>
        <button
          type="button"
          className={calcStyles.button}
          onClick={() => {
            setCriteria((current) => [...current, {name: 'New criterion', weight: 3}]);
            setOptions((current) =>
              current.map((option) => ({...option, scores: [...option.scores, 3]})),
            );
          }}
        >
          Add criterion
        </button>
        <button
          type="button"
          className={calcStyles.button}
          onClick={() =>
            setOptions((current) => [
              ...current,
              {name: 'New option', scores: criteria.map(() => 3)},
            ])
          }
        >
          Add option
        </button>
      </div>

      <MatrixScoreVisual scored={scored} />

      <table className={calcStyles.table}>
        <thead>
          <tr>
            <th>Option</th>
            {criteria.map((criterion, index) => (
              <th key={`head-${index}`}>
                {criterion.name} (x{criterion.weight})
              </th>
            ))}
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {scored.map((option, optionIndex) => (
            <tr
              key={`option-${optionIndex}`}
              className={best && option.name === best.name ? calcStyles.tableRowActive : undefined}
            >
              <td>
                <input
                  className={calcStyles.input}
                  type="text"
                  value={option.name}
                  aria-label={`Option ${optionIndex + 1} name`}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((item, i) =>
                        i === optionIndex ? {...item, name: event.target.value} : item,
                      ),
                    )
                  }
                />
              </td>
              {criteria.map((criterion, criterionIndex) => (
                <td key={`score-${optionIndex}-${criterionIndex}`}>
                  <input
                    className={calcStyles.input}
                    type="number"
                    min={1}
                    max={5}
                    step={1}
                    value={option.scores[criterionIndex] ?? 0}
                    aria-label={`${option.name} score for ${criterion.name}`}
                    onChange={(event) =>
                      setScore(
                        optionIndex,
                        criterionIndex,
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </td>
              ))}
              <td>
                {option.raw} ({fmt(option.percent, 0)}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!best ? (
        <Verdict level="warn">Add at least one option to score.</Verdict>
      ) : margin <= 2 ? (
        <Verdict level="warn">
          {best.name} leads by only {margin} points. That is inside the noise of
          how people assign scores. Prototype the top two instead of picking on
          paper.
        </Verdict>
      ) : (
        <Verdict level="good">
          {best.name} wins by {margin} points. Write the matrix into the
          notebook along with one sentence on why each losing option was set
          aside. That sentence is what judges ask about.
        </Verdict>
      )}
    </CalcShell>
  );
}
