import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  RangeField,
  Result,
  Results,
  SelectField,
  Verdict,
  fmt,
} from './CalcShell';
import {MOTORS} from './motors';
import {NM_TO_IN_LB, motorOperatingPoint} from '@site/src/telemark/mechanicalMath';
import MotorCurveChart from './visuals/MotorCurveChart';
import PlayControl from './PlayControl';
import {useSweep} from './useAnimation';

/**
 * Motor operating point explorer.
 *
 * A brushed DC motor is modelled as a straight line between two endpoints:
 * free speed at zero torque, and stall torque at zero speed. Everything in
 * between follows from that line, including the peak power point at exactly
 * half of each.
 */
export default function MotorCurveExplorer(): React.JSX.Element {
  const [motorId, setMotorId] = useState(MOTORS[0].id);
  const [reduction, setReduction] = useState(20);
  const [loadTorque, setLoadTorque] = useState(0.8);

  // Sweeping the load walks the operating point down the torque line, which
  // shows the speed and current trade far better than a single reading.
  const sweep = useSweep({from: 0, to: 1, durationMs: 3000});

  const motor = MOTORS.find((entry) => entry.id === motorId) ?? MOTORS[0];
  const stallAtOutput = motor.stallTorqueNm * (reduction > 0 ? reduction : 1);
  // While sweeping, the load walks from no load to just past stall.
  const effectiveLoad = sweep.playing
    ? Number((sweep.value * stallAtOutput * 1.05).toFixed(3))
    : loadTorque;
  const {
    outputFreeRpm,
    outputStallTorqueNm: outputStallTorque,
    torqueFraction,
    loadedRpm,
    currentA,
    outputPowerW,
    peakPowerW,
    overloaded,
  } = motorOperatingPoint(motor, reduction, effectiveLoad);
  const nearStall = torqueFraction > 0.6;

  return (
    <CalcShell
      title="Motor Operating Point"
      subtitle="Where the mechanism actually runs, not where the datasheet says it could."
      footnote={`${motor.note} Published values assume 12 V. A sagging battery lowers both free speed and stall torque, so treat these as best case.`}
    >
      <Inputs>
        <SelectField
          label="Motor"
          value={motorId}
          onChange={setMotorId}
          options={MOTORS.map((entry) => ({value: entry.id, label: entry.name}))}
          hint="Verify against the vendor spec page"
        />
        <NumberField
          label="External reduction (:1)"
          value={reduction}
          onChange={setReduction}
          hint="Gearbox plus any gears or belts after it"
          min={0.1}
        />
        <RangeField
          label="Load torque at output"
          value={effectiveLoad}
          onChange={(next) => {
            sweep.stop();
            setLoadTorque(next);
          }}
          min={0}
          max={Number((stallAtOutput * 1.2).toFixed(2))}
          step={0.01}
          unit="N·m"
          hint="What the mechanism demands"
        />
      </Inputs>

      <PlayControl
        playing={sweep.playing}
        disabled={sweep.disabled}
        onToggle={sweep.toggle}
        onReset={sweep.stop}
        label="Sweep the load"
      />

      <MotorCurveChart
        freeRpm={outputFreeRpm}
        stallTorqueNm={outputStallTorque}
        loadTorqueNm={effectiveLoad}
        loadedRpm={loadedRpm}
      />

      <Results>
        <Result
          value={fmt(outputFreeRpm, 0)}
          label="Free speed (RPM)"
          note="No load at the output"
        />
        <Result
          value={fmt(outputStallTorque, 2)}
          label="Stall torque (N·m)"
          note={`${fmt(outputStallTorque * NM_TO_IN_LB, 1)} in-lb`}
        />
        <Result
          value={fmt(loadedRpm, 0)}
          label="Loaded speed (RPM)"
          note={`${fmt(torqueFraction * 100, 0)}% of stall torque used`}
        />
        <Result
          value={fmt(currentA, 1)}
          label="Current draw (A)"
          note={`Stall would draw ${fmt(motor.stallCurrentA, 1)} A`}
        />
        <Result
          value={fmt(outputPowerW, 1)}
          label="Output power (W)"
          note={`Peak available is ${fmt(peakPowerW, 1)} W`}
        />
      </Results>

      {overloaded ? (
        <Verdict level="bad">
          The load meets or exceeds stall torque. The mechanism will not move,
          the motor will draw its full stall current, and it will start heating
          immediately. Add reduction, remove load, or pick a stronger motor.
        </Verdict>
      ) : nearStall ? (
        <Verdict level="warn">
          Running past about 60% of stall torque is slow and hot. It also leaves
          no headroom for friction, a low battery, or a game element that is
          heavier than the one you tested with. Aim for a load under half of
          stall torque.
        </Verdict>
      ) : (
        <Verdict level="good">
          This operating point leaves real margin. Note that peak power sits at
          exactly half free speed and half stall torque, so a mechanism designed
          near that point delivers the most work per second.
        </Verdict>
      )}
    </CalcShell>
  );
}
