import React, {useState} from 'react';
import {CalcShell, Inputs, SelectField, Result, Results, Verdict, calcStyles} from './CalcShell';
import {fmt, MM_PER_IN} from '@site/src/telemark/mechanicalMath';
import HoleScaleVisual from './visuals/HoleScaleVisual';

interface ThreadSpec {
  id: string;
  label: string;
  majorMm: number;
  pitchMm: number;
  tapDrillMm: number;
  closeFitMm: number;
  freeFitMm: number;
  common: string;
}

/**
 * Standard tap drill and clearance sizes.
 *
 * Tap drill for a roughly 75% thread is the major diameter minus the pitch.
 * That is enough thread engagement for full practical strength while keeping
 * the tapping torque low enough that you do not snap the tap.
 */
const THREADS: ThreadSpec[] = [
  {id: 'm3', label: 'M3 x 0.5', majorMm: 3, pitchMm: 0.5, tapDrillMm: 2.5, closeFitMm: 3.2, freeFitMm: 3.4, common: 'The default FTC fastener. Used across REV and goBILDA hole patterns.'},
  {id: 'm4', label: 'M4 x 0.7', majorMm: 4, pitchMm: 0.7, tapDrillMm: 3.3, closeFitMm: 4.3, freeFitMm: 4.5, common: 'Motor face mounting and heavier brackets.'},
  {id: 'm5', label: 'M5 x 0.8', majorMm: 5, pitchMm: 0.8, tapDrillMm: 4.2, closeFitMm: 5.3, freeFitMm: 5.5, common: 'Structural joints and some wheel hubs.'},
  {id: 'm6', label: 'M6 x 1.0', majorMm: 6, pitchMm: 1.0, tapDrillMm: 5.0, closeFitMm: 6.4, freeFitMm: 6.6, common: 'Heavy structural connections. Rare on an FTC robot.'},
  {id: '6-32', label: '#6-32 UNC', majorMm: 3.505, pitchMm: 0.794, tapDrillMm: 2.71, closeFitMm: 3.8, freeFitMm: 4.0, common: 'Tetrix and older imperial build systems. Tap drill is a #36.'},
  {id: '8-32', label: '#8-32 UNC', majorMm: 4.166, pitchMm: 0.794, tapDrillMm: 3.45, closeFitMm: 4.4, freeFitMm: 4.6, common: 'Imperial structural hardware. Tap drill is a #29.'},
  {id: '10-32', label: '#10-32 UNF', majorMm: 4.826, pitchMm: 0.794, tapDrillMm: 4.04, closeFitMm: 5.1, freeFitMm: 5.3, common: 'Common in FRC carryover parts. Tap drill is a #21.'},
  {id: '1/4-20', label: '1/4-20 UNC', majorMm: 6.35, pitchMm: 1.27, tapDrillMm: 5.11, closeFitMm: 6.7, freeFitMm: 7.0, common: 'Heavy hardware and shaft collars. Tap drill is a #7.'},
];

export default function TapDrillReference(): React.JSX.Element {
  const [threadId, setThreadId] = useState('m3');
  const thread = THREADS.find((entry) => entry.id === threadId) ?? THREADS[0];
  const derivedTapDrill = thread.majorMm - thread.pitchMm;

  return (
    <CalcShell
      title="Tap Drill and Clearance Reference"
      subtitle="Two different holes. Pick the wrong one and the joint is ruined."
      footnote="A tapped hole receives the threads and must be drilled small. A clearance hole lets the screw pass through freely and must be drilled large. Drilling a clearance hole where you needed a tapped hole cannot be undone, so mark which is which on the drawing before anyone picks up a drill."
    >
      <Inputs>
        <SelectField
          label="Thread"
          value={threadId}
          onChange={setThreadId}
          options={THREADS.map((entry) => ({value: entry.id, label: entry.label}))}
        />
      </Inputs>

      <HoleScaleVisual
        label={thread.label}
        majorMm={thread.majorMm}
        tapDrillMm={thread.tapDrillMm}
        closeFitMm={thread.closeFitMm}
        freeFitMm={thread.freeFitMm}
      />

      <Results>
        <Result
          value={`${fmt(thread.tapDrillMm, 2)} mm`}
          label="Tap drill"
          note={`${fmt(thread.tapDrillMm / MM_PER_IN, 3)} in, for a 75% thread`}
        />
        <Result
          value={`${fmt(thread.closeFitMm, 1)} mm`}
          label="Close clearance"
          note="Tight location, less adjustment"
        />
        <Result
          value={`${fmt(thread.freeFitMm, 1)} mm`}
          label="Free clearance"
          note="Easier assembly, some slop"
        />
        <Result
          value={`${fmt(derivedTapDrill, 2)} mm`}
          label="Major minus pitch"
          note="The rule of thumb, for comparison"
        />
      </Results>

      <table className={calcStyles.table}>
        <thead>
          <tr>
            <th>Thread</th>
            <th>Pitch</th>
            <th>Tap drill</th>
            <th>Close fit</th>
            <th>Free fit</th>
          </tr>
        </thead>
        <tbody>
          {THREADS.map((entry) => (
            <tr key={entry.id} className={entry.id === threadId ? calcStyles.tableRowActive : undefined}>
              <td>{entry.label}</td>
              <td>{fmt(entry.pitchMm, 2)} mm</td>
              <td>{fmt(entry.tapDrillMm, 2)} mm</td>
              <td>{fmt(entry.closeFitMm, 1)} mm</td>
              <td>{fmt(entry.freeFitMm, 1)} mm</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Verdict level="good">{thread.common}</Verdict>
    </CalcShell>
  );
}
