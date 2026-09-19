const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Unit tests for the mechanical track's calculation layer.
 *
 * The calculators drive real design decisions: a wrong gear ratio or arm
 * torque figure sends a team to build something that cannot work. The math
 * lives in src/telemark/mechanicalMath.ts as pure functions so it can be
 * exercised here without a browser, mirroring how the simulator runtimes are
 * tested against a fake DOM.
 *
 * TypeScript is a devDependency, so the module is transpiled in memory rather
 * than requiring a build step.
 */

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/telemark/mechanicalMath.ts'),
  'utf8',
);

const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const moduleExports = {};
new Function('exports', 'require', 'module', transpiled)(
  moduleExports,
  require,
  {exports: moduleExports},
);

const M = moduleExports;

let checks = 0;
function near(actual, expected, tolerance, message) {
  checks += 1;
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );
}
function ok(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}

// ── Gear trains ─────────────────────────────────────────────────────────────

{
  // 60/12 = 5, 45/15 = 3, so 15:1 overall. Efficiency compounds: 0.95^2.
  const r = M.gearTrain(
    [{driving: 12, driven: 60}, {driving: 15, driven: 45}],
    6000,
    0.105,
    95,
  );
  near(r.ratio, 15, 1e-9, 'two stage reduction multiplies');
  near(r.outputRpm, 400, 1e-9, 'output speed divides by the ratio');
  near(r.totalEfficiency, 0.9025, 1e-9, 'efficiency compounds per stage');
  near(r.outputTorqueNm, 0.105 * 15 * 0.9025, 1e-9, 'torque multiplies, less losses');

  // Reductions in series multiply rather than add. 4 * 3 * 5 = 60, not 12.
  const three = M.gearTrain(
    [
      {driving: 10, driven: 40},
      {driving: 10, driven: 30},
      {driving: 10, driven: 50},
    ],
    6000,
    0.105,
    95,
  );
  near(three.ratio, 60, 1e-9, 'three stages multiply');
  near(three.totalEfficiency, 0.857375, 1e-6, 'three stages compound to ~86%');

  // An overdrive is a ratio below 1: faster output, less torque.
  const overdrive = M.gearTrain([{driving: 60, driven: 12}], 6000, 0.105, 95);
  near(overdrive.ratio, 0.2, 1e-9, 'overdrive ratio is below 1');
  ok(overdrive.outputRpm > 6000, 'overdrive spins faster than the motor');
  ok(overdrive.outputTorqueNm < 0.105, 'overdrive loses torque');

  // A malformed stage must not divide by zero or poison the ratio.
  const guarded = M.gearTrain([{driving: 0, driven: 40}], 6000, 0.105, 95);
  ok(Number.isFinite(guarded.ratio), 'zero driving teeth does not divide by zero');
  near(guarded.ratio, 1, 1e-9, 'a malformed stage is skipped');

  // Efficiency is clamped to a physical range.
  const clamped = M.gearTrain([{driving: 1, driven: 1}], 100, 1, 150);
  near(clamped.totalEfficiency, 1, 1e-9, 'efficiency above 100% is clamped');
}

// ── Motor operating point ───────────────────────────────────────────────────

{
  const motor = {
    freeSpeedRpm: 6000,
    stallTorqueNm: 0.105,
    stallCurrentA: 11,
    freeCurrentA: 0.4,
  };

  const r = M.motorOperatingPoint(motor, 20, 0.8);
  near(r.outputFreeRpm, 300, 1e-9, 'reduction divides free speed');
  near(r.outputStallTorqueNm, 2.1, 1e-9, 'reduction multiplies stall torque');
  near(r.torqueFraction, 0.8 / 2.1, 1e-9, 'load as a fraction of stall');
  near(r.loadedRpm, 300 * (1 - 0.8 / 2.1), 1e-6, 'speed falls linearly with torque');
  near(r.currentA, 0.4 + 10.6 * (0.8 / 2.1), 1e-6, 'current tracks torque linearly');
  ok(!r.overloaded, 'a load under stall torque is not overloaded');

  // Peak power sits at exactly half free speed and half stall torque.
  const halfTorque = M.motorOperatingPoint(motor, 20, 2.1 / 2);
  near(halfTorque.loadedRpm, 150, 1e-6, 'half stall torque gives half free speed');
  near(
    halfTorque.outputPowerW,
    halfTorque.peakPowerW,
    1e-6,
    'the half-and-half point is exactly peak power',
  );

  // No load means free speed and no useful power.
  const unloaded = M.motorOperatingPoint(motor, 20, 0);
  near(unloaded.loadedRpm, 300, 1e-9, 'no load runs at free speed');
  near(unloaded.outputPowerW, 0, 1e-9, 'no load does no work');
  near(unloaded.currentA, 0.4, 1e-9, 'no load draws the free current');

  // At or beyond stall the motor does not turn and draws full current.
  const stalled = M.motorOperatingPoint(motor, 20, 3.0);
  ok(stalled.overloaded, 'a load above stall torque is flagged');
  near(stalled.loadedRpm, 0, 1e-9, 'an overloaded motor does not turn');
  near(stalled.currentA, 11, 1e-9, 'an overloaded motor draws stall current');
  near(stalled.torqueFraction, 1, 1e-9, 'torque fraction is clamped at 1');

  // The plotted line must pass through both published endpoints.
  near(M.torqueAtSpeed(6000, 0.105, 0), 0.105, 1e-9, 'zero speed is stall torque');
  near(M.torqueAtSpeed(6000, 0.105, 6000), 0, 1e-9, 'free speed is zero torque');
  near(M.torqueAtSpeed(6000, 0.105, 3000), 0.0525, 1e-9, 'midpoint is half torque');
  near(M.torqueAtSpeed(0, 0.105, 100), 0, 1e-9, 'a zero free speed does not divide by zero');
}

// ── Chain and belt ──────────────────────────────────────────────────────────

{
  // #25 chain, pitch 0.25 in, 15 and 30 teeth at a 6 in center distance.
  //   2(6)/0.25 = 48
  //   (15+30)/2 = 22.5
  //   0.25 * ((30-15)/(2*pi))^2 / 6 = 0.2374
  const r = M.chainLength(0.25, 15, 30, 6, true);
  near(r.exactPitches, 70.737, 0.01, 'chain length matches the standard formula');
  near(r.orderPitches, 72, 1e-9, 'roller chain rounds up to an even link count');
  ok(r.orderPitches % 2 === 0, 'chain link count is even');
  ok(
    r.actualCenterIn > 6,
    'a longer chain than exact pushes the centers apart',
  );
  near(r.ratio, 2, 1e-9, 'ratio is driven over driving');

  // Belts are sold in whole tooth counts, odd numbers included.
  const belt = M.chainLength(2 / 25.4, 20, 40, 5, false);
  near(belt.orderPitches, Math.ceil(belt.exactPitches), 1e-9, 'belts round up by one tooth');

  // Equal pulleys give a 180 degree wrap and no correction term.
  const equal = M.chainLength(0.25, 20, 20, 6, true);
  near(equal.wrapAngleDeg, 180, 1e-9, 'equal pulleys wrap 180 degrees');
  near(equal.exactPitches, 48 + 20, 1e-9, 'equal pulleys need no correction term');

  // Wrap shrinks as the size difference grows or the centers close up.
  const tight = M.chainLength(0.25, 12, 60, 2, true);
  ok(tight.wrapAngleDeg < 180, 'unequal pulleys reduce wrap on the small one');
  ok(Number.isFinite(tight.actualCenterIn), 'a tight layout still resolves a center distance');

  // A zero center distance must not produce a division by zero.
  const degenerate = M.chainLength(0.25, 15, 30, 0, true);
  ok(Number.isFinite(degenerate.exactPitches), 'zero center distance is guarded');
}

// ── Drivetrain ──────────────────────────────────────────────────────────────

{
  const base = {
    motorCount: 4,
    freeRpm: 6000,
    stallTorqueNm: 0.105,
    stallCurrentA: 11,
    reduction: 20,
    wheelDiameterIn: 4,
    robotWeightLb: 30,
    frictionCoefficient: 1.0,
    drivenFractionPercent: 100,
  };

  const r = M.drivetrain(base);
  near(r.wheelRpm, 300, 1e-9, 'wheel speed is motor speed over the reduction');
  // 300 rpm * pi * 4 in / 12 / 60 = 5.236 ft/s
  near(r.freeSpeedFps, 5.236, 0.005, 'free speed from wheel rpm and diameter');
  near(r.tractionLbf, 30, 1e-9, 'traction is mu times weight on driven wheels');

  // 4 motors * (0.105 * 20) N-m / 0.0508 m = 165.4 N = 37.2 lbf
  near(r.motorForceLbf, 37.18, 0.05, 'motor force from wheel torque and radius');
  near(r.pushingLbf, 30, 1e-9, 'pushing force is the lower of the two limits');
  ok(!r.motorLimited, 'more motor force than traction is traction limited');

  // Traction limited means the motors run below stall, drawing less current.
  ok(r.pushCurrentA < base.motorCount * base.stallCurrentA, 'traction limited stays off stall');

  // Under-reduced: the motors become the binding limit, which is the bad case.
  const underGeared = M.drivetrain({...base, reduction: 5});
  ok(underGeared.motorLimited, 'too little reduction is motor limited');
  near(
    underGeared.pushCurrentA,
    base.motorCount * base.stallCurrentA,
    1e-6,
    'a motor limited drivetrain draws full stall current',
  );
  ok(
    underGeared.freeSpeedFps > r.freeSpeedFps,
    'less reduction trades force for speed',
  );

  // Adding weight raises traction proportionally.
  const heavy = M.drivetrain({...base, robotWeightLb: 60});
  near(heavy.tractionLbf, 60, 1e-9, 'traction scales with weight');

  // Only half the weight on powered wheels halves the traction.
  const halfDriven = M.drivetrain({...base, drivenFractionPercent: 50});
  near(halfDriven.tractionLbf, 15, 1e-9, 'traction uses only the driven weight');

  // Larger wheels are faster and weaker, exactly like less reduction.
  const bigWheels = M.drivetrain({...base, wheelDiameterIn: 8});
  ok(bigWheels.freeSpeedFps > r.freeSpeedFps, 'bigger wheels are faster');
  ok(bigWheels.motorForceLbf < r.motorForceLbf, 'bigger wheels deliver less force');
}

// ── Arm torque ──────────────────────────────────────────────────────────────

{
  const base = {
    armWeightLb: 3,
    armCgIn: 11,
    payloadWeightLb: 1.5,
    payloadIn: 20,
    angleDeg: 0,
    motorStallNm: 0.105,
    reduction: 40,
    efficiencyPercent: 80,
  };

  const r = M.armTorque(base);
  // arm: 3 lb -> 1.3608 kg * 9.80665 * 0.2794 m = 3.728 N-m
  // payload: 1.5 lb -> 0.6804 kg * 9.80665 * 0.508 m = 3.390 N-m
  near(r.worstCaseNm, 7.118, 0.01, 'worst case torque at horizontal');
  near(r.requiredNm, r.worstCaseNm, 1e-9, 'at 0 degrees required equals worst case');
  near(r.availableNm, 0.105 * 40 * 0.8, 1e-9, 'available torque after efficiency');
  ok(r.safetyFactor < 1, 'this arm cannot lift itself at horizontal');

  // The cosine term is the whole story: vertical needs no holding torque.
  const vertical = M.armTorque({...base, angleDeg: 90});
  near(vertical.requiredNm, 0, 1e-9, 'a vertical arm needs no holding torque');
  near(vertical.worstCaseNm, r.worstCaseNm, 1e-9, 'worst case is angle independent');

  const at60 = M.armTorque({...base, angleDeg: 60});
  near(at60.requiredNm, r.worstCaseNm * 0.5, 1e-6, '60 degrees is half the worst case');

  // Below horizontal is symmetric.
  const below = M.armTorque({...base, angleDeg: -45});
  const above = M.armTorque({...base, angleDeg: 45});
  near(below.requiredNm, above.requiredNm, 1e-9, 'torque is symmetric about horizontal');

  // Torque scales linearly with distance, so moving the payload in helps.
  const closer = M.armTorque({...base, payloadIn: 10});
  near(
    closer.worstCaseNm,
    3.728 + 3.39 / 2,
    0.01,
    'halving payload distance halves its moment',
  );

  // The reduction needed for a target safety factor, round tripped against
  // the exact worst case so the check is not limited by a rounded input.
  const ratio = M.requiredArmReduction(r.worstCaseNm, 0.105, 80, 2);
  near(ratio, 169.5, 0.5, 'reduction for a safety factor of 2');
  const check = M.armTorque({...base, reduction: ratio});
  near(check.safetyFactor, 2, 1e-9, 'the computed reduction achieves the target exactly');
  ok(!Number.isFinite(M.requiredArmReduction(5, 0, 80, 2)), 'a zero torque motor cannot do it');
}

// ── Linear slides ───────────────────────────────────────────────────────────

{
  const base = {
    cascading: true,
    stages: 3,
    spoolDiameterIn: 1.4,
    outputRpm: 312,
    outputTorqueNm: 2.38,
    loadWeightLb: 4,
    travelIn: 28,
    efficiencyPercent: 75,
  };

  const cascade = M.slide(base);
  const continuous = M.slide({...base, cascading: false});

  near(cascade.multiplier, 3, 1e-9, 'cascading multiplies by the stage count');
  near(continuous.multiplier, 1, 1e-9, 'continuous rigging does not multiply');

  // The central trade: cascading is 3x faster and 3x weaker.
  near(
    cascade.extendSpeedIps,
    continuous.extendSpeedIps * 3,
    1e-6,
    'cascading is three times faster with three stages',
  );
  near(
    cascade.liftForceLbf * 3,
    continuous.liftForceLbf,
    1e-6,
    'cascading divides lifting force by the stage count',
  );
  near(
    cascade.travelTimeS,
    continuous.travelTimeS / 3,
    1e-6,
    'cascading reaches full travel three times sooner',
  );

  // A bigger spool is faster and weaker, like a lower reduction.
  const bigSpool = M.slide({...base, spoolDiameterIn: 2.8});
  near(bigSpool.extendSpeedIps, cascade.extendSpeedIps * 2, 1e-6, 'double spool, double speed');
  near(bigSpool.liftForceLbf, cascade.liftForceLbf / 2, 1e-6, 'double spool, half force');

  // Safety factor is force over load.
  ok(cascade.safetyFactor > 0, 'safety factor is computed');
  const noLoad = M.slide({...base, loadWeightLb: 0});
  near(noLoad.safetyFactor, 0, 1e-9, 'a zero load reports zero rather than infinity');

  // Guard against a degenerate spool.
  const degenerate = M.slide({...base, spoolDiameterIn: 0});
  near(degenerate.travelTimeS, 0, 1e-9, 'a zero spool does not divide by zero');
  near(degenerate.liftForceLbf, 0, 1e-9, 'a zero spool produces no force');
}

// ── Wire gauge ──────────────────────────────────────────────────────────────

{
  // 10 A over a 3 ft run means 6 ft of conductor.
  const rows = M.wireRows(10, 3, 12, 3);
  const awg18 = rows.find((row) => row.awg === 18);
  near(awg18.resistance, (6.385 / 1000) * 6, 1e-9, 'round trip counts both conductors');
  near(awg18.dropV, 10 * (6.385 / 1000) * 6, 1e-9, 'drop is current times resistance');
  near(awg18.dropPercent, (awg18.dropV / 12) * 100, 1e-9, 'drop percent of system voltage');

  const pick = M.recommendedWire(rows);
  ok(pick !== undefined, 'a workable gauge exists for 10 A over 3 ft');
  ok(pick.ampacityOk && pick.dropOk, 'the recommendation satisfies both checks');
  // The recommendation must be the smallest wire that passes, not merely one
  // that passes.
  const smaller = rows.filter((row) => row.awg > pick.awg);
  ok(
    smaller.every((row) => !row.ampacityOk || !row.dropOk),
    'no smaller gauge also satisfies both checks',
  );

  // Doubling the length doubles the drop.
  const longer = M.wireRows(10, 6, 12, 3);
  near(
    longer.find((r) => r.awg === 18).dropV,
    awg18.dropV * 2,
    1e-9,
    'drop scales with run length',
  );

  // A high current run fails the ampacity check on thin wire.
  const heavy = M.wireRows(40, 2, 12, 3);
  ok(!heavy.find((r) => r.awg === 20).ampacityOk, '20 AWG cannot carry 40 A');
  ok(heavy.find((r) => r.awg === 10).ampacityOk, '10 AWG can carry 40 A');

  // A run long enough that nothing satisfies the drop budget returns nothing.
  const impossible = M.recommendedWire(M.wireRows(50, 200, 12, 1));
  ok(impossible === undefined, 'an impossible run recommends nothing');
}

// ── Beam deflection ─────────────────────────────────────────────────────────

{
  const base = {
    material: 'aluminum',
    section: 'solidRect',
    support: 'cantilever',
    widthIn: 0.5,
    heightIn: 1.5,
    wallIn: 0.0625,
    spanIn: 16,
    loadLbf: 15,
  };

  const onEdge = M.deflection(base);

  // I = b*h^3/12. On edge vs flat for a 0.5 x 1.5 bar is exactly 9:1.
  near(
    onEdge.flippedDeflectionIn / onEdge.deflectionIn,
    9,
    1e-6,
    'rotating a 0.5 by 1.5 section is exactly nine times more flexible',
  );

  // Deflection scales with the cube of the span.
  const halfSpan = M.deflection({...base, spanIn: 8});
  near(
    onEdge.deflectionIn / halfSpan.deflectionIn,
    8,
    1e-6,
    'halving the span reduces deflection eightfold',
  );

  // Deflection is linear in load.
  const doubleLoad = M.deflection({...base, loadLbf: 30});
  near(doubleLoad.deflectionIn, onEdge.deflectionIn * 2, 1e-9, 'deflection is linear in load');

  // Steel is about 2.9 times stiffer than aluminum.
  const steel = M.deflection({...base, material: 'steel'});
  near(
    onEdge.deflectionIn / steel.deflectionIn,
    200 / 68.9,
    1e-6,
    'material swap scales with the modulus ratio',
  );

  // A simply supported beam is 16 times stiffer than the same cantilever.
  const simple = M.deflection({...base, support: 'simple'});
  near(
    onEdge.deflectionIn / simple.deflectionIn,
    16,
    1e-6,
    'simple support is 48/3 times stiffer than a cantilever',
  );

  // A tube is less stiff than solid stock of the same outside dimensions, and
  // decisively better once weight is accounted for. A 1/16 in wall on a
  // 0.5 x 1.5 section keeps about 42% of the stiffness for about 31% of the
  // material, so stiffness per unit weight is roughly 1.35 times better.
  const tube = M.deflection({...base, section: 'rectTube'});
  ok(tube.deflectionIn > onEdge.deflectionIn, 'a tube is less stiff than solid');
  near(
    tube.deflectionIn / onEdge.deflectionIn,
    2.368,
    0.01,
    'a 1/16 in wall tube is about 2.4 times more flexible than solid',
  );

  const inM = M.M_PER_IN;
  const solidSpecific = M.specificStiffness('solidRect', 0.5 * inM, 1.5 * inM, 0);
  const tubeSpecific = M.specificStiffness('rectTube', 0.5 * inM, 1.5 * inM, 0.0625 * inM);
  ok(
    tubeSpecific > solidSpecific,
    'a tube buys more stiffness per unit weight than solid stock',
  );
  near(
    tubeSpecific / solidSpecific,
    1.35,
    0.03,
    'the tube advantage per unit weight is about 1.35 times',
  );
  near(
    M.sectionArea('solidRect', 2, 4, 0),
    8,
    1e-9,
    'solid area is width times height',
  );
  near(
    M.sectionArea('rectTube', 2, 4, 0.5),
    8 - 1 * 3,
    1e-9,
    'tube area subtracts the inner void',
  );

  // Known closed forms for the inertia helper.
  near(M.areaMomentOfInertia('solidRect', 2, 4, 0), (2 * 64) / 12, 1e-9, 'solid rectangle inertia');
  near(
    M.areaMomentOfInertia('roundTube', 0, 2, 1),
    (Math.PI / 4) * 1,
    1e-9,
    'a solid round section reduces to pi*r^4/4',
  );
  near(
    M.areaMomentOfInertia('rectTube', 2, 4, 0.5),
    (2 * 64 - 1 * 27) / 12,
    1e-9,
    'tube inertia subtracts the inner section',
  );
}

// ── Weight budget ───────────────────────────────────────────────────────────

{
  const rows = [
    {name: 'Drivetrain', weight: 9.5},
    {name: 'Intake', weight: 2.4},
    {name: 'Slides', weight: 4.1},
  ];
  const r = M.weightBudget(rows, 20);
  near(r.total, 16, 1e-9, 'total sums the rows');
  near(r.remaining, 4, 1e-9, 'remaining is target minus total');
  near(r.percentUsed, 80, 1e-9, 'percent used of the target');
  assert.equal(r.heaviest.name, 'Drivetrain', 'heaviest row is identified');

  const over = M.weightBudget(rows, 10);
  ok(over.remaining < 0, 'exceeding the target reports negative remaining');

  // Non-numeric rows must not poison the total.
  const dirty = M.weightBudget([{name: 'x', weight: NaN}, {name: 'y', weight: 2}], 10);
  near(dirty.total, 2, 1e-9, 'non-finite weights are ignored');
  ok(M.weightBudget([], 10).heaviest === undefined, 'an empty budget has no heaviest row');
  near(M.weightBudget(rows, 0).percentUsed, 0, 1e-9, 'a zero target does not divide by zero');
}

// ── Decision matrix ─────────────────────────────────────────────────────────

{
  const criteria = [
    {name: 'Cycle time', weight: 5},
    {name: 'Reliability', weight: 3},
  ];
  const options = [
    {name: 'A', scores: [5, 3]},
    {name: 'B', scores: [3, 5]},
  ];
  const scored = M.scoreMatrix(criteria, options);
  near(scored[0].raw, 5 * 5 + 3 * 3, 1e-9, 'weighted sum for option A');
  near(scored[1].raw, 5 * 3 + 3 * 5, 1e-9, 'weighted sum for option B');
  // Max possible is total weight times the top score of 5.
  near(scored[0].percent, (34 / ((5 + 3) * 5)) * 100, 1e-9, 'percent of the maximum');

  // Weighting is what breaks the tie: both options total 8 raw points.
  ok(scored[0].raw > scored[1].raw, 'the heavier weighted criterion decides');

  // A missing score counts as zero rather than throwing.
  const short = M.scoreMatrix(criteria, [{name: 'C', scores: [5]}]);
  near(short[0].raw, 25, 1e-9, 'a missing score contributes zero');
  near(M.scoreMatrix([], options)[0].percent, 0, 1e-9, 'no criteria gives zero percent');
}

// ── Fits ────────────────────────────────────────────────────────────────────

{
  const closeRunning = {minClearanceMm: 0.05, maxClearanceMm: 0.15};
  const r = M.holeForFit(8, closeRunning, 0);
  near(r.minHole, 8.05, 1e-9, 'minimum hole adds the minimum clearance');
  near(r.maxHole, 8.15, 1e-9, 'maximum hole adds the maximum clearance');
  near(r.nominalHole, 8.1, 1e-9, 'nominal sits between the limits');
  near(r.toleranceBand, 0.1, 1e-9, 'the band is the clearance range');

  // A printing process bias shifts both limits without changing the band.
  const printed = M.holeForFit(8, closeRunning, 0.2);
  near(printed.minHole, 8.25, 1e-9, 'process bias shifts the minimum');
  near(printed.toleranceBand, r.toleranceBand, 1e-9, 'process bias does not change the band');

  // A press fit is negative clearance, so the hole is smaller than the shaft.
  const press = M.holeForFit(8, {minClearanceMm: -0.06, maxClearanceMm: -0.02}, 0);
  ok(press.maxHole < 8, 'a press fit hole is smaller than the shaft');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

{
  near(M.clamp(5, 0, 10), 5, 1e-9, 'clamp passes values in range');
  near(M.clamp(-1, 0, 10), 0, 1e-9, 'clamp raises to the minimum');
  near(M.clamp(11, 0, 10), 10, 1e-9, 'clamp lowers to the maximum');
  near(M.clamp(NaN, 0, 10), 0, 1e-9, 'clamp turns NaN into the minimum');

  assert.equal(M.fmt(1.005, 2), '1.00', 'fmt uses fixed precision');
  assert.equal(M.fmt(Infinity), '--', 'fmt renders non-finite values as a dash');
  assert.equal(M.fmt(NaN), '--', 'fmt renders NaN as a dash');
}

console.log(`Mechanical math tests passed (${checks} assertions)`);
