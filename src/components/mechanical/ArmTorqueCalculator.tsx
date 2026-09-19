import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Presets,
  RangeField,
  Result,
  Results,
  Verdict,
  fmt,
} from './CalcShell';
import {NM_TO_IN_LB, armTorque} from '@site/src/telemark/mechanicalMath';
import ArmAngleVisual from './visuals/ArmAngleVisual';
import PlayControl from './PlayControl';
import {useSweep} from './useAnimation';

/**
 * Arm gravity torque calculator.
 *
 * Static holding torque on a pivoting arm is m * g * L * cos(theta), measured
 * from horizontal. The worst case is always horizontal, where cos(theta) is 1,
 * which is exactly where teams forget to check.
 */
type ArmPresetId = 'sized' | 'stalls' | 'overgeared';

/** Three arms: one that works, one that cannot lift itself, one too slow. */
const ARM_PRESETS: Record<
  ArmPresetId,
  {armWeight: number; armCg: number; payload: number; payloadIn: number; reduction: number}
> = {
  sized: {armWeight: 2.5, armCg: 9, payload: 1.2, payloadIn: 17, reduction: 170},
  stalls: {armWeight: 3, armCg: 11, payload: 1.5, payloadIn: 20, reduction: 40},
  overgeared: {armWeight: 2.5, armCg: 9, payload: 1.2, payloadIn: 17, reduction: 600},
};

export default function ArmTorqueCalculator(): React.JSX.Element {
  const [armWeight, setArmWeight] = useState(2.5);
  const [armCgIn, setArmCgIn] = useState(9);
  const [payloadWeight, setPayloadWeight] = useState(1.2);
  const [payloadIn, setPayloadIn] = useState(17);
  const [angleDeg, setAngleDeg] = useState(0);

  // Sweeping the arm through its range makes the cosine relationship visible:
  // the demand bar fills as the arm approaches horizontal.
  const sweep = useSweep({from: -10, to: 90, durationMs: 2600});
  const displayAngle = sweep.playing ? Math.round(sweep.value) : angleDeg;
  const [motorStall, setMotorStall] = useState(0.105);
  const [reduction, setReduction] = useState(120);
  const [efficiency, setEfficiency] = useState(80);
  const [preset, setPreset] = useState<ArmPresetId | null>('sized');

  function applyPreset(id: ArmPresetId) {
    const values = ARM_PRESETS[id];
    setPreset(id);
    setArmWeight(values.armWeight);
    setArmCgIn(values.armCg);
    setPayloadWeight(values.payload);
    setPayloadIn(values.payloadIn);
    setReduction(values.reduction);
  }

  const {requiredNm, worstCaseNm, availableNm, safetyFactor} = armTorque({
    armWeightLb: armWeight,
    armCgIn,
    payloadWeightLb: payloadWeight,
    payloadIn,
    angleDeg,
    motorStallNm: motorStall,
    reduction,
    efficiencyPercent: efficiency,
  });

  return (
    <CalcShell
      title="Arm Gravity Torque"
      subtitle="Check the horizontal position. That is where the arm is heaviest."
      footnote="This is static torque only: it is what the motor needs just to hold still. Accelerating the arm, catching it after a bump, and holding it against a defensive robot all demand more. Aim for a safety factor of at least 2, and remember that holding at stall for a whole match cooks a motor even when the number says it fits."
    >
      <Presets
        options={[
          {id: 'sized', label: 'Properly sized', hint: 'Safety factor above 2 at horizontal'},
          {id: 'stalls', label: 'Stalls at horizontal', hint: 'Sized at the stowed position, so it cannot lift itself flat'},
          {id: 'overgeared', label: 'Too slow', hint: 'Enormous margin bought at the cost of speed'},
        ]}
        active={preset}
        onSelect={applyPreset}
      />

      <Inputs>
        <NumberField label="Arm weight (lb)" value={armWeight} onChange={setArmWeight} hint="The structure itself" min={0} step={0.1} />
        <NumberField label="Arm CG distance (in)" value={armCgIn} onChange={setArmCgIn} hint="Pivot to the arm's balance point" min={0} step={0.5} />
        <NumberField label="Payload weight (lb)" value={payloadWeight} onChange={setPayloadWeight} hint="Game element plus end effector" min={0} step={0.1} />
        <NumberField label="Payload distance (in)" value={payloadIn} onChange={setPayloadIn} hint="Pivot to the payload" min={0} step={0.5} />
        <RangeField
          label="Arm angle from horizontal"
          value={displayAngle}
          onChange={(next) => {
            sweep.stop();
            setAngleDeg(next);
          }}
          min={-90}
          max={90}
          step={1}
          unit="deg"
          hint="0 is horizontal and worst case"
        />
        <NumberField label="Motor stall torque (N·m)" value={motorStall} onChange={setMotorStall} hint="Bare motor before reduction" min={0.001} step={0.001} />
        <NumberField label="Total reduction (:1)" value={reduction} onChange={(next) => { setPreset(null); setReduction(next); }} min={1} />
        <NumberField label="Drivetrain efficiency (%)" value={efficiency} onChange={setEfficiency} hint="80 is realistic for a multi-stage arm" min={1} max={100} />
      </Inputs>

      <PlayControl
        playing={sweep.playing}
        disabled={sweep.disabled}
        onToggle={sweep.toggle}
        onReset={sweep.stop}
        label="Sweep the arm"
      />

      <ArmAngleVisual
        angleDeg={displayAngle}
        armCgIn={armCgIn}
        payloadIn={payloadIn}
        requiredNm={requiredNm}
        worstCaseNm={worstCaseNm}
        availableNm={availableNm}
      />

      <Results>
        <Result value={fmt(requiredNm, 2)} label="Torque at this angle (N·m)" note={`${fmt(requiredNm * NM_TO_IN_LB, 1)} in-lb`} />
        <Result value={fmt(worstCaseNm, 2)} label="Worst case, horizontal (N·m)" note={`${fmt(worstCaseNm * NM_TO_IN_LB, 1)} in-lb`} />
        <Result value={fmt(availableNm, 2)} label="Available torque (N·m)" note="At stall, after efficiency losses" />
        <Result value={`${fmt(safetyFactor, 2)}x`} label="Safety factor" note="Available divided by worst case" />
      </Results>

      {safetyFactor < 1 ? (
        <Verdict level="bad">
          The arm cannot lift itself at horizontal. It will stall on the way up
          and fall back. Increase the reduction, move the payload closer to the
          pivot, lighten the arm, or add a counterbalance.
        </Verdict>
      ) : safetyFactor < 2 ? (
        <Verdict level="warn">
          It moves, but with no real margin. A heavier game element, a low
          battery, or friction in the joint will stall it. Target a safety
          factor of 2 or more before you build this.
        </Verdict>
      ) : (
        <Verdict level="good">
          Comfortable margin at the worst-case angle. Next question: how long
          does the arm hold position under power? If it holds for most of a
          match, add a counterbalance or a brake so the motor is not fighting
          gravity the entire time.
        </Verdict>
      )}
    </CalcShell>
  );
}
