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
import {
  deflection,
  fmt,
  type MaterialKey,
  type SectionKind,
} from '@site/src/telemark/mechanicalMath';
import BeamOrientationVisual from './visuals/BeamOrientationVisual';

type MaterialId = MaterialKey;
type SectionId = SectionKind;
type SupportId = 'cantilever' | 'simple';

const MATERIALS: Record<MaterialId, {label: string}> = {
  aluminum: {label: '6061 aluminum'},
  steel: {label: 'Mild steel'},
  polycarbonate: {label: 'Polycarbonate'},
  petg: {label: 'Printed PETG'},
};

/**
 * Beam deflection calculator.
 *
 * The point of this widget is the cube law. Area moment of inertia scales with
 * height cubed, so making a beam deeper is dramatically more effective than
 * making it thicker or switching to a stiffer material.
 */
export default function DeflectionCalculator(): React.JSX.Element {
  const [material, setMaterial] = useState<MaterialId>('aluminum');
  const [section, setSection] = useState<SectionId>('rectTube');
  const [support, setSupport] = useState<SupportId>('cantilever');
  const [width, setWidth] = useState(0.75);
  const [height, setHeight] = useState(1.5);
  const [wall, setWall] = useState(0.0625);
  const [spanIn, setSpanIn] = useState(16);
  const [loadLbf, setLoadLbf] = useState(15);

  const {deflectionIn, flippedDeflectionIn, spanRatio: ratio} = deflection({
    material,
    section,
    support,
    widthIn: width,
    heightIn: height,
    wallIn: wall,
    spanIn,
    loadLbf,
  });

  return (
    <CalcShell
      title="Beam Deflection"
      subtitle="Depth beats thickness, and it is not close."
      footnote="This models an ideal beam with a single point load and perfect end conditions. A real FTC frame has bolted joints that add their own flex, so treat the result as a comparison tool between two designs rather than an absolute prediction. Round tube ignores the width input and uses the height as the outside diameter."
    >
      <Inputs>
        <SelectField
          label="Material"
          value={material}
          onChange={setMaterial}
          options={(Object.keys(MATERIALS) as MaterialId[]).map((key) => ({
            value: key,
            label: MATERIALS[key].label,
          }))}
        />
        <SelectField
          label="Section"
          value={section}
          onChange={setSection}
          options={[
            {value: 'rectTube', label: 'Rectangular tube'},
            {value: 'solidRect', label: 'Solid rectangle'},
            {value: 'roundTube', label: 'Round tube'},
          ]}
        />
        <SelectField
          label="Support"
          value={support}
          onChange={setSupport}
          options={[
            {value: 'cantilever', label: 'Cantilever, load at the free end'},
            {value: 'simple', label: 'Supported both ends, load at center'},
          ]}
        />
        <NumberField label="Width (in)" value={width} onChange={setWidth} hint="Across the load direction" min={0.05} step={0.05} />
        <NumberField label="Height / depth (in)" value={height} onChange={setHeight} hint="Along the load direction" min={0.05} step={0.05} />
        <NumberField label="Wall thickness (in)" value={wall} onChange={setWall} hint="Ignored for solid sections" min={0.005} step={0.005} />
        <NumberField label="Span (in)" value={spanIn} onChange={setSpanIn} min={0.5} step={0.5} />
        <NumberField label="Load (lbf)" value={loadLbf} onChange={setLoadLbf} min={0.1} step={0.5} />
      </Inputs>

      <BeamOrientationVisual
        widthIn={width}
        heightIn={height}
        spanIn={spanIn}
        deflectionIn={deflectionIn}
        flippedDeflectionIn={flippedDeflectionIn}
        cantilever={support === 'cantilever'}
      />

      <Results>
        <Result value={fmt(deflectionIn, 4)} label="Deflection (in)" note="Under the stated load" />
        <Result value={ratio > 0 ? `L/${fmt(ratio, 0)}` : '--'} label="Span to deflection" note="Higher is stiffer" />
        <Result
          value={fmt(flippedDeflectionIn, 4)}
          label="Deflection if rotated (in)"
          note="Same beam, short side as the depth"
        />
        <Result
          value={
            flippedDeflectionIn > 0 && Number.isFinite(flippedDeflectionIn)
              ? `${fmt(flippedDeflectionIn / deflectionIn, 1)}x`
              : '--'
          }
          label="Penalty for rotating"
          note="Why orientation matters"
        />
      </Results>

      {deflectionIn > spanIn / 100 ? (
        <Verdict level="bad">
          Deflection is worse than 1% of the span. A frame this flexible will
          change your mechanism geometry every time the robot is hit. Increase
          the depth in the load direction before you consider a stiffer
          material.
        </Verdict>
      ) : deflectionIn > spanIn / 400 ? (
        <Verdict level="warn">
          Noticeable flex. It may be acceptable for a bumper or a non-critical
          bracket, but not for anything that has to stay aligned, such as slide
          rails or an odometry pod mount.
        </Verdict>
      ) : (
        <Verdict level="good">
          Stiff enough for a structural member. Now confirm the joints: bolted
          connections through a single shear plane often flex more than the beam
          you just sized.
        </Verdict>
      )}
    </CalcShell>
  );
}
