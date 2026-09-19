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
import {fmt, holeForFit} from '@site/src/telemark/mechanicalMath';
import FitScaleVisual from './visuals/FitScaleVisual';

type FitId = 'free' | 'close' | 'transition' | 'press';
type ProcessId = 'machined' | 'printedFdm' | 'laser';

const FITS: Record<FitId, {label: string; minClearanceMm: number; maxClearanceMm: number; use: string}> = {
  free: {
    label: 'Free running',
    minClearanceMm: 0.15,
    maxClearanceMm: 0.35,
    use: 'Shafts that must spin easily and tolerate a little misalignment, such as a dead axle through a spacer.',
  },
  close: {
    label: 'Close running',
    minClearanceMm: 0.05,
    maxClearanceMm: 0.15,
    use: 'Rotating shafts where you want minimal slop, such as a shaft through a bearing bore support.',
  },
  transition: {
    label: 'Transition / locational',
    minClearanceMm: -0.02,
    maxClearanceMm: 0.05,
    use: 'Parts that must locate precisely and are held by a screw, such as a dowel pin locating two plates.',
  },
  press: {
    label: 'Press fit',
    minClearanceMm: -0.06,
    maxClearanceMm: -0.02,
    use: 'Bearings pressed into a bore. The part is held by interference alone and needs force to assemble.',
  },
};

const PROCESS_BIAS: Record<ProcessId, {label: string; biasMm: number; note: string}> = {
  machined: {
    label: 'Machined or drilled aluminum',
    biasMm: 0,
    note: 'A drill bit cuts slightly oversize. Ream or bore when the fit actually matters.',
  },
  printedFdm: {
    label: '3D printed, FDM',
    biasMm: 0.2,
    note: 'FDM holes print undersize because of the extrusion path and elephant foot. Add clearance or plan to drill the hole out after printing.',
  },
  laser: {
    label: 'Laser cut polycarbonate',
    biasMm: 0.1,
    note: 'The kerf and heat affected edge move the effective size. Cut a test coupon before committing a full plate.',
  },
};

/**
 * Shaft and hole fit calculator.
 *
 * Fits are specified as a clearance between the hole and the shaft. Negative
 * clearance means interference, which is what makes a press fit hold.
 */
export default function FitCalculator(): React.JSX.Element {
  const [shaftMm, setShaftMm] = useState(8);
  const [fit, setFit] = useState<FitId>('close');
  const [process, setProcess] = useState<ProcessId>('machined');

  const spec = FITS[fit];
  const bias = PROCESS_BIAS[process];

  const {minHole, maxHole, nominalHole, toleranceBand} = holeForFit(
    shaftMm,
    spec,
    bias.biasMm,
  );

  return (
    <CalcShell
      title="Shaft and Hole Fit"
      subtitle="A fit is a clearance, and a clearance is a decision."
      footnote={`${bias.note} These clearances are practical FTC working values, not ISO limit-and-fit tables. If you need a certified fit for a real bearing, use the bearing manufacturer's specified bore tolerance instead.`}
    >
      <Inputs>
        <NumberField
          label="Shaft diameter (mm)"
          value={shaftMm}
          onChange={setShaftMm}
          hint="Common FTC sizes: 5, 6, 8 mm"
          min={1}
          step={0.5}
        />
        <SelectField
          label="Fit type"
          value={fit}
          onChange={setFit}
          options={(Object.keys(FITS) as FitId[]).map((key) => ({value: key, label: FITS[key].label}))}
        />
        <SelectField
          label="How the hole is made"
          value={process}
          onChange={setProcess}
          options={(Object.keys(PROCESS_BIAS) as ProcessId[]).map((key) => ({
            value: key,
            label: PROCESS_BIAS[key].label,
          }))}
        />
      </Inputs>

      <FitScaleVisual
        shaftMm={shaftMm}
        minHole={minHole}
        maxHole={maxHole}
        nominalHole={nominalHole}
        fitLabel={spec.label}
      />

      <Results>
        <Result value={`${fmt(nominalHole, 2)} mm`} label="Draw this hole" note="Nominal to model in CAD" />
        <Result value={`${fmt(minHole, 2)} mm`} label="Minimum hole" />
        <Result value={`${fmt(maxHole, 2)} mm`} label="Maximum hole" />
        <Result
          value={`${fmt(toleranceBand, 2)} mm`}
          label="Tolerance band"
          note="How much variation the fit allows"
        />
      </Results>

      <Verdict level={fit === 'press' ? 'warn' : 'good'}>
        {spec.use}
        {fit === 'press'
          ? ' A press fit into a printed part is unreliable: the plastic creeps under load and the joint loosens over a season. Use a captured nut, a bolted bearing plate, or a metal insert instead.'
          : ''}
      </Verdict>
    </CalcShell>
  );
}
