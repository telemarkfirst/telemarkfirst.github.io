import React from 'react';
import * as Tools from './index';

export interface ToolEntry {
  id: string;
  name: string;
  group: string;
  /** Words a student might search for that are not in the name. */
  keywords: string;
  /** The lesson this tool belongs to, so the workbench can link back. */
  lesson: {path: string; label: string};
  render: () => React.JSX.Element;
}

/**
 * Every design tool, with the lesson it belongs to.
 *
 * One catalogue drives both the workbench rail and the lesson embeds, so a
 * tool cannot appear in one and be missing from the other.
 */
export const TOOL_CATALOG: ToolEntry[] = [
  {
    id: 'cad-check',
    name: 'CAD file check',
    group: 'Checking',
    keywords: 'cad step stl export check hole clearance size mass watertight submit',
    lesson: {path: '/mechanical/cad-practice', label: 'CAD Practice'},
    render: () => <Tools.CadChecker />,
  },
  {
    id: 'requirements',
    name: 'Requirements table',
    group: 'Deciding',
    keywords: 'requirement constraint verification owner traceability id source',
    lesson: {path: '/mechanical/module-00/requirements-and-constraints', label: 'Lesson 0.3: Writing Requirements'},
    render: () => <Tools.RequirementsTable />,
  },
  {
    id: 'combiner',
    name: 'Concept combiner',
    group: 'Deciding',
    keywords: 'morphological function combination ideate cost benefit trade',
    lesson: {path: '/mechanical/module-00/concept-generation', label: 'Lesson 0.4: Generating and Narrowing Concepts'},
    render: () => <Tools.ConceptCombiner />,
  },
  {
    id: 'arm-sim',
    name: 'Arm simulator',
    group: 'Simulation',
    keywords: 'run animate physics stall gravity counterbalance live telemetry',
    lesson: {path: '/mechanical/module-08/arms-and-pivots', label: 'Lesson 8.3: Arm Gravity Torque'},
    render: () => <Tools.ArmSimulator />,
  },
  {
    id: 'motor-curve',
    name: 'Motor operating point',
    group: 'Power transmission',
    keywords: 'stall torque free speed rpm current power motor curve',
    lesson: {path: '/mechanical/module-06/motor-curves', label: 'Lesson 6.1: Reading Motor Curves'},
    render: () => <Tools.MotorCurveExplorer />,
  },
  {
    id: 'gear-ratio',
    name: 'Gear ratio',
    group: 'Power transmission',
    keywords: 'reduction stages teeth compound gearbox efficiency',
    lesson: {path: '/mechanical/module-06/gear-ratios', label: 'Lesson 6.2: Calculating Gear Ratios'},
    render: () => <Tools.GearRatioCalculator />,
  },
  {
    id: 'chain-belt',
    name: 'Chain and belt length',
    group: 'Power transmission',
    keywords: 'sprocket pulley pitch center distance wrap timing belt links',
    lesson: {path: '/mechanical/module-06/chain-and-belt', label: 'Lesson 6.3: Sizing Chain and Belt'},
    render: () => <Tools.ChainLengthCalculator />,
  },
  {
    id: 'drivetrain',
    name: 'Drivetrain speed and force',
    group: 'Drivetrain and mechanisms',
    keywords: 'pushing traction slip wheels motor limited free speed current',
    lesson: {path: '/mechanical/module-07/speed-and-pushing-force', label: 'Lesson 7.3: Drivetrain Speed and Pushing Force'},
    render: () => <Tools.DrivetrainCalculator />,
  },
  {
    id: 'arm-torque',
    name: 'Arm gravity torque',
    group: 'Drivetrain and mechanisms',
    keywords: 'pivot payload cosine horizontal safety factor reduction lift',
    lesson: {path: '/mechanical/module-08/arms-and-pivots', label: 'Lesson 8.3: Arm Gravity Torque'},
    render: () => <Tools.ArmTorqueCalculator />,
  },
  {
    id: 'slide',
    name: 'Linear slide sizing',
    group: 'Drivetrain and mechanisms',
    keywords: 'cascade continuous spool stages extension speed rigging lift',
    lesson: {path: '/mechanical/module-08/linear-slides', label: 'Lesson 8.2: Sizing Linear Slides'},
    render: () => <Tools.SlideCalculator />,
  },
  {
    id: 'deflection',
    name: 'Beam deflection',
    group: 'Structure and hardware',
    keywords: 'stiffness bending span tube channel orientation depth aluminium',
    lesson: {path: '/mechanical/module-03/stiffness-and-deflection', label: 'Lesson 3.3: Stiffness and Deflection'},
    render: () => <Tools.DeflectionCalculator />,
  },
  {
    id: 'weight',
    name: 'Weight budget',
    group: 'Structure and hardware',
    keywords: 'mass subsystem target pounds heaviest',
    lesson: {path: '/mechanical/module-03/weight-budget', label: 'Lesson 3.4: Holding a Weight Budget'},
    render: () => <Tools.WeightBudgetCalculator />,
  },
  {
    id: 'tap-drill',
    name: 'Tap drill and clearance',
    group: 'Structure and hardware',
    keywords: 'thread m3 m4 m5 screw hole size tapping clearance',
    lesson: {path: '/mechanical/module-02/tapping-and-threads', label: 'Lesson 2.4: Tapping and Tap Drills'},
    render: () => <Tools.TapDrillReference />,
  },
  {
    id: 'fit',
    name: 'Shaft and hole fit',
    group: 'Structure and hardware',
    keywords: 'clearance press interference bearing tolerance printed reamed',
    lesson: {path: '/mechanical/module-11/tolerances-and-fits', label: 'Lesson 11.1: Tolerances and Fits'},
    render: () => <Tools.FitCalculator />,
  },
  {
    id: 'wire-gauge',
    name: 'Wire gauge and voltage drop',
    group: 'Electrical and decisions',
    keywords: 'awg current amps resistance run length battery volts',
    lesson: {path: '/mechanical/module-09/wire-gauge-and-current', label: 'Lesson 9.2: Wire Gauge and Voltage Drop'},
    render: () => <Tools.WireGaugeCalculator />,
  },
  {
    id: 'decision-matrix',
    name: 'Weighted decision matrix',
    group: 'Deciding',
    keywords: 'criteria weights score compare concepts choose design',
    lesson: {path: '/mechanical/module-01/decision-matrices', label: 'Lesson 1.4: Weighted Decision Matrices'},
    render: () => <Tools.DecisionMatrix />,
  },
];

export const TOOL_GROUPS = [...new Set(TOOL_CATALOG.map((t) => t.group))];
