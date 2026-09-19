const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
function loadTs(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = {exports: {}};
  cache.set(file, loaded);
  const {outputText} = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
  const localRequire = (id) => id.startsWith('.')
    ? loadTs(path.relative(root, path.resolve(path.dirname(file), `${id}.ts`)))
    : require(id);
  new Function('exports', 'require', 'module', outputText)(loaded.exports, localRequire, loaded);
  return loaded.exports;
}

const curriculum = loadTs('src/telemark/fllCurriculum.ts');
const challenges = loadTs('src/telemark/blocks/fllChallenges.ts');
const runtime = loadTs('src/telemark/blocks/fllInterpreter.ts');

assert.equal(curriculum.FLL_UNITS.length, 3);
assert.equal(curriculum.FLL_LESSONS.length, 15);
assert.equal(curriculum.FLL_LESSONS.filter((lesson) => curriculum.isFllChallenge(lesson.id)).length, 3);
assert.equal(new Set(curriculum.FLL_LESSONS.map((lesson) => lesson.id)).size, 15);

for (const unit of curriculum.FLL_UNITS) {
  const directory = path.join(root, 'blocks/fll', unit.slug);
  assert.ok(fs.existsSync(path.join(directory, '_category_.json')));
  assert.ok(fs.readdirSync(directory).some((file) => file.endsWith('overview.mdx')));
}
for (const lesson of curriculum.FLL_LESSONS) {
  const directory = path.join(root, 'blocks/fll', lesson.unitSlug);
  const source = fs.readdirSync(directory).filter((file) => file.endsWith('.mdx'))
    .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'))
    .find((text) => text.includes(`lessonId="${lesson.id}"`));
  assert.ok(source, `${lesson.id} has no FllPractice lesson`);
  assert.match(source, /<FllPractice/);
  if (!curriculum.isFllChallenge(lesson.id)) {
    assert.match(source, /## Official hardware activity/);
    assert.match(source, /## Try it in the SPIKE App/);
    assert.match(source, /<MarkComplete/);
  }
  const config = challenges.fllLessonConfig(lesson.id);
  assert.ok(config.objectives.length > 0);
}

const landing = fs.readFileSync(path.join(root, 'blocks/fll/index.mdx'), 'utf8');
assert.match(landing, /not affiliated with or endorsed by FIRST or LEGO Education/);
assert.match(landing, /does not reproduce BIOGLOW missions or official scoring/);
assert.match(landing, /final season under the current FIRST LEGO League program name/);
const references = fs.readFileSync(path.join(root, 'blocks/fll/references.mdx'), 'utf8');
for (const required of ['Competition Ready', 'Robot Game Rulebook', 'SPIKE App', 'August 29, 2026']) assert.ok(references.includes(required));

let nextId = 0;
function block(type, fields = {}, inputs = {}) {
  return {id: `fll-test-${nextId += 1}`, type, fields, inputs, next: null,
    getFieldValue(name) { return this.fields[name] ?? null; },
    getInputTargetBlock(name) { return this.inputs[name] ?? null; },
    getNextBlock() { return this.next; }};
}
function chain(...items) { items.slice(0, -1).forEach((item, index) => { item.next = items[index + 1]; }); return items[0]; }
const num = (value) => block('math_number', {NUM: String(value)});
const drive = (value) => block('fll_drive', {DIRECTION: 'FORWARD'}, {DISTANCE: num(value)});
const start = block('fll_start');
start.next = chain(
  block('fll_set_speed', {}, {SPEED: num(40)}),
  drive(90),
  block('fll_turn', {DIRECTION: 'RIGHT'}, {ANGLE: num(180)}),
  drive(90),
);
const roundTrip = runtime.runFllProgram({getTopBlocks: () => [start]});
assert.equal(roundTrip.error, null);
assert.equal(roundTrip.scene.missions.crossedLine, true);
assert.equal(roundTrip.scene.missions.atHome, true);
assert.equal(roundTrip.repeatabilityPasses, 3);
assert.ok(roundTrip.scene.elapsedSeconds > 0 && roundTrip.scene.elapsedSeconds < 150);
assert.ok(roundTrip.playback.some((frame) => frame.kind === 'drive'));
assert.ok(roundTrip.playback.some((frame) => frame.kind === 'turn'));

const lineStart = block('fll_start');
lineStart.next = block('fll_wait_line', {}, {REFLECTION: num(35)});
const lineResult = runtime.runFllProgram({getTopBlocks: () => [lineStart]});
assert.equal(lineResult.error, null);
assert.ok(lineResult.scene.reflection < 35);
assert.ok(Math.abs(lineResult.scene.xCm + 20) < 3);

const collisionStart = block('fll_start'); collisionStart.next = drive(500);
const collision = runtime.runFllProgram({getTopBlocks: () => [collisionStart]});
assert.match(collision.error, /collided/i);
assert.equal(collision.scene.collision, true);

const practice = fs.readFileSync(path.join(root, 'src/components/blocks/FllPractice.tsx'), 'utf8');
const scene = fs.readFileSync(path.join(root, 'src/components/blocks/FllRobotScene3D.tsx'), 'utf8');
assert.doesNotMatch(practice, /window\.(?:alert|confirm|prompt)\s*\(/, 'FLL practice uses in-page confirmation cards');
for (const required of ['telemark:fll:workspace:v1:', 'Download', 'Import', 'requestFullscreen', 'prefers-reduced-motion', 'fll_challenge_pass']) assert.ok(practice.includes(required));
for (const required of ['OrbitControls', 'WebGLRenderer', 'disposeObject', 'ResizeObserver', '3D practice field', 'WebGL is unavailable']) assert.ok(scene.includes(required));

const homepage = fs.readFileSync(path.join(root, 'src/pages/index.tsx'), 'utf8');
assert.match(homepage, /Learn FTC/);
assert.match(homepage, /Begin Software/);
assert.match(homepage, /Begin Mechanical/);
assert.doesNotMatch(homepage, /FLL Challenge Extension/);

console.log('FLL curriculum, runtime, 3D simulator, and optional integration checks passed');
