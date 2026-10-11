const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const readText = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

function readGlb(relative) {
  const file = path.join(repoRoot, relative);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${relative} must be a binary glTF`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  return {bytes, json};
}

function nodeByName(json, name, file) {
  const node = json.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `${file} must contain ${name}`);
  return node;
}

function triangleCount(json) {
  let triangles = 0;
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const accessor = json.accessors[primitive.indices ?? primitive.attributes?.POSITION];
      triangles += Math.floor((accessor?.count || 0) / 3);
    }
  }
  return triangles;
}

const sourceGlb = path.join(repoRoot, 'robot-cad-sources/11115_Gluten_Free_RoverRuckus_Robot_GLB.glb');
const sourceStep = path.join(repoRoot, 'robot-cad-sources/11115_Gluten_Free_RoverRuckus_Robot_STEP.step');
assert.ok(fs.statSync(sourceGlb).size > 250 * 1024 * 1024, 'the original Rover Ruckus GLB must remain available for provenance');
assert.ok(fs.statSync(sourceStep).size > 100 * 1024 * 1024, 'the original Rover Ruckus STEP must remain available for provenance');

const fullFile = 'static/simulator/models/11115-gluten-free-rover-ruckus-telemark.glb';
const parts = {
  'static/simulator/models/parts/roverruckus-drivetrain.glb': {
    type: 'drivetrain', minimumTriangles: 250000, maximumBytes: 18 * 1024 * 1024,
  },
  'static/simulator/models/parts/roverruckus-intake.glb': {
    type: 'intake', minimumTriangles: 30000, maximumBytes: 5 * 1024 * 1024,
  },
  'static/simulator/models/parts/roverruckus-lift.glb': {
    type: 'telescoping-lift', minimumTriangles: 35000, maximumBytes: 5 * 1024 * 1024,
  },
  'static/simulator/models/parts/roverruckus-hang.glb': {
    type: 'hang', minimumTriangles: 70000, maximumBytes: 5 * 1024 * 1024,
  },
};

const full = readGlb(fullFile);
assert.ok(full.bytes.length < 28 * 1024 * 1024, 'the full Rover Ruckus robot must remain practical for browser delivery');
assert.ok(triangleCount(full.json) > 450000, 'the full Rover model must retain recognizable real CAD geometry');
assert.match(full.json.asset?.copyright || '', /11115 Gluten Free.*explicit permission/i);
assert.equal(full.json.asset?.extras?.telemarkCadSeason, '2018-19 Rover Ruckus');

for (const [file, expected] of Object.entries(parts)) {
  const glb = readGlb(file);
  assert.ok(glb.bytes.length < expected.maximumBytes, `${file} must remain practical for lesson delivery`);
  assert.ok(triangleCount(glb.json) > expected.minimumTriangles, `${file} must retain real CAD geometry`);
  for (const metadata of [glb.json.asset?.extras, glb.json.extras, glb.json.scenes[glb.json.scene || 0]?.extras]) {
    assert.equal(metadata?.telemarkSourceModel, '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb');
    assert.equal(metadata?.telemarkCadSeason, '2018-19 Rover Ruckus');
    assert.equal(metadata?.telemarkExtracted, true);
    assert.equal(metadata?.telemarkPartType, expected.type);
  }
}

for (const file of [fullFile, 'static/simulator/models/parts/roverruckus-drivetrain.glb']) {
  const {json} = readGlb(file);
  nodeByName(json, 'telemark-cad-chassis', file);
  for (const identity of ['left-front', 'left-back', 'right-front', 'right-back']) {
    const wheel = nodeByName(json, `telemark-cad-wheel-${identity}`, file);
    assert.equal(wheel.extras?.telemarkCadWheel, identity);
    assert.equal(wheel.extras?.telemarkCadContinuous, true);
    assert.match(wheel.extras?.spinAxis || '', /^[xyz]$/);
  }
}

for (const file of [fullFile, 'static/simulator/models/parts/roverruckus-intake.glb']) {
  const {json} = readGlb(file);
  nodeByName(json, 'telemark-cad-rover-intake-static', file);
  for (let stage = 1; stage <= 2; stage += 1) {
    const roller = nodeByName(json, `telemark-cad-intake-stage-${stage}`, file);
    assert.equal(roller.extras?.telemarkCadAxis, 'x');
    assert.equal(roller.extras?.telemarkCadMotion, 'spin');
  }
}

for (const file of [fullFile, 'static/simulator/models/parts/roverruckus-lift.glb']) {
  const {json} = readGlb(file);
  nodeByName(json, 'telemark-cad-rover-lift-static', file);
  let previousTravel = 0;
  for (let stage = 1; stage <= 3; stage += 1) {
    const moving = nodeByName(json, `telemark-cad-rover-lift-stage-${stage}`, file);
    assert.equal(moving.extras?.telemarkCadAxis, 'z');
    assert.equal(moving.extras?.telemarkCadMin, 0);
    assert.ok(moving.extras?.telemarkCadMax > previousTravel, 'successive lift stages must telescope farther');
    previousTravel = moving.extras.telemarkCadMax;
  }
  const carriage = nodeByName(json, 'telemark-cad-rover-lift-carriage', file);
  assert.ok(carriage.extras?.telemarkCadMax > previousTravel, 'the Rover carriage must travel farthest');
}

nodeByName(full.json, 'telemark-cad-rover-hang', fullFile);
nodeByName(readGlb('static/simulator/models/parts/roverruckus-hang.glb').json, 'telemark-cad-rover-hang', 'Rover hang part');

const prep = readText('scripts/prepare-11115-rover-ruckus.cjs');
for (const sourceNode of [
  'Hang Assembly v28 <1>',
  'Full Intake Assembly v100 <1>',
  'Feeder v52 <1>',
  'Drivetrain Assembly v80 <1>',
]) {
  assert.ok(prep.includes(sourceNode), `preparation must select the source ${sourceNode} assembly`);
}
assert.match(prep, /explicit permission/);

const runtimeContext = vm.createContext({
  window: {location: {href: 'https://telemark.example/simulator/'}},
  document: {currentScript: {src: 'https://telemark.example/simulator/cad-parts.js'}},
  URL,
  console,
});
vm.runInContext(readText('static/simulator/cad-parts.js'), runtimeContext, {filename: 'cad-parts.js'});
const catalog = runtimeContext.window.TelemarkCadParts.catalog;
assert.deepEqual(
  JSON.parse(JSON.stringify({
    drivetrain: catalog['roverruckus-drivetrain'],
    intake: catalog['roverruckus-intake'],
    lift: catalog['roverruckus-lift'],
    hang: catalog['roverruckus-hang'],
  })),
  {
    drivetrain: {file: 'roverruckus-drivetrain.glb', fit: 2.1, type: 'drivetrain', rotation: [-Math.PI / 2, 0, 0]},
    intake: {file: 'roverruckus-intake.glb', fit: 1.65, type: 'spinner', rotation: [-Math.PI / 2, 0, 0]},
    lift: {file: 'roverruckus-lift.glb', fit: 1.7, type: 'rover-lift', rotation: [-Math.PI / 2, 0, 0]},
    hang: {file: 'roverruckus-hang.glb', fit: 1.55, type: 'static', rotation: [-Math.PI / 2, 0, 0]},
  },
);

const unit81 = readText('static/simulator/unit8.1.html');
assert.match(unit81, /TelemarkCadParts\.mount\(['"]decode-intake['"]/);
assert.doesNotMatch(unit81, /TelemarkCadParts\.mount\(['"]roverruckus-intake['"]/, 'Unit 8.1 must use the simpler SFR intake');
assert.match(unit81, /cadIntake\.setPower[\s\S]*cadIntake\.update/);
const unit85 = readText('static/simulator/unit8.5.html');
assert.match(unit85, /<script\s+src=["']\.\/cad-parts\.js["']><\/script>/);
assert.match(unit85, /TelemarkCadParts\.mount\(['"]roverruckus-lift['"]/);
assert.match(unit85, /cadLift\.setProgress\s*\(\s*h\s*\)/);

const mastery = readText('static/simulator/mastery_challenge.js');
assert.match(mastery, /11115-gluten-free-rover-ruckus-telemark\.glb/);
assert.match(mastery, /FTC 11115 Gluten Free · Rover Ruckus robot/);
assert.match(mastery, /rig11115RoverLift\s*\(/);
assert.match(mastery, /animate11115RoverLift\s*\(/);

console.log('Team 11115 Gluten Free Rover Ruckus full-robot, part, animation, and lesson contracts passed.');
