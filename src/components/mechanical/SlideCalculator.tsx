import React, {useState} from 'react';
import {
  CalcShell,
  Inputs,
  NumberField,
  Result,
  Presets,
  Results,
  SelectField,
  Verdict,
} from './CalcShell';
import {slide, fmt} from '@site/src/telemark/mechanicalMath';
import SlideRiggingVisual from './visuals/SlideRiggingVisual';
import PlayControl from './PlayControl';
import {useSweep} from './useAnimation';

type SlideType = 'cascade' | 'continuous';

/**
 * Linear slide sizing calculator.
 *
 * A cascading slide multiplies both the extension speed and the required
 * force by the number of moving stages. A continuous rigging pulls every stage
 * at the same rate, so the multiplier is 1. Teams routinely forget the force
 * side of that trade and end up with a slide that cannot lift its own load.
 */
type SlidePresetId = 'balanced' | 'cannotLift' | 'slow';

/** The cascade trade, shown as three configurations. */
const SLIDE_PRESETS: Record<
  SlidePresetId,
  {cascading: boolean; stages: number; spool: number; rpm: number; torque: number; load: number}
> = {
  balanced: {cascading: true, stages: 3, spool: 1.4, rpm: 312, torque: 2.38, load: 4},
  cannotLift: {cascading: true, stages: 4, spool: 2.4, rpm: 435, torque: 1.83, load: 7},
  slow: {cascading: false, stages: 3, spool: 0.8, rpm: 117, torque: 6.18, load: 4},
};

export default function SlideCalculator(): React.JSX.Element {
  const [slideType, setSlideType] = useState<SlideType>('cascade');
  const [stages, setStages] = useState(3);
  const [spoolDiameter, setSpoolDiameter] = useState(1.4);
  const [outputRpm, setOutputRpm] = useState(312);
  const [outputTorque, setOutputTorque] = useState(2.38);
  const [loadWeight, setLoadWeight] = useState(4);
  const [travelIn, setTravelIn] = useState(28);
  const [efficiency, setEfficiency] = useState(75);
  const [preset, setPreset] = useState<SlidePresetId | null>('balanced');

  function applyPreset(id: SlidePresetId) {
    const values = SLIDE_PRESETS[id];
    setPreset(id);
    setSlideType(values.cascading ? 'cascade' : 'continuous');
    setStages(values.stages);
    setSpoolDiameter(values.spool);
    setOutputRpm(values.rpm);
    setOutputTorque(values.torque);
    setLoadWeight(values.load);
  }

  // Extension is animated at the calculated speed, so a fast rigging visibly
  // reaches full travel sooner than a slow one.
  const sweep = useSweep({from: 0, to: 1, durationMs: 2200});

  const {
    multiplier,
    extendSpeedIps,
    travelTimeS,
    liftForceLbf,
    safetyFactor,
  } = slide({
    cascading: slideType === 'cascade',
    stages,
    spoolDiameterIn: spoolDiameter,
    outputRpm,
    outputTorqueNm: outputTorque,
    loadWeightLb: loadWeight,
    travelIn,
    efficiencyPercent: efficiency,
  });
  const requiredLbf = loadWeight;

  return (
    <CalcShell
      title="Linear Slide Sizing"
      subtitle="Cascading buys speed with force. Decide which one you actually need."
      footnote="Efficiency on a slide is lower than on a gearbox: string friction, pulley losses, and any bind from misalignment all subtract. 75% is a reasonable starting estimate for a clean build and optimistic for a first prototype. Load weight should include the game element, the end effector, and everything the slide carries."
    >
      <Presets
        options={[
          {id: 'balanced', label: 'Workable', hint: 'Fast enough and lifts the load with margin'},
          {id: 'cannotLift', label: 'Cannot lift', hint: 'Four stages and a big spool: fast, and far too weak'},
          {id: 'slow', label: 'Strong but slow', hint: 'Continuous rigging with a small spool'},
        ]}
        active={preset}
        onSelect={applyPreset}
      />

      <Inputs>
        <SelectField
          label="Rigging"
          value={slideType}
          onChange={setSlideType}
          options={[
            {value: 'cascade', label: 'Cascading (stages multiply)'},
            {value: 'continuous', label: 'Continuous (stages move together)'},
          ]}
        />
        <NumberField label="Moving stages" value={stages} onChange={setStages} hint="Not counting the fixed base stage" min={1} step={1} />
        <NumberField label="Spool diameter (in)" value={spoolDiameter} onChange={setSpoolDiameter} hint="Including built up string" min={0.2} step={0.1} />
        <NumberField label="Motor output speed (RPM)" value={outputRpm} onChange={setOutputRpm} hint="After the gearbox" min={1} />
        <NumberField label="Motor output torque (N·m)" value={outputTorque} onChange={setOutputTorque} hint="Stall torque after the gearbox" min={0.01} step={0.01} />
        <NumberField label="Load weight (lb)" value={loadWeight} onChange={setLoadWeight} min={0} step={0.1} />
        <NumberField label="Total travel (in)" value={travelIn} onChange={setTravelIn} min={1} />
        <NumberField label="Rigging efficiency (%)" value={efficiency} onChange={setEfficiency} min={1} max={100} />
      </Inputs>

      <PlayControl
        playing={sweep.playing}
        disabled={sweep.disabled}
        onToggle={sweep.toggle}
        onReset={sweep.stop}
        label="Extend the slide"
      />

      <SlideRiggingVisual
        progress={sweep.playing ? sweep.value : 0.6}
        cascading={slideType === 'cascade'}
        stages={stages}
        multiplier={multiplier}
        extendSpeedIps={extendSpeedIps}
        liftForceLbf={liftForceLbf}
        loadWeightLb={loadWeight}
        travelIn={travelIn}
      />

      <Results>
        <Result value={`${multiplier}x`} label="Stage multiplier" note={slideType === 'cascade' ? 'Speed up, force down' : 'No multiplication'} />
        <Result value={fmt(extendSpeedIps, 1)} label="Extension speed (in/s)" note="No load applied" />
        <Result value={fmt(travelTimeS, 2)} label="Time to full travel (s)" />
        <Result value={fmt(liftForceLbf, 1)} label="Lifting force (lbf)" note="At stall, after losses" />
        <Result value={`${fmt(safetyFactor, 2)}x`} label="Safety factor" note={`Load is ${fmt(requiredLbf, 1)} lbf`} />
      </Results>

      {safetyFactor < 1 ? (
        <Verdict level="bad">
          The slide cannot lift this load. A cascading rigging divides your
          force by the stage count, which is usually what caught you. Use a
          smaller spool, more reduction, or a continuous rigging.
        </Verdict>
      ) : safetyFactor < 1.8 ? (
        <Verdict level="warn">
          It lifts, but barely. Slide friction rises as soon as the mechanism
          gets slightly out of square, and the string diameter grows the
          effective spool as it wraps. Build margin in now.
        </Verdict>
      ) : (
        <Verdict level="good">
          Good margin. Check the descent too: with this much reduction the slide
          may not back-drive, which is often desirable for holding position but
          means a failed motor leaves the slide stuck up.
        </Verdict>
      )}
    </CalcShell>
  );
}
