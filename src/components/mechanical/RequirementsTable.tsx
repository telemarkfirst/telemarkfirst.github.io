import React, {useState} from 'react';
import {CalcShell, Verdict, calcStyles} from './CalcShell';

type Verification = 'Test' | 'Measure' | 'Inspect' | 'Demonstrate' | '';

interface Requirement {
  id: string;
  statement: string;
  value: string;
  verification: Verification;
  owner: string;
  source: string;
}

const DEFAULT: Requirement[] = [
  {id: 'R1', statement: 'Acquire an element from the floor', value: '<= 2.0 s', verification: 'Test', owner: 'Intake', source: 'Strategy'},
  {id: 'R2', statement: 'Traverse acquisition to scoring', value: '<= 3.0 s', verification: 'Test', owner: 'Drivetrain', source: 'Strategy'},
  {id: 'R3', statement: 'Deliver to the high goal', value: '<= 2.0 s', verification: 'Test', owner: 'Slide', source: 'Strategy'},
  {id: 'R4', statement: 'End effector reach above the tile', value: '>= 34 in', verification: 'Measure', owner: 'Slide', source: 'Field measurement'},
  {id: 'C1', statement: 'Fit the starting envelope', value: 'per manual', verification: 'Inspect', owner: 'Chassis', source: 'Rule reference'},
];

const VERIFICATIONS: Verification[] = ['Test', 'Measure', 'Inspect', 'Demonstrate'];

/**
 * A requirements table with verification and ownership.
 *
 * A requirement nobody can check is a wish, and a requirement nobody owns is
 * everybody's assumption. Forcing an id, a number, a way to verify it, and a
 * subsystem that answers for it turns a list of hopes into something the team
 * can argue about concretely and point at later.
 *
 * The id matters more than it looks: once a requirement has one, a notebook
 * entry, a design review, and a test result can all cite the same thing.
 */
export default function RequirementsTable(): React.JSX.Element {
  const [rows, setRows] = useState<Requirement[]>(DEFAULT);

  const unverifiable = rows.filter((r) => !r.verification).length;
  const unowned = rows.filter((r) => !r.owner.trim()).length;
  const unmeasured = rows.filter((r) => !r.value.trim()).length;
  const unsourced = rows.filter((r) => !r.source.trim()).length;
  const clean = unverifiable + unowned + unmeasured + unsourced === 0;

  function update(index: number, patch: Partial<Requirement>) {
    setRows((cur) => cur.map((r, i) => (i === index ? {...r, ...patch} : r)));
  }

  return (
    <CalcShell
      title="Requirements Table"
      subtitle="A number, a way to check it, and somebody who answers for it."
      footnote="Ids beginning with R are requirements you chose and could drop. Ids beginning with C are constraints you cannot negotiate, and their source should be a rule number or physical measurement. Verification describes how you will check the row. Test means run it repeatedly and count. Measure means take one instrument reading. Inspect means compare it with a checklist. Demonstrate means show it once from start to finish."
    >
      {/* One record per requirement rather than six table columns: the
          statement is the part people actually read, and a sentence squeezed
          into a 214px cell is unreadable at any screen width. */}
      <div className={calcStyles.records}>
        {rows.map((r, i) => (
          <div className={calcStyles.record} key={i}>
            <div className={calcStyles.recordHead}>
              <input
                className={calcStyles.input}
                style={{width: '5rem', flex: 'none'}}
                value={r.id}
                aria-label={`Requirement ${i + 1} id`}
                onChange={(e) => update(i, {id: e.target.value})}
              />
              <input
                className={calcStyles.input}
                style={{flex: 1}}
                value={r.statement}
                placeholder="what the robot must do"
                aria-label={`Requirement ${i + 1} statement`}
                onChange={(e) => update(i, {statement: e.target.value})}
              />
            </div>
            <div className={calcStyles.recordFields}>
              <label className={calcStyles.recordField}>
                <span className={calcStyles.presetLabel}>Value</span>
                <input
                  className={calcStyles.input}
                  value={r.value}
                  placeholder="number + unit"
                  aria-label={`Requirement ${i + 1} value`}
                  onChange={(e) => update(i, {value: e.target.value})}
                />
              </label>
              <label className={calcStyles.recordField}>
                <span className={calcStyles.presetLabel}>Verify by</span>
                <select
                  className={calcStyles.select}
                  value={r.verification}
                  aria-label={`Requirement ${i + 1} verification`}
                  onChange={(e) => update(i, {verification: e.target.value as Verification})}
                >
                  <option value="">not set</option>
                  {VERIFICATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className={calcStyles.recordField}>
                <span className={calcStyles.presetLabel}>Owner</span>
                <input
                  className={calcStyles.input}
                  value={r.owner}
                  placeholder="subsystem"
                  aria-label={`Requirement ${i + 1} owner`}
                  onChange={(e) => update(i, {owner: e.target.value})}
                />
              </label>
              <label className={calcStyles.recordField}>
                <span className={calcStyles.presetLabel}>Source</span>
                <input
                  className={calcStyles.input}
                  value={r.source}
                  placeholder="rule or strategy"
                  aria-label={`Requirement ${i + 1} source`}
                  onChange={(e) => update(i, {source: e.target.value})}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className={calcStyles.rowActions}>
        <button type="button" className={calcStyles.button}
          onClick={() => setRows((c) => [...c, {id: `R${c.length + 1}`, statement: '', value: '', verification: '', owner: '', source: ''}])}>
          Add requirement
        </button>
        <button type="button" className={calcStyles.button} onClick={() => setRows(DEFAULT)}>
          Reset
        </button>
      </div>

      {clean ? (
        <Verdict level="good">
          Every row has a number, verification method, owner, and source. A
          design review can now ask for the evidence tied to a specific id.
        </Verdict>
      ) : (
        <Verdict level="warn">
          {unmeasured > 0 && <>{unmeasured} row(s) have no number, so nothing can pass or fail them. </>}
          {unverifiable > 0 && <>{unverifiable} row(s) have no verification method. </>}
          {unowned > 0 && <>{unowned} row(s) have no assigned owner. </>}
          {unsourced > 0 && <>{unsourced} row(s) have no source, so you cannot tell a rule from a preference. </>}
        </Verdict>
      )}
    </CalcShell>
  );
}
