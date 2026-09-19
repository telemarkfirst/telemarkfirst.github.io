import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Result,
  Results,
  Verdict,
  fmt,
} from './CalcShell';
import {NM_TO_IN_LB, gearTrain, type GearStage} from '@site/src/telemark/mechanicalMath';
import GearTrainVisual from './visuals/GearTrainVisual';
import PlayControl from './PlayControl';
import {usePrefersReducedMotion} from './useAnimation';

type Stage = GearStage;

/**
 * Multi-stage gear reduction calculator.
 *
 * Reduction multiplies across stages: a 2:1 followed by a 3:1 is 6:1 overall.
 * Output speed divides by the ratio and output torque multiplies by it, minus
 * whatever the stage efficiency costs you.
 */
export default function GearRatioCalculator(): React.JSX.Element {
  const [inputRpm, setInputRpm] = useState(6000);
  const [inputTorque, setInputTorque] = useState(0.105);
  const [efficiency, setEfficiency] = useState(95);
  const [spinning, setSpinning] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const [stages, setStages] = useState<Stage[]>([
    {driving: 12, driven: 60},
    {driving: 15, driven: 45},
  ]);

  const {ratio, outputRpm, outputTorqueNm: outputTorque, totalEfficiency} =
    gearTrain(stages, inputRpm, inputTorque, efficiency);
  const stageEfficiency = Math.min(Math.max(efficiency, 0), 100) / 100;

  function updateStage(index: number, key: keyof Stage, value: number) {
    setStages((current) =>
      current.map((stage, stageIndex) =>
        stageIndex === index ? {...stage, [key]: value} : stage,
      ),
    );
  }

  return (
    <CalcShell
      title="Gear Ratio Calculator"
      subtitle="Chain the stages, read the output."
      footnote={`Overall efficiency shown is stage efficiency raised to the power of the stage count (${fmt(stageEfficiency * 100, 0)}% to the power of ${stages.length}). Spur gears in good mesh are commonly estimated near 95% per stage; a worn or misaligned stage is worse.`}
    >
      <Inputs>
        <NumberField
          label="Input speed (RPM)"
          value={inputRpm}
          onChange={setInputRpm}
          hint="Motor free speed before reduction"
          min={0}
        />
        <NumberField
          label="Input torque (N·m)"
          value={inputTorque}
          onChange={setInputTorque}
          hint="Motor stall torque before reduction"
          min={0}
          step={0.001}
        />
        <NumberField
          label="Efficiency per stage (%)"
          value={efficiency}
          onChange={setEfficiency}
          hint="Use 95 unless you have measured better"
          min={1}
          max={100}
        />
      </Inputs>

      <Inputs>
        {stages.map((stage, index) => (
          // Stage order is fixed by the user's edits, so the index is a stable key.
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={`stage-${index}`}>
            <NumberField
              label={`Stage ${index + 1} driving teeth`}
              value={stage.driving}
              onChange={(next) => updateStage(index, 'driving', next)}
              hint="Gear on the motor side"
              min={1}
              step={1}
            />
            <NumberField
              label={`Stage ${index + 1} driven teeth`}
              value={stage.driven}
              onChange={(next) => updateStage(index, 'driven', next)}
              hint="Gear on the output side"
              min={1}
              step={1}
            />
          </React.Fragment>
        ))}
      </Inputs>

      <PlayControl
        playing={spinning}
        disabled={reducedMotion}
        onToggle={() => setSpinning((current) => !current)}
        onReset={() => setSpinning(false)}
        label="Spin the train"
      />

      <GearTrainVisual
        spinning={spinning && !reducedMotion}
        stages={stages}
        ratio={ratio}
        inputRpm={inputRpm}
        outputRpm={outputRpm}
      />

      <Results>
        <Result value={`${fmt(ratio, 2)}:1`} label="Overall reduction" />
        <Result
          value={fmt(outputRpm, 0)}
          label="Output RPM"
          note="Free speed, no load applied"
        />
        <Result
          value={fmt(outputTorque, 2)}
          label="Output torque (N·m)"
          note={`${fmt(outputTorque * NM_TO_IN_LB, 1)} in-lb at stall`}
        />
        <Result
          value={`${fmt(totalEfficiency * 100, 0)}%`}
          label="Transmission efficiency"
        />
      </Results>

      {ratio < 1 ? (
        <Verdict level="warn">
          This is an overdrive, not a reduction. Output turns faster than the
          motor but with less torque. That is correct for some flywheels and
          almost never correct for a drivetrain or an arm.
        </Verdict>
      ) : ratio > 200 ? (
        <Verdict level="warn">
          Reductions past roughly 200:1 get physically large and slow. Check
          whether a higher torque motor or a counterbalance would be simpler
          than another gear stage.
        </Verdict>
      ) : (
        <Verdict level="good">
          Remember that output RPM is a free speed. Under real load the
          mechanism runs somewhere below it, and the loaded speed is what
          determines your cycle time.
        </Verdict>
      )}
    </CalcShell>
  );
}
