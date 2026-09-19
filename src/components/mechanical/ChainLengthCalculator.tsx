import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Result,
  Results,
  SelectField,
  Verdict,
} from './CalcShell';
import {chainLength, fmt} from '@site/src/telemark/mechanicalMath';
import ChainWrapVisual from './visuals/ChainWrapVisual';

type DriveType = 'chain25' | 'chain35' | 'gt2' | 'htd5';

const DRIVE_PITCH: Record<DriveType, {label: string; pitchIn: number; unit: string}> = {
  chain25: {label: '#25 roller chain', pitchIn: 0.25, unit: 'links'},
  chain35: {label: '#35 roller chain', pitchIn: 0.375, unit: 'links'},
  gt2: {label: 'GT2 timing belt (2 mm)', pitchIn: 2 / 25.4, unit: 'teeth'},
  htd5: {label: 'HTD 5M timing belt (5 mm)', pitchIn: 5 / 25.4, unit: 'teeth'},
};

/**
 * Chain and belt length calculator.
 *
 * Uses the standard approximation:
 *   L = 2C/p + (N1 + N2)/2 + p((N2 - N1)/(2*pi))^2 / C
 * where L is length in pitches, C is center distance, and p is the pitch.
 */
export default function ChainLengthCalculator(): React.JSX.Element {
  const [driveType, setDriveType] = useState<DriveType>('chain25');
  const [teethA, setTeethA] = useState(15);
  const [teethB, setTeethB] = useState(30);
  const [centerIn, setCenterIn] = useState(6);

  const drive = DRIVE_PITCH[driveType];
  // Roller chain must close on an even link count; belts come in whole teeth.
  const isChain = driveType === 'chain25' || driveType === 'chain35';
  const {
    exactPitches: lengthPitches,
    orderPitches: rounded,
    actualCenterIn: actualCenter,
    wrapAngleDeg,
    ratio,
  } = chainLength(drive.pitchIn, teethA, teethB, centerIn, isChain);

  return (
    <CalcShell
      title="Chain and Belt Length"
      subtitle="Pick a length you can actually buy, then move the center distance to match."
      footnote="Roller chain is sold in whole links and must be an even count to close without a half link. Timing belts are sold in fixed tooth counts, so the practical workflow is to choose a stock belt and then place the shafts at the center distance it needs. Always design in adjustment, either a slot, a tensioner, or a movable motor plate."
    >
      <Inputs>
        <SelectField
          label="Drive type"
          value={driveType}
          onChange={setDriveType}
          options={(Object.keys(DRIVE_PITCH) as DriveType[]).map((key) => ({
            value: key,
            label: DRIVE_PITCH[key].label,
          }))}
        />
        <NumberField
          label="Driving teeth"
          value={teethA}
          onChange={setTeethA}
          hint="Sprocket or pulley on the motor"
          min={6}
          step={1}
        />
        <NumberField
          label="Driven teeth"
          value={teethB}
          onChange={setTeethB}
          hint="Sprocket or pulley on the output"
          min={6}
          step={1}
        />
        <NumberField
          label="Target center distance (in)"
          value={centerIn}
          onChange={setCenterIn}
          hint="Shaft to shaft spacing you want"
          min={0.5}
          step={0.125}
        />
      </Inputs>

      <ChainWrapVisual
        teethA={teethA}
        teethB={teethB}
        centerIn={centerIn}
        actualCenterIn={actualCenter}
        wrapAngleDeg={wrapAngleDeg}
        orderPitches={rounded}
        unit={drive.unit}
      />

      <Results>
        <Result value={`${fmt(ratio, 2)}:1`} label="Reduction" />
        <Result
          value={fmt(lengthPitches, 1)}
          label={`Exact length (${drive.unit})`}
        />
        <Result
          value={String(rounded)}
          label={`Order this (${drive.unit})`}
          note={isChain ? 'Rounded up to an even link count' : 'Rounded up to a stock tooth count'}
        />
        <Result
          value={fmt(actualCenter, 3)}
          label="Resulting center (in)"
          note="Where the shafts must sit for that length"
        />
        <Result
          value={fmt(wrapAngleDeg, 0)}
          label="Wrap on small pulley (deg)"
          note="Keep above 120 degrees when you can"
        />
      </Results>

      {wrapAngleDeg < 120 ? (
        <Verdict level="warn">
          Wrap angle on the small pulley is low. Fewer teeth in mesh means a
          belt is more likely to skip under load. Increase the center distance,
          use a larger small pulley, or add an idler on the slack side.
        </Verdict>
      ) : Math.abs(actualCenter - centerIn) > 0.06 ? (
        <Verdict level="warn">
          The stock length moves your center distance by{' '}
          {fmt(Math.abs(actualCenter - centerIn), 3)} in. Slot the mounting
          holes or add a tensioner so you can absorb that difference during
          assembly.
        </Verdict>
      ) : (
        <Verdict level="good">
          The stock length lands close to your target center distance. Still
          slot the motor mount: chain stretches and belts relax after a few
          hours of run time.
        </Verdict>
      )}
    </CalcShell>
  );
}
