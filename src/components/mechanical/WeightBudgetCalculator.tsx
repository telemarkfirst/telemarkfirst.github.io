import React, {useState} from 'react';
import {
  CalcShell,
  NumberField,
  Result,
  Results,
  TextField,
  Verdict,
  calcStyles,
} from './CalcShell';
import {fmt, weightBudget, type BudgetRow} from '@site/src/telemark/mechanicalMath';
import BudgetBarVisual from './visuals/BudgetBarVisual';

const DEFAULT_ROWS: BudgetRow[] = [
  {name: 'Drivetrain and frame', weight: 9.5},
  {name: 'Intake', weight: 2.4},
  {name: 'Linear slides', weight: 4.1},
  {name: 'Scoring arm and end effector', weight: 3.2},
  {name: 'Electronics and battery', weight: 3.6},
  {name: 'Fasteners, wiring, and miscellaneous', weight: 1.8},
];

/**
 * Subsystem weight budget tracker.
 *
 * Weight is a shared resource. Without a budget, every subsystem lead adds
 * "just a little" until the robot is too heavy to accelerate and too heavy to
 * hold its own arm up.
 */
export default function WeightBudgetCalculator(): React.JSX.Element {
  const [target, setTarget] = useState(28);
  const [rows, setRows] = useState<BudgetRow[]>(DEFAULT_ROWS);

  const {total, remaining, percentUsed, heaviest} = weightBudget(rows, target);

  function update(index: number, patch: Partial<BudgetRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? {...row, ...patch} : row)),
    );
  }

  return (
    <CalcShell
      title="Robot Weight Budget"
      subtitle="Decide where the pounds go before the subsystems decide for you."
      footnote="Set the target from your strategy, not from a rule: FTC does not impose a weight limit, but every pound costs acceleration, raises the load on your arm, and makes the robot harder to push and easier to tip. Weigh subsystems on a kitchen scale as they are finished and replace the estimates with real numbers."
    >
      <div className={calcStyles.inputs}>
        <NumberField
          label="Target total weight (lb)"
          value={target}
          onChange={setTarget}
          hint="Your team's chosen budget"
          min={1}
          step={0.5}
        />
      </div>

      <div className={calcStyles.rows}>
        {rows.map((row, index) => (
          <div
            key={`row-${index}`}
            className={calcStyles.row}
            style={{gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto'}}
          >
            <TextField
              label={`Subsystem ${index + 1}`}
              value={row.name}
              onChange={(next) => update(index, {name: next})}
            />
            <NumberField
              label="Weight (lb)"
              value={row.weight}
              onChange={(next) => update(index, {weight: next})}
              min={0}
              step={0.1}
            />
            <button
              type="button"
              className={calcStyles.removeButton}
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              aria-label={`Remove ${row.name || `subsystem ${index + 1}`}`}
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
          onClick={() => setRows((current) => [...current, {name: 'New subsystem', weight: 0}])}
        >
          Add subsystem
        </button>
        <button
          type="button"
          className={calcStyles.button}
          onClick={() => setRows(DEFAULT_ROWS)}
        >
          Reset
        </button>
      </div>

      <BudgetBarVisual rows={rows} total={total} target={target} />

      <Results>
        <Result value={fmt(total, 1)} label="Total weight (lb)" />
        <Result
          value={fmt(remaining, 1)}
          label="Remaining (lb)"
          note={remaining >= 0 ? 'Left in the budget' : 'Over budget'}
        />
        <Result value={`${fmt(percentUsed, 0)}%`} label="Budget used" />
        <Result
          value={heaviest?.name || (heaviest ? 'Unnamed' : '--')}
          label="Heaviest subsystem"
          note="Start optimizing here"
        />
      </Results>

      {remaining < 0 ? (
        <Verdict level="bad">
          Over budget by {fmt(Math.abs(remaining), 1)} lb. Cut from the heaviest
          subsystem first: a 10% reduction there saves more than eliminating a
          small part entirely.
        </Verdict>
      ) : percentUsed > 90 ? (
        <Verdict level="warn">
          Under budget, but with little slack. Wiring, fasteners, and the
          repairs you have not made yet always add weight late in the season.
          Hold back roughly 10% for them.
        </Verdict>
      ) : (
        <Verdict level="good">
          Comfortable margin. Record these numbers in the notebook: a weight
          budget you can show a judge is direct evidence of engineering
          discipline.
        </Verdict>
      )}
    </CalcShell>
  );
}
