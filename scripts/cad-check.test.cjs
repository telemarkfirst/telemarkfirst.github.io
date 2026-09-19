const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Tests for the CAD file checker.
 *
 * The checker tells a student their part is wrong, so it has to be right. A
 * false failure on a correct model is worse than no checker at all: it teaches
 * the student to distrust the tool and then to ignore it. These tests build
 * files whose correct answers are known exactly, which is why the fixtures are
 * generated here rather than committed as opaque binaries.
 */

const root = path.resolve(__dirname, '..');
const cache = new Map();

function load(relative) {
  const file = path.join(root, 'src/telemark/cad', `${relative}.ts`);
  if (cache.has(file)) return cache.get(file);
  const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  cache.set(file, exports);
  const localRequire = (id) =>
    id.startsWith('./') ? load(id.slice(2)) : require(id);
  new Function('exports', 'require', 'module', transpiled)(
    exports,
    localRequire,
    {exports},
  );
  return exports;
}

const {parseStl} = load('stl');
const {parseStep} = load('step');
const {tallyHoles, checkHoleStandards, checkClosed, checkEnvelope} = load('checks');
const {rubricById, checkRubricSize, checkRubricHoles} = load('rubrics');
const {checkFile, kindFromName} = load('report');

let checks = 0;
function check(fn) {
  fn();
  checks += 1;
}

// ---------------------------------------------------------------- STL fixture

const S = 10;
const v = [
  [0, 0, 0], [S, 0, 0], [S, S, 0], [0, S, 0],
  [0, 0, S], [S, 0, S], [S, S, S], [0, S, S],
];
// Consistently wound outward, which is what makes the signed volume sum equal
// the real volume instead of a partial cancellation.
const CUBE = [
  [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
  [0, 1, 5], [0, 5, 4], [3, 7, 6], [3, 6, 2],
  [0, 4, 7], [0, 7, 3], [1, 2, 6], [1, 6, 5],
].map((t) => t.map((i) => v[i]));

function binaryStl(triangles) {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.write('generated for tests', 0);
  buffer.writeUInt32LE(triangles.length, 80);
  triangles.forEach((tri, i) => {
    let at = 84 + i * 50 + 12;
    for (const point of tri) {
      for (const n of point) {
        buffer.writeFloatLE(n, at);
        at += 4;
      }
    }
  });
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function asciiStl(triangles) {
  const body = triangles
    .map(
      (t) =>
        `facet normal 0 0 0\n outer loop\n${t
          .map((p) => `  vertex ${p[0]} ${p[1]} ${p[2]}`)
          .join('\n')}\n endloop\nendfacet`,
    )
    .join('\n');
  const text = `solid test\n${body}\nendsolid test\n`;
  const buf = Buffer.from(text, 'utf8');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

check(() => {
  const model = parseStl(binaryStl(CUBE));
  assert.equal(model.format, 'binary');
  assert.equal(model.triangleCount, 12);
  assert.ok(Math.abs(model.volume - 1000) < 1e-3, `volume was ${model.volume}`);
  assert.ok(Math.abs(model.area - 600) < 1e-3, `area was ${model.area}`);
  assert.equal(model.openEdges, 0);
  assert.equal(model.degenerateTriangles, 0);
  assert.ok(Math.abs(model.bounds.size.x - 10) < 1e-4);
});

check(() => {
  const model = parseStl(asciiStl(CUBE));
  assert.equal(model.format, 'ascii');
  assert.equal(model.triangleCount, 12);
  assert.ok(Math.abs(model.volume - 1000) < 1e-6);
  assert.equal(model.openEdges, 0);
});

check(() => {
  // Dropping a single triangle is the torn export the check exists to catch,
  // and it leaves exactly three edges with only one face against them.
  const torn = parseStl(binaryStl(CUBE.slice(0, 11)));
  assert.equal(torn.openEdges, 3);
  assert.equal(checkClosed(torn).severity, 'fail');
  assert.equal(checkClosed(parseStl(binaryStl(CUBE))).severity, 'pass');
});

check(() => {
  // A cube offset far from the origin must measure the same, since the volume
  // sum is taken to the origin and only cancels correctly if the mesh closes.
  const moved = CUBE.map((t) => t.map((p) => [p[0] + 500, p[1] - 300, p[2] + 40]));
  const model = parseStl(binaryStl(moved));
  assert.ok(Math.abs(model.volume - 1000) < 1e-2, `volume was ${model.volume}`);
  assert.equal(model.openEdges, 0);
});

// --------------------------------------------------------------- STEP fixture

function stepFile(entities, {units = 'mm', extraHeader = ''} = {}) {
  const unitLine =
    units === 'inch'
      ? "#900=CONVERSION_BASED_UNIT('INCH',#901);"
      : '#900=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));';
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('part.step','2026-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 }'));
${extraHeader}
ENDSEC;
DATA;
${entities.join('\n')}
${unitLine}
ENDSEC;
END-ISO-10303-21;
`;
}

/** A hole is a cylindrical surface plus a placement plus that placement's point. */
function hole(id, radius, [x, y, z]) {
  return [
    `#${id}=CARTESIAN_POINT('',(${x}.,${y}.,${z}.));`,
    `#${id + 1}=DIRECTION('',(0.,0.,1.));`,
    `#${id + 2}=AXIS2_PLACEMENT_3D('',#${id},#${id + 1},#${id + 1});`,
    `#${id + 3}=CYLINDRICAL_SURFACE('',#${id + 2},${radius});`,
  ];
}

function corners(width, height, thickness) {
  const pts = [];
  let id = 500;
  for (const x of [0, width]) {
    for (const y of [0, height]) {
      for (const z of [0, thickness]) {
        pts.push(`#${id}=CARTESIAN_POINT('',(${x}.,${y}.,${z}.));`);
        id += 1;
      }
    }
  }
  return pts;
}

check(() => {
  const model = parseStep(stepFile([...hole(10, 1.6, [6, 6, 0])]));
  assert.equal(model.units, 'mm');
  assert.equal(model.circles.length, 1);
  assert.ok(Math.abs(model.circles[0].diameter - 3.2) < 1e-9);
  assert.deepEqual(model.circles[0].center, {x: 6, y: 6, z: 0});
});

check(() => {
  assert.equal(parseStep(stepFile([], {units: 'inch'})).units, 'inch');
  // The word appearing in a file name must not be read as a unit.
  const named = stepFile([]).replace("'part.step'", "'inch_plate.step'");
  assert.equal(parseStep(named).units, 'mm');
});

check(() => {
  // A quoted string containing the statement delimiter is the classic way a
  // naive split corrupts a real export.
  const tricky = stepFile([
    "#5=PRODUCT('bracket; rev 2','a, b','',(#6));",
    ...hole(10, 2.15, [0, 0, 0]),
  ]);
  const model = parseStep(tricky);
  assert.equal(model.circles.length, 1);
  assert.ok(Math.abs(model.circles[0].diameter - 4.3) < 1e-9);
});

check(() => {
  assert.throws(() => parseStep('not a step file at all'), /DATA section/);
});

// ----------------------------------------------------------------- hole rules

check(() => {
  const tallies = tallyHoles([3.2, 3.2, 3.2, 3.2, 8.0]);
  const clearance = tallies.find((t) => Math.abs(t.diameter - 3.2) < 1e-9);
  assert.equal(clearance.count, 4);
  assert.equal(clearance.verdict, 'clearance');
  const bore = tallies.find((t) => Math.abs(t.diameter - 8.0) < 1e-9);
  assert.equal(bore.verdict, 'other');
  assert.equal(checkHoleStandards(tallies).severity, 'pass');
});

check(() => {
  // The mistake Module 12 exists to prevent: a hole at the screw diameter.
  for (const nominal of [3.0, 4.0, 5.0]) {
    const tallies = tallyHoles([nominal]);
    assert.equal(tallies[0].verdict, 'interference', `${nominal} should interfere`);
    const finding = checkHoleStandards(tallies);
    assert.equal(finding.severity, 'fail');
    assert.match(finding.detail, /0\.15 mm per side/);
  }
});

check(() => {
  assert.equal(tallyHoles([2.5])[0].verdict, 'tapped');
  assert.equal(tallyHoles([3.4])[0].verdict, 'clearance');
  assert.equal(tallyHoles([4.5])[0].verdict, 'clearance');
  assert.equal(tallyHoles([5.3])[0].verdict, 'clearance');
});

// -------------------------------------------------------------------- rubrics

const bounds = (x, y, z) => ({
  min: {x: 0, y: 0, z: 0},
  max: {x, y, z},
  size: {x, y, z},
});

check(() => {
  const rubric = rubricById('1.1');
  assert.equal(checkRubricSize(rubric, bounds(80, 40, 3)).severity, 'pass');
  // Orientation is not the student's mistake: the same plate modelled on a
  // different plane must still pass.
  assert.equal(checkRubricSize(rubric, bounds(3, 80, 40)).severity, 'pass');
  assert.equal(checkRubricSize(rubric, bounds(80, 40, 4)).severity, 'fail');
});

check(() => {
  const rubric = rubricById('1.1');
  const good = tallyHoles([3.2, 3.2, 3.2, 3.2, 8.0]);
  assert.equal(checkRubricHoles(rubric, good).severity, 'pass');
  const missingBore = tallyHoles([3.2, 3.2, 3.2, 3.2]);
  const finding = checkRubricHoles(rubric, missingBore);
  assert.equal(finding.severity, 'fail');
  assert.match(finding.detail, /8\.00 mm/);
});

check(() => {
  assert.equal(rubricById('nope').id, 'general');
  assert.equal(checkRubricSize(rubricById('general'), bounds(1, 2, 3)), null);
  assert.equal(checkRubricHoles(rubricById('general'), []), null);
});

// --------------------------------------------------------------- end to end

check(() => {
  assert.equal(kindFromName('plate.STL'), 'stl');
  assert.equal(kindFromName('plate.stp'), 'step');
  assert.equal(kindFromName('plate.sldprt'), null);
});

check(() => {
  const report = checkFile(binaryStl(CUBE), {
    fileName: 'cube.stl',
    rubric: rubricById('general'),
    material: '6061 aluminum',
    massBudgetGrams: null,
  });
  assert.equal(report.kind, 'stl');
  const mass = report.findings.find((f) => f.id === 'mass');
  // 1000 mm3 of 6061 is 2.7 g, which is the arithmetic a student can redo.
  assert.match(mass.detail, /2\.7 g/);
  assert.equal(report.findings.find((f) => f.id === 'closed').severity, 'pass');
  assert.ok(report.limits.length >= 2);
});

check(() => {
  const entities = [
    ...corners(80, 40, 3),
    ...hole(10, 1.6, [6, 6, 0]),
    ...hole(20, 1.6, [74, 6, 0]),
    ...hole(30, 1.6, [6, 34, 0]),
    ...hole(40, 1.6, [74, 34, 0]),
    ...hole(50, 4.0, [40, 20, 0]),
  ];
  const text = stepFile(entities);
  const buffer = Buffer.from(text, 'utf8');
  const report = checkFile(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    {
      fileName: 'plate.step',
      rubric: rubricById('1.1'),
      material: '6061 aluminum',
      massBudgetGrams: null,
    },
  );
  assert.equal(report.kind, 'step');
  assert.equal(report.findings.find((f) => f.id === 'size').severity, 'pass');
  assert.equal(report.findings.find((f) => f.id === 'rubric-holes').severity, 'pass');
  assert.equal(report.findings.find((f) => f.id === 'holes').severity, 'pass');
  assert.equal(report.findings.find((f) => f.id === 'units').severity, 'pass');
});

check(() => {
  // The same plate with 3.0 mm holes is the whole point of the exercise.
  const entities = [...corners(80, 40, 3), ...hole(10, 1.5, [6, 6, 0])];
  const buffer = Buffer.from(stepFile(entities), 'utf8');
  const report = checkFile(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    {
      fileName: 'plate.step',
      rubric: rubricById('1.1'),
      material: '6061 aluminum',
      massBudgetGrams: null,
    },
  );
  assert.equal(report.findings.find((f) => f.id === 'holes').severity, 'fail');
});

check(() => {
  assert.throws(
    () => checkFile(new ArrayBuffer(8), {
      fileName: 'part.sldprt',
      rubric: rubricById('general'),
      material: '6061 aluminum',
      massBudgetGrams: null,
    }),
    /STL and STEP/,
  );
});

check(() => {
  const big = bounds(600, 100, 10);
  assert.equal(checkEnvelope(big).severity, 'fail');
  assert.equal(checkEnvelope(bounds(400, 100, 10)).severity, 'pass');
});

console.log(`CAD checker tests passed (${checks} cases)`);
