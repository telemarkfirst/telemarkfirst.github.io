/**
 * Pure calculation functions behind the engineering track's calculators.
 *
 * The components in src/components/mechanical are thin: they collect numbers
 * and render results. All arithmetic lives here so it can be unit tested
 * without a browser, the same way the simulator runtimes are tested without
 * one. Every function is pure and free of React and DOM dependencies.
 *
 * Units are stated on every parameter. Mixing units silently is the most
 * common failure in this kind of code, so the convention is: SI internally,
 * with explicit conversion helpers at the boundary.
 */

// ── Unit conversions ────────────────────────────────────────────────────────

export const NM_TO_IN_LB = 8.8507;
export const KGCM_TO_NM = 0.0980665;
export const RPM_TO_RAD_S = (2 * Math.PI) / 60;
export const LBF_PER_N = 0.224809;
export const N_PER_LBF = 4.44822;
export const KG_PER_LB = 0.453592;
export const M_PER_IN = 0.0254;
export const IN_PER_M = 1 / M_PER_IN;
export const MM_PER_IN = 25.4;
export const G = 9.80665;

// ── Gear ratios ─────────────────────────────────────────────────────────────

export interface GearStage {
  /** Tooth count of the gear on the motor side. */
  driving: number;
  /** Tooth count of the gear on the output side. */
  driven: number;
}

export interface GearResult {
  /** Overall reduction, expressed as ratio:1. */
  ratio: number;
  outputRpm: number;
  outputTorqueNm: number;
  /** Compounded efficiency across all stages, as a fraction. */
  totalEfficiency: number;
}

/**
 * Reductions in series multiply, and per-stage efficiency compounds with the
 * stage count. A stage with a zero or negative driving count is ignored rather
 * than producing a division by zero.
 */
export function gearTrain(
  stages: GearStage[],
  inputRpm: number,
  inputTorqueNm: number,
  stageEfficiencyPercent: number,
): GearResult {
  const ratio = stages.reduce(
    (total, stage) =>
      stage.driving > 0 ? total * (stage.driven / stage.driving) : total,
    1,
  );
  const stageEfficiency = clamp(stageEfficiencyPercent, 0, 100) / 100;
  const totalEfficiency = stageEfficiency ** stages.length;

  return {
    ratio,
    outputRpm: ratio > 0 ? inputRpm / ratio : 0,
    outputTorqueNm: inputTorqueNm * ratio * totalEfficiency,
    totalEfficiency,
  };
}

// ── Motor operating point ───────────────────────────────────────────────────

export interface MotorSpecInput {
  freeSpeedRpm: number;
  stallTorqueNm: number;
  stallCurrentA: number;
  freeCurrentA: number;
}

export interface MotorOperatingPoint {
  outputFreeRpm: number;
  outputStallTorqueNm: number;
  /** Fraction of available stall torque consumed by the load, 0 to 1. */
  torqueFraction: number;
  loadedRpm: number;
  currentA: number;
  outputPowerW: number;
  peakPowerW: number;
  overloaded: boolean;
}

/**
 * Models a brushed DC motor as a straight line between free speed at zero
 * torque and stall torque at zero speed. Peak mechanical power falls at
 * exactly half of each, giving stallTorque * freeSpeed / 4 in SI units.
 */
export function motorOperatingPoint(
  motor: MotorSpecInput,
  reduction: number,
  loadTorqueNm: number,
): MotorOperatingPoint {
  const safeReduction = reduction > 0 ? reduction : 1;
  const outputFreeRpm = motor.freeSpeedRpm / safeReduction;
  const outputStallTorqueNm = motor.stallTorqueNm * safeReduction;

  const torqueFraction =
    outputStallTorqueNm > 0
      ? clamp(loadTorqueNm / outputStallTorqueNm, 0, 1)
      : 1;
  const loadedRpm = outputFreeRpm * (1 - torqueFraction);

  return {
    outputFreeRpm,
    outputStallTorqueNm,
    torqueFraction,
    loadedRpm,
    currentA:
      motor.freeCurrentA +
      (motor.stallCurrentA - motor.freeCurrentA) * torqueFraction,
    outputPowerW: loadTorqueNm * loadedRpm * RPM_TO_RAD_S,
    peakPowerW: (outputStallTorqueNm * outputFreeRpm * RPM_TO_RAD_S) / 4,
    overloaded: loadTorqueNm >= outputStallTorqueNm,
  };
}

/** Torque available at a given output speed, for plotting the motor line. */
export function torqueAtSpeed(
  freeSpeedRpm: number,
  stallTorqueNm: number,
  rpm: number,
): number {
  if (freeSpeedRpm <= 0) return 0;
  return stallTorqueNm * (1 - clamp(rpm / freeSpeedRpm, 0, 1));
}

// ── Chain and belt ──────────────────────────────────────────────────────────

export interface ChainResult {
  /** Exact required length in pitches (links for chain, teeth for belt). */
  exactPitches: number;
  /** Length rounded up to a buyable value. */
  orderPitches: number;
  /** Center distance the rounded length actually produces, in inches. */
  actualCenterIn: number;
  /** Wrap angle on the smaller pulley, in degrees. */
  wrapAngleDeg: number;
  ratio: number;
}

/**
 * Standard two-pulley length approximation:
 *   L = 2C/p + (N1 + N2)/2 + p((N2 - N1)/(2*pi))^2 / C
 * then solved backwards for the center distance the rounded length gives.
 */
export function chainLength(
  pitchIn: number,
  teethA: number,
  teethB: number,
  centerIn: number,
  evenLinksRequired: boolean,
): ChainResult {
  const center = centerIn > 0 ? centerIn : 0.01;
  const correction = pitchIn * ((teethB - teethA) / (2 * Math.PI)) ** 2;

  const exactPitches =
    (2 * center) / pitchIn + (teethA + teethB) / 2 + correction / center;

  const orderPitches = evenLinksRequired
    ? Math.ceil(exactPitches / 2) * 2
    : Math.ceil(exactPitches);

  const k = orderPitches - (teethA + teethB) / 2;
  const discriminant = k * k - (8 * correction) / pitchIn;
  const actualCenterIn =
    (pitchIn / 4) * (k + Math.sqrt(Math.max(discriminant, 0)));

  // Wrap on the small pulley shrinks as the pulleys differ more or the
  // centers close up.
  const sine = clamp(
    ((teethB - teethA) * pitchIn) / (2 * Math.PI * center),
    -1,
    1,
  );
  const wrapAngleDeg = 180 - 2 * (Math.asin(sine) * (180 / Math.PI));

  return {
    exactPitches,
    orderPitches,
    actualCenterIn,
    wrapAngleDeg,
    ratio: teethA > 0 ? teethB / teethA : 0,
  };
}

// ── Drivetrain ──────────────────────────────────────────────────────────────

export interface DrivetrainInput {
  motorCount: number;
  freeRpm: number;
  stallTorqueNm: number;
  stallCurrentA: number;
  reduction: number;
  wheelDiameterIn: number;
  robotWeightLb: number;
  frictionCoefficient: number;
  /** Percentage of robot weight resting on powered wheels, 0 to 100. */
  drivenFractionPercent: number;
}

export interface DrivetrainResult {
  wheelRpm: number;
  freeSpeedFps: number;
  motorForceLbf: number;
  tractionLbf: number;
  pushingLbf: number;
  /** True when the motors stall before the wheels slip, which is undesirable. */
  motorLimited: boolean;
  pushCurrentA: number;
}

export function drivetrain(input: DrivetrainInput): DrivetrainResult {
  const safeReduction = input.reduction > 0 ? input.reduction : 1;
  const wheelRpm = input.freeRpm / safeReduction;
  const freeSpeedFps = (wheelRpm * Math.PI * input.wheelDiameterIn) / 12 / 60;

  const wheelRadiusM = input.wheelDiameterIn / 2 / IN_PER_M;
  const wheelTorqueNm = input.stallTorqueNm * safeReduction;
  const motorForceN =
    wheelRadiusM > 0 ? (input.motorCount * wheelTorqueNm) / wheelRadiusM : 0;
  const motorForceLbf = motorForceN * LBF_PER_N;

  const weightOnDriven =
    input.robotWeightLb * (input.drivenFractionPercent / 100);
  const tractionLbf = input.frictionCoefficient * weightOnDriven;

  const pushingLbf = Math.min(motorForceLbf, tractionLbf);
  const torqueFraction =
    motorForceLbf > 0 ? Math.min(pushingLbf / motorForceLbf, 1) : 0;

  return {
    wheelRpm,
    freeSpeedFps,
    motorForceLbf,
    tractionLbf,
    pushingLbf,
    motorLimited: motorForceLbf < tractionLbf,
    pushCurrentA: input.motorCount * input.stallCurrentA * torqueFraction,
  };
}

// ── Arm torque ──────────────────────────────────────────────────────────────

export interface ArmInput {
  armWeightLb: number;
  armCgIn: number;
  payloadWeightLb: number;
  payloadIn: number;
  angleDeg: number;
  motorStallNm: number;
  reduction: number;
  efficiencyPercent: number;
}

export interface ArmResult {
  requiredNm: number;
  worstCaseNm: number;
  availableNm: number;
  safetyFactor: number;
}

/**
 * Static gravity torque on a pivoting arm is m * g * L * cos(theta), measured
 * from horizontal, so the worst case is always horizontal where cosine is 1.
 */
export function armTorque(input: ArmInput): ArmResult {
  const cosine = Math.cos((input.angleDeg * Math.PI) / 180);

  const armMoment =
    input.armWeightLb * KG_PER_LB * G * (input.armCgIn * M_PER_IN);
  const payloadMoment =
    input.payloadWeightLb * KG_PER_LB * G * (input.payloadIn * M_PER_IN);

  const worstCaseNm = armMoment + payloadMoment;
  const availableNm =
    input.motorStallNm *
    (input.reduction > 0 ? input.reduction : 1) *
    (input.efficiencyPercent / 100);

  return {
    requiredNm: worstCaseNm * cosine,
    worstCaseNm,
    availableNm,
    safetyFactor: worstCaseNm > 0 ? availableNm / worstCaseNm : 0,
  };
}

/** Minimum reduction needed to hit a target safety factor at horizontal. */
export function requiredArmReduction(
  worstCaseNm: number,
  motorStallNm: number,
  efficiencyPercent: number,
  safetyFactor: number,
): number {
  const usable = motorStallNm * (efficiencyPercent / 100);
  if (usable <= 0) return Infinity;
  return (worstCaseNm * safetyFactor) / usable;
}

// ── Linear slides ───────────────────────────────────────────────────────────

export interface SlideInput {
  /** Cascading riggings multiply speed and divide force by the stage count. */
  cascading: boolean;
  stages: number;
  spoolDiameterIn: number;
  outputRpm: number;
  outputTorqueNm: number;
  loadWeightLb: number;
  travelIn: number;
  efficiencyPercent: number;
}

export interface SlideResult {
  multiplier: number;
  extendSpeedIps: number;
  travelTimeS: number;
  liftForceLbf: number;
  safetyFactor: number;
}

export function slide(input: SlideInput): SlideResult {
  const multiplier = input.cascading ? Math.max(input.stages, 1) : 1;

  const stringSpeedIps =
    (Math.PI * input.spoolDiameterIn * input.outputRpm) / 60;
  const extendSpeedIps = stringSpeedIps * multiplier;

  const spoolRadiusM = (input.spoolDiameterIn / 2) * M_PER_IN;
  const stringTensionN =
    spoolRadiusM > 0
      ? (input.outputTorqueNm * (input.efficiencyPercent / 100)) / spoolRadiusM
      : 0;
  const liftForceN = stringTensionN / multiplier;

  const requiredN = input.loadWeightLb * KG_PER_LB * G;

  return {
    multiplier,
    extendSpeedIps,
    travelTimeS: extendSpeedIps > 0 ? input.travelIn / extendSpeedIps : 0,
    liftForceLbf: liftForceN * LBF_PER_N,
    safetyFactor: requiredN > 0 ? liftForceN / requiredN : 0,
  };
}

// ── Wire gauge ──────────────────────────────────────────────────────────────

export interface AwgSpec {
  awg: number;
  ohmsPerKft: number;
  chassisAmps: number;
}

/** Copper resistance at room temperature, plus a chassis wiring guideline. */
export const AWG_TABLE: AwgSpec[] = [
  {awg: 10, ohmsPerKft: 0.9989, chassisAmps: 55},
  {awg: 12, ohmsPerKft: 1.588, chassisAmps: 41},
  {awg: 14, ohmsPerKft: 2.525, chassisAmps: 32},
  {awg: 16, ohmsPerKft: 4.016, chassisAmps: 22},
  {awg: 18, ohmsPerKft: 6.385, chassisAmps: 16},
  {awg: 20, ohmsPerKft: 10.15, chassisAmps: 11},
  {awg: 22, ohmsPerKft: 16.14, chassisAmps: 7},
];

export interface WireRow extends AwgSpec {
  /** Round trip resistance in ohms, counting both conductors. */
  resistance: number;
  dropV: number;
  dropPercent: number;
  ampacityOk: boolean;
  dropOk: boolean;
}

export function wireRows(
  currentA: number,
  oneWayFt: number,
  systemVolts: number,
  maxDropPercent: number,
): WireRow[] {
  return AWG_TABLE.map((entry) => {
    // Current flows out and back, so the circuit contains twice the run.
    const resistance = (entry.ohmsPerKft / 1000) * oneWayFt * 2;
    const dropV = currentA * resistance;
    const dropPercent = systemVolts > 0 ? (dropV / systemVolts) * 100 : 0;
    return {
      ...entry,
      resistance,
      dropV,
      dropPercent,
      ampacityOk: currentA <= entry.chassisAmps,
      dropOk: dropPercent <= maxDropPercent,
    };
  });
}

/** Smallest wire (highest AWG number) that satisfies both checks. */
export function recommendedWire(rows: WireRow[]): WireRow | undefined {
  return [...rows]
    .filter((row) => row.ampacityOk && row.dropOk)
    .sort((a, b) => b.awg - a.awg)[0];
}

// ── Beam deflection ─────────────────────────────────────────────────────────

export type SectionKind = 'rectTube' | 'solidRect' | 'roundTube';

/** Young's modulus in pascals for the materials FTC teams use. */
export const MODULUS_PA = {
  aluminum: 68.9e9,
  steel: 200e9,
  polycarbonate: 2.3e9,
  petg: 2.0e9,
} as const;

export type MaterialKey = keyof typeof MODULUS_PA;

/**
 * Area moment of inertia in m^4. Height is the dimension along the load and is
 * cubed, which is why beam depth dominates stiffness.
 */
export function areaMomentOfInertia(
  section: SectionKind,
  widthM: number,
  heightM: number,
  wallM: number,
): number {
  if (section === 'solidRect') {
    return (widthM * heightM ** 3) / 12;
  }
  if (section === 'rectTube') {
    const innerW = Math.max(widthM - 2 * wallM, 0);
    const innerH = Math.max(heightM - 2 * wallM, 0);
    return (widthM * heightM ** 3 - innerW * innerH ** 3) / 12;
  }
  const outerR = heightM / 2;
  const innerR = Math.max(outerR - wallM, 0);
  return (Math.PI / 4) * (outerR ** 4 - innerR ** 4);
}

/**
 * Cross sectional area in m^2, used to compare stiffness per unit weight.
 * A tube is less stiff than solid stock of the same outside dimensions, but
 * it removes material from near the neutral axis where it contributed least,
 * so it wins decisively once weight is accounted for.
 */
export function sectionArea(
  section: SectionKind,
  widthM: number,
  heightM: number,
  wallM: number,
): number {
  if (section === 'solidRect') {
    return widthM * heightM;
  }
  if (section === 'rectTube') {
    const innerW = Math.max(widthM - 2 * wallM, 0);
    const innerH = Math.max(heightM - 2 * wallM, 0);
    return widthM * heightM - innerW * innerH;
  }
  const outerR = heightM / 2;
  const innerR = Math.max(outerR - wallM, 0);
  return Math.PI * (outerR ** 2 - innerR ** 2);
}

/** Area moment of inertia divided by area: stiffness earned per unit weight. */
export function specificStiffness(
  section: SectionKind,
  widthM: number,
  heightM: number,
  wallM: number,
): number {
  const area = sectionArea(section, widthM, heightM, wallM);
  return area > 0 ? areaMomentOfInertia(section, widthM, heightM, wallM) / area : 0;
}

export interface DeflectionInput {
  material: MaterialKey;
  section: SectionKind;
  /** Cantilever loads at the free end; simple is supported both ends. */
  support: 'cantilever' | 'simple';
  widthIn: number;
  heightIn: number;
  wallIn: number;
  spanIn: number;
  loadLbf: number;
}

export interface DeflectionResult {
  inertia: number;
  deflectionIn: number;
  /** Deflection with the section rotated 90 degrees, for comparison. */
  flippedDeflectionIn: number;
  /** Span divided by deflection. Higher is stiffer. */
  spanRatio: number;
}

export function deflection(input: DeflectionInput): DeflectionResult {
  const w = input.widthIn * M_PER_IN;
  const h = input.heightIn * M_PER_IN;
  const t = input.wallIn * M_PER_IN;
  const L = input.spanIn * M_PER_IN;
  const F = input.loadLbf * N_PER_LBF;
  const E = MODULUS_PA[input.material];

  const denominator = input.support === 'cantilever' ? 3 : 48;

  const inertia = areaMomentOfInertia(input.section, w, h, t);
  const flippedInertia =
    input.section === 'roundTube'
      ? inertia
      : areaMomentOfInertia(input.section, h, w, t);

  const deflect = (I: number) =>
    E * I > 0 ? (F * L ** 3) / (denominator * E * I) / M_PER_IN : Infinity;

  const deflectionIn = deflect(inertia);

  return {
    inertia,
    deflectionIn,
    flippedDeflectionIn: deflect(flippedInertia),
    spanRatio: deflectionIn > 0 ? input.spanIn / deflectionIn : Infinity,
  };
}

// ── Weight budget ───────────────────────────────────────────────────────────

export interface BudgetRow {
  name: string;
  weight: number;
}

export interface BudgetResult {
  total: number;
  remaining: number;
  percentUsed: number;
  heaviest: BudgetRow | undefined;
}

export function weightBudget(rows: BudgetRow[], target: number): BudgetResult {
  const total = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0),
    0,
  );
  return {
    total,
    remaining: target - total,
    percentUsed: target > 0 ? (total / target) * 100 : 0,
    heaviest:
      rows.length > 0
        ? [...rows].sort((a, b) => b.weight - a.weight)[0]
        : undefined,
  };
}

// ── Decision matrix ─────────────────────────────────────────────────────────

export interface Criterion {
  name: string;
  weight: number;
}

export interface MatrixOption {
  name: string;
  scores: number[];
}

export interface ScoredOption extends MatrixOption {
  raw: number;
  percent: number;
}

export function scoreMatrix(
  criteria: Criterion[],
  options: MatrixOption[],
): ScoredOption[] {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const maxPossible = totalWeight * 5;

  return options.map((option) => {
    const raw = criteria.reduce(
      (sum, criterion, index) =>
        sum + criterion.weight * (option.scores[index] ?? 0),
      0,
    );
    return {
      ...option,
      raw,
      percent: maxPossible > 0 ? (raw / maxPossible) * 100 : 0,
    };
  });
}

// ── Fits ────────────────────────────────────────────────────────────────────

export interface FitSpec {
  minClearanceMm: number;
  maxClearanceMm: number;
}

export interface FitResult {
  minHole: number;
  maxHole: number;
  nominalHole: number;
  toleranceBand: number;
}

export function holeForFit(
  shaftMm: number,
  fit: FitSpec,
  processBiasMm: number,
): FitResult {
  const minHole = shaftMm + fit.minClearanceMm + processBiasMm;
  const maxHole = shaftMm + fit.maxClearanceMm + processBiasMm;
  return {
    minHole,
    maxHole,
    nominalHole: (minHole + maxHole) / 2,
    toleranceBand: maxHole - minHole,
  };
}

// ── Shared helpers ──────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Formats to fixed precision, returning a dash for non-finite values. */
export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}
