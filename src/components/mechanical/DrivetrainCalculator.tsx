import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Result,
  Presets,
  Results,
  Verdict,
} from './CalcShell';
import {drivetrain, fmt} from '@site/src/telemark/mechanicalMath';
import DrivetrainLimitsVisual from './visuals/DrivetrainLimitsVisual';

/**
 * Drivetrain speed and pushing force calculator.
 *
 * Two independent limits decide how hard a robot can push:
 *   - what the motors can deliver through the wheels
 *   - what the tires can transmit to the floor before slipping
 * The lower of the two wins. A drivetrain that is motor limited stalls and
 * overheats; one that is traction limited spins its wheels and survives.
 */
type PresetId = 'balanced' | 'undergeared' | 'slippery';

/** Configurations worth seeing, including two that fail instructively. */
const DRIVETRAIN_PRESETS: Record<
  PresetId,
  {motorCount: number; reduction: number; wheelDiameter: number; robotWeight: number; friction: number}
> = {
  balanced: {motorCount: 4, reduction: 20, wheelDiameter: 3.78, robotWeight: 30, friction: 1.0},
  undergeared: {motorCount: 4, reduction: 6, wheelDiameter: 4, robotWeight: 30, friction: 1.0},
  slippery: {motorCount: 4, reduction: 20, wheelDiameter: 3.78, robotWeight: 30, friction: 0.4},
};

export default function DrivetrainCalculator(): React.JSX.Element {
  const [motorCount, setMotorCount] = useState(4);
  const [freeRpm, setFreeRpm] = useState(6000);
  const [stallTorque, setStallTorque] = useState(0.105);
  const [stallCurrent, setStallCurrent] = useState(11);
  const [reduction, setReduction] = useState(20);
  const [wheelDiameter, setWheelDiameter] = useState(3.78);
  const [robotWeight, setRobotWeight] = useState(30);
  const [frictionCoefficient, setFrictionCoefficient] = useState(1.0);
  const [drivenFraction, setDrivenFraction] = useState(100);
  const [preset, setPreset] = useState<PresetId | null>('balanced');

  function applyPreset(id: PresetId) {
    const values = DRIVETRAIN_PRESETS[id];
    setPreset(id);
    setMotorCount(values.motorCount);
    setReduction(values.reduction);
    setWheelDiameter(values.wheelDiameter);
    setRobotWeight(values.robotWeight);
    setFrictionCoefficient(values.friction);
  }

  const {
    wheelRpm,
    freeSpeedFps,
    motorForceLbf,
    tractionLbf,
    pushingLbf,
    motorLimited,
    pushCurrentA,
  } = drivetrain({
    motorCount,
    freeRpm,
    stallTorqueNm: stallTorque,
    stallCurrentA: stallCurrent,
    reduction,
    wheelDiameterIn: wheelDiameter,
    robotWeightLb: robotWeight,
    frictionCoefficient,
    drivenFractionPercent: drivenFraction,
  });

  return (
    <CalcShell
      title="Drivetrain Speed and Pushing Force"
      subtitle="Free speed is marketing. Pushing force is what wins a shoving match."
      footnote="Free speed assumes no load, a full battery, and no drivetrain friction. Real robots typically reach roughly 80% to 90% of the calculated free speed. Coefficient of friction depends on wheel compound and floor surface: soft compliant treads on FTC field tiles are commonly near 1.0, hard plastic omni rollers are considerably lower."
    >
      <Presets
        options={[
          {id: 'balanced', label: 'Traction limited', hint: 'A healthy drivetrain: the wheels slip before the motors stall'},
          {id: 'undergeared', label: 'Under geared', hint: 'Too little reduction, so the motors stall in a pushing match'},
          {id: 'slippery', label: 'Hard wheels', hint: 'Low friction tread, so pushing force collapses'},
        ]}
        active={preset}
        onSelect={applyPreset}
      />

      <Inputs>
        <NumberField label="Drive motors" value={motorCount} onChange={setMotorCount} min={1} step={1} />
        <NumberField label="Motor free speed (RPM)" value={freeRpm} onChange={setFreeRpm} hint="Bare motor before reduction" min={1} />
        <NumberField label="Motor stall torque (N·m)" value={stallTorque} onChange={setStallTorque} hint="Bare motor before reduction" min={0.001} step={0.001} />
        <NumberField label="Motor stall current (A)" value={stallCurrent} onChange={setStallCurrent} min={0.1} step={0.1} />
        <NumberField label="Total reduction (:1)" value={reduction} onChange={(next) => { setPreset(null); setReduction(next); }} hint="Gearbox and any external stages" min={0.1} />
        <NumberField label="Wheel diameter (in)" value={wheelDiameter} onChange={setWheelDiameter} min={0.5} step={0.01} />
        <NumberField label="Robot weight (lb)" value={robotWeight} onChange={setRobotWeight} hint="Including battery and game elements" min={1} />
        <NumberField label="Coefficient of friction" value={frictionCoefficient} onChange={(next) => { setPreset(null); setFrictionCoefficient(next); }} hint="Wheel on field tile" min={0.05} step={0.05} />
        <NumberField label="Weight on driven wheels (%)" value={drivenFraction} onChange={setDrivenFraction} hint="100 if every wheel is powered" min={1} max={100} step={1} />
      </Inputs>

      <DrivetrainLimitsVisual
        motorForceLbf={motorForceLbf}
        tractionLbf={tractionLbf}
        pushingLbf={pushingLbf}
        motorLimited={motorLimited}
        freeSpeedFps={freeSpeedFps}
      />

      <Results>
        <Result value={fmt(freeSpeedFps, 2)} label="Free speed (ft/s)" note={`${fmt(wheelRpm, 0)} wheel RPM`} />
        <Result value={fmt(motorForceLbf, 1)} label="Motor limit (lbf)" note="All motors at stall torque" />
        <Result value={fmt(tractionLbf, 1)} label="Traction limit (lbf)" note="Before the wheels slip" />
        <Result value={fmt(pushingLbf, 1)} label="Pushing force (lbf)" note="The lower of the two limits" />
        <Result value={fmt(pushCurrentA, 1)} label="Current at max push (A)" note="Total across all drive motors" />
      </Results>

      {motorLimited ? (
        <Verdict level="warn">
          This drivetrain is motor limited. In a pushing match the wheels grip
          and the motors stall, which draws{' '}
          {fmt(motorCount * stallCurrent, 0)} A and heats the motors fast. Add
          reduction to trade top speed for force until the traction limit is the
          binding one.
        </Verdict>
      ) : pushCurrentA > 40 ? (
        <Verdict level="warn">
          Traction limited, which is the right side to be on, but the drivetrain
          pulls {fmt(pushCurrentA, 0)} A while doing it. Watch total robot
          current: sustained draw near the main breaker rating will trip it
          mid-match.
        </Verdict>
      ) : (
        <Verdict level="good">
          Traction limited with reasonable current. The wheels slip before the
          motors stall, which protects the motors and gives the driver a
          predictable limit.
        </Verdict>
      )}
    </CalcShell>
  );
}
