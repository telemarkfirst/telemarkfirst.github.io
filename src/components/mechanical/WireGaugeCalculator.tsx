import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Result,
  Results,
  Verdict,
  calcStyles,
} from './CalcShell';
import {fmt, recommendedWire, wireRows} from '@site/src/telemark/mechanicalMath';
import VoltageDropVisual from './visuals/VoltageDropVisual';

/**
 * Wire gauge selector.
 *
 * Two separate checks matter: the wire must carry the current without
 * overheating, and it must not drop so much voltage that the motor loses
 * meaningful power. Current travels out and back, so voltage drop uses twice
 * the one-way run length.
 */
export default function WireGaugeCalculator(): React.JSX.Element {
  const [current, setCurrent] = useState(10);
  const [lengthFt, setLengthFt] = useState(3);
  const [systemVolts, setSystemVolts] = useState(12);
  const [maxDropPercent, setMaxDropPercent] = useState(3);

  const rows = wireRows(current, lengthFt, systemVolts, maxDropPercent);
  const recommended = recommendedWire(rows);

  return (
    <CalcShell
      title="Wire Gauge and Voltage Drop"
      subtitle="Carry the current, and keep the volts at the motor."
      footnote="Resistance values are for copper at room temperature; hot wire has higher resistance, so real drop is slightly worse. The chassis current column is a general wiring guideline, not an FTC rule. Always check the current season's game manual for the required gauges and connectors between the battery, main breaker, and power distribution."
    >
      <Inputs>
        <NumberField label="Current (A)" value={current} onChange={setCurrent} hint="Expected sustained draw, not stall" min={0.1} step={0.5} />
        <NumberField label="One way run length (ft)" value={lengthFt} onChange={setLengthFt} hint="Source to load, measured along the route" min={0.1} step={0.5} />
        <NumberField label="System voltage (V)" value={systemVolts} onChange={setSystemVolts} min={1} />
        <NumberField label="Acceptable drop (%)" value={maxDropPercent} onChange={setMaxDropPercent} hint="3 is a common target" min={0.1} step={0.5} />
      </Inputs>

      <VoltageDropVisual
        systemVolts={systemVolts}
        dropV={recommended ? recommended.dropV : 0}
        awg={recommended ? recommended.awg : null}
        lengthFt={lengthFt}
        currentA={current}
        maxDropPercent={maxDropPercent}
      />

      <Results>
        <Result
          value={recommended ? `${recommended.awg} AWG` : 'None'}
          label="Smallest workable gauge"
          note={recommended ? `${fmt(recommended.dropPercent, 2)}% drop` : 'Shorten the run or raise the drop budget'}
        />
        <Result
          value={recommended ? fmt(recommended.dropV, 3) : '--'}
          label="Voltage drop (V)"
          note="Round trip, out and back"
        />
        <Result
          value={recommended ? fmt(current * recommended.dropV, 2) : '--'}
          label="Power lost in wire (W)"
          note="Heat, not motion"
        />
      </Results>

      <table className={calcStyles.table}>
        <thead>
          <tr>
            <th>AWG</th>
            <th>Round trip resistance</th>
            <th>Voltage drop</th>
            <th>Drop %</th>
            <th>Carries current</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.awg}
              className={recommended && row.awg === recommended.awg ? calcStyles.tableRowActive : undefined}
            >
              <td>{row.awg}</td>
              <td>{fmt(row.resistance, 4)} ohm</td>
              <td>{fmt(row.dropV, 3)} V</td>
              <td>{fmt(row.dropPercent, 2)}%</td>
              <td>{row.ampacityOk ? `Yes, up to ${row.chassisAmps} A` : `No, rated ${row.chassisAmps} A`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!recommended ? (
        <Verdict level="bad">
          No listed gauge meets both checks at this current and length. Shorten
          the run, split the load across circuits, or accept a larger drop
          deliberately and write down why.
        </Verdict>
      ) : recommended.awg <= 12 ? (
        <Verdict level="warn">
          This run needs heavy wire. Heavy wire is stiff, and stiff wire pulls
          on connectors every time the robot moves. Plan the routing and strain
          relief before you crimp anything.
        </Verdict>
      ) : (
        <Verdict level="good">
          That gauge satisfies both the current and the voltage drop checks.
          Going one size larger costs a little weight and buys margin for a hot
          motor pulling more than you estimated.
        </Verdict>
      )}
    </CalcShell>
  );
}
