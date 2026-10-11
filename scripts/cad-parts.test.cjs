const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ThreeCore = require('three');

const repoRoot = path.resolve(__dirname, '..');
const partRoot = path.join(repoRoot, 'static/simulator/models/parts');

const PARTS = Object.freeze({
  'centerstage-drivetrain.glb': {type: 'drivetrain', source: '2024-centerstage-manning-telemark.glb', runtime: 'drivetrain'},
  'centerstage-intake.glb': {type: 'intake', source: '2024-centerstage-manning-telemark.glb', runtime: 'hinge'},
  'decode-drivetrain.glb': {type: 'drivetrain', source: '30450-decode-robot-telemark.glb', runtime: 'drivetrain'},
  'decode-flywheel.glb': {type: 'flywheel', source: '30450-decode-robot-telemark.glb', runtime: 'spinner'},
  'decode-intake.glb': {type: 'intake', source: '30450-decode-robot-telemark.glb', runtime: 'spinner'},
  'decode-transfer.glb': {type: 'transfer', source: '30450-decode-robot-telemark.glb', runtime: 'spinner'},
  'decode-trigger.glb': {type: 'trigger', source: '30450-decode-robot-telemark.glb', runtime: 'hinge'},
  'inputoutput-arm.glb': {type: 'arm', source: 'ftc17438-inputoutput-telemark.glb', runtime: 'arm'},
  'inputoutput-drivetrain.glb': {type: 'drivetrain', source: 'ftc17438-inputoutput-telemark.glb', runtime: 'drivetrain'},
  'manning-2025-drivetrain.glb': {type: 'drivetrain', source: '2025-ftc-robot-manning-telemark.glb', runtime: 'drivetrain'},
  'quixilver-arm.glb': {type: 'arm', source: 'Quilxilver-full-robot-8404.glb', runtime: 'arm'},
  'quixilver-claw.glb': {type: 'claw', source: 'Quilxilver-full-robot-8404.glb', runtime: 'claw'},
  'quixilver-drivetrain.glb': {type: 'drivetrain', source: 'quixilver-8404-itd-telemark.glb', runtime: 'drivetrain'},
  'quixilver-slide.glb': {type: 'linear-slide', source: 'Quilxilver-full-robot-8404.glb', runtime: 'slide'},
  'roverruckus-drivetrain.glb': {type: 'drivetrain', source: '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb', runtime: 'drivetrain'},
  'roverruckus-hang.glb': {type: 'hang', source: '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb', runtime: 'static'},
  'roverruckus-intake.glb': {type: 'intake', source: '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb', runtime: 'spinner'},
  'roverruckus-lift.glb': {type: 'telescoping-lift', source: '11115_Gluten_Free_RoverRuckus_Robot_GLB.glb', runtime: 'rover-lift'},
  'skystone-drivetrain.glb': {type: 'drivetrain', source: '11115-gluten-free-skystone-telemark.glb', runtime: 'drivetrain'},
  'skystone-lift.glb': {type: 'lift', source: '11115-gluten-free-skystone-telemark.glb', runtime: 'skystone-lift'},
});

function readText(relativeFile) {
  return fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
}

function readGlb(fileName) {
  const file = path.join(partRoot, fileName);
  const bytes = fs.readFileSync(file);
  assert.ok(bytes.length >= 28, `${fileName} must contain a complete GLB header`);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${fileName} must use the GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${fileName} must be GLB version 2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${fileName} must declare its complete byte length`);

  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${fileName} must begin with a JSON chunk`);
  const jsonEnd = 20 + jsonLength;
  assert.ok(jsonLength > 0 && jsonEnd + 8 <= bytes.length, `${fileName} must contain JSON and BIN chunks`);
  const json = JSON.parse(bytes.subarray(20, jsonEnd).toString().replace(/[\u0000 ]+$/, ''));
  assert.equal(bytes.readUInt32LE(jsonEnd + 4), 0x004e4942, `${fileName} must contain a BIN chunk`);
  const binLength = bytes.readUInt32LE(jsonEnd);
  assert.ok(jsonEnd + 8 + binLength <= bytes.length, `${fileName} BIN chunk must stay inside the file`);
  return {bytes, json};
}

function nodeByName(json, name, fileName) {
  const node = (json.nodes || []).find((candidate) => candidate.name === name);
  assert.ok(node, `${fileName} must expose ${name}`);
  return node;
}

function assertMotion(node, expected, label) {
  assert.equal(node.extras?.telemarkCadAxis, expected.axis, `${label} must move on its physical axis`);
  assert.equal(node.extras?.telemarkCadMin, expected.min, `${label} must retain its lower mechanical limit`);
  assert.equal(node.extras?.telemarkCadMax, expected.max, `${label} must retain its upper mechanical limit`);
}

function approximately(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}; expected ${expected}, got ${actual}`);
}

const actualFiles = fs.readdirSync(partRoot).filter((name) => name.endsWith('.glb')).sort();
const expectedFiles = Object.keys(PARTS).sort();
assert.deepEqual(actualFiles, expectedFiles, `the generated CAD parts directory must contain exactly the catalogued ${expectedFiles.length} GLBs`);

const glbs = new Map();
for (const fileName of expectedFiles) {
  const glb = readGlb(fileName);
  glbs.set(fileName, glb);
  const expected = PARTS[fileName];
  const scene = glb.json.scenes?.[glb.json.scene || 0];
  assert.equal(glb.json.asset?.version, '2.0', `${fileName} must identify as glTF 2.0`);
  assert.ok(scene && scene.nodes?.length, `${fileName} must contain a non-empty default scene`);
  assert.ok(glb.json.meshes?.length, `${fileName} must retain real CAD meshes`);
  assert.ok(glb.json.accessors?.some((accessor) => accessor.count > 0), `${fileName} must retain non-empty CAD geometry`);
  for (const metadata of [glb.json.asset?.extras, glb.json.extras, scene.extras]) {
    assert.equal(metadata?.telemarkExtracted, true, `${fileName} must be marked as an extracted part`);
    assert.equal(metadata?.telemarkPartType, expected.type, `${fileName} must identify its part type`);
    assert.equal(metadata?.telemarkSourceModel, expected.source, `${fileName} must retain source-model provenance`);
  }
  for (const rootIndex of scene.nodes) {
    assert.equal(
      glb.json.nodes[rootIndex]?.extras?.telemarkPartType,
      expected.type,
      `${fileName} scene roots must retain their part type`,
    );
  }
}

const wheelNames = ['left-front', 'left-back', 'right-front', 'right-back'];
for (const fileName of expectedFiles.filter((name) => PARTS[name].type === 'drivetrain')) {
  const {json} = glbs.get(fileName);
  nodeByName(json, 'telemark-cad-chassis', fileName);
  for (const wheelName of wheelNames) {
    const nodeName = `telemark-cad-wheel-${wheelName}`;
    const wheel = nodeByName(json, nodeName, fileName);
    const recordedIdentity = wheel.extras?.telemarkCadWheel || wheel.extras?.telemarkCadGroup;
    assert.ok(
      recordedIdentity === wheelName || recordedIdentity === nodeName,
      `${fileName} must preserve its ${wheelName} identity`,
    );
    assert.equal(wheel.extras?.telemarkCadAxis, 'auto', `${fileName} ${wheelName} must use its recorded axle`);
    assert.equal(wheel.extras?.telemarkCadContinuous, true, `${fileName} ${wheelName} must rotate continuously`);
    assert.match(wheel.extras?.spinAxis || '', /^[xz]$/, `${fileName} ${wheelName} must expose a valid spin axis`);
  }
}

const decodeIntake = glbs.get('decode-intake.glb').json;
const intakePlate = nodeByName(decodeIntake, 'telemark-cad-intake-plate', 'decode-intake.glb');
assert.equal(intakePlate.extras?.telemarkCadRole, 'intake-mount');
assert.equal(intakePlate.extras?.spinAxis, undefined, 'the intake plate must remain fixed');
for (let stage = 1; stage <= 3; stage += 1) {
  const roller = nodeByName(decodeIntake, `telemark-cad-intake-stage-${stage}`, 'decode-intake.glb');
  assert.equal(roller.extras?.telemarkCadAxis, 'x');
  assert.equal(roller.extras?.telemarkCadContinuous, true);
}
const transfer = nodeByName(glbs.get('decode-transfer.glb').json, 'telemark-cad-transfer', 'decode-transfer.glb');
assert.equal(transfer.extras?.telemarkCadAxis, 'z');
assert.equal(transfer.extras?.telemarkCadContinuous, true);
const flywheel = nodeByName(glbs.get('decode-flywheel.glb').json, 'telemark-cad-flywheel', 'decode-flywheel.glb');
assert.equal(flywheel.extras?.telemarkCadAxis, 'x');
assert.equal(flywheel.extras?.telemarkCadContinuous, true);
assertMotion(
  nodeByName(glbs.get('decode-trigger.glb').json, 'telemark-cad-trigger', 'decode-trigger.glb'),
  {axis: 'x', min: 0, max: 0.85},
  'DECODE trigger',
);

const claw = glbs.get('quixilver-claw.glb').json;
nodeByName(claw, 'telemark-cad-claw-static', 'quixilver-claw.glb');
const leftClaw = nodeByName(claw, 'telemark-cad-claw-left', 'quixilver-claw.glb');
const rightClaw = nodeByName(claw, 'telemark-cad-claw-right', 'quixilver-claw.glb');
assertMotion(leftClaw, {axis: 'x', min: 0, max: 0.42}, 'Quixilver left claw finger');
assertMotion(rightClaw, {axis: 'x', min: -0.42, max: 0}, 'Quixilver right claw finger');
assert.equal(leftClaw.extras.telemarkCadOpen, 0.42);
assert.equal(rightClaw.extras.telemarkCadOpen, -0.42);
assert.equal(leftClaw.extras.telemarkCadClosed, 0);
assert.equal(rightClaw.extras.telemarkCadClosed, 0);
assert.deepEqual(leftClaw.extras.telemarkCadPivot, rightClaw.extras.telemarkCadPivot, 'claw fingers must share a physical pivot');
assert.equal(
  Math.sign(leftClaw.extras.telemarkCadClosed - leftClaw.extras.telemarkCadOpen),
  -Math.sign(rightClaw.extras.telemarkCadClosed - rightClaw.extras.telemarkCadOpen),
  'claw fingers must close in opposite directions',
);

const quixilverArm = nodeByName(glbs.get('quixilver-arm.glb').json, 'telemark-cad-arm', 'quixilver-arm.glb');
assertMotion(quixilverArm, {axis: 'z', min: -0.65, max: 0.65}, 'Quixilver arm');
assert.equal(quixilverArm.extras.telemarkCadPivot.length, 3, 'Quixilver arm must retain its measured pivot');
const inputOutputArm = nodeByName(glbs.get('inputoutput-arm.glb').json, 'telemark-cad-mechanism', 'inputoutput-arm.glb');
assertMotion(inputOutputArm, {axis: 'x', min: -0.65, max: 0}, 'Input/Output arm');
assert.equal(inputOutputArm.extras.telemarkCadPivot.length, 3, 'Input/Output arm must retain its measured pivot');

const slideGlb = glbs.get('quixilver-slide.glb');
const slide = nodeByName(slideGlb.json, 'telemark-cad-mechanism', 'quixilver-slide.glb');
assertMotion(slide, {axis: 'x', min: 0, max: 0.29}, 'Quixilver scissor slide');
assert.equal(slide.extras.telemarkCadMotion, 'scissor', 'Quixilver slide must select articulated X-linkage motion');
for (const assemblyName of [
  'Horizontal Slides Linkage Assembly Mirrored <1>',
  'Horizontal Slides Linkage Assembly <1>',
]) {
  const assembly = nodeByName(slideGlb.json, assemblyName, 'quixilver-slide.glb');
  assert.ok(assembly.children?.length >= 20, `${assemblyName} must retain separately movable CAD links and joints`);
}
assert.ok(slideGlb.bytes.length < 8 * 1024 * 1024, 'Quixilver slide must remain practical for lesson delivery');
const extractorSource = readText('scripts/extract-cad-parts.cjs');
assert.match(extractorSource, /Horizontal Slides Linkage Assembly Mirrored <1>/, 'slide extraction must use the mirrored linkage');
assert.match(extractorSource, /Horizontal Slides Linkage Assembly <1>/, 'slide extraction must use the paired linkage');

const lift = glbs.get('skystone-lift.glb').json;
for (const name of ['lower-low', 'lower-high']) {
  assertMotion(nodeByName(lift, `telemark-cad-lift-${name}`, 'skystone-lift.glb'), {axis: 'y', min: -0.998, max: 0}, `SKYSTONE ${name}`);
}
for (const name of ['upper-low', 'upper-high']) {
  assertMotion(nodeByName(lift, `telemark-cad-lift-${name}`, 'skystone-lift.glb'), {axis: 'y', min: 0, max: 0.998}, `SKYSTONE ${name}`);
}
for (const name of ['middle', 'carriage']) {
  assertMotion(nodeByName(lift, `telemark-cad-lift-${name}`, 'skystone-lift.glb'), {axis: 'xz', min: 0, max: 1}, `SKYSTONE ${name}`);
}
nodeByName(lift, 'telemark-cad-lift-base', 'skystone-lift.glb');

class FakeGLTFLoader {
  static failedFile = null;

  load(url, onLoad, _onProgress, onError) {
    const fileName = path.basename(new URL(url).pathname);
    if (FakeGLTFLoader.failedFile === fileName) {
      onError(new Error(`intentional ${fileName} load failure`));
      return;
    }
    onLoad({scene: fakeTemplate(fileName)});
  }
}

const THREE = {...ThreeCore, GLTFLoader: FakeGLTFLoader};

function fakePart(name, userData = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.userData = {...userData};
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()));
  return group;
}

function fakeScissorAssembly(name, y) {
  const assembly = new THREE.Group();
  assembly.name = name;
  assembly.position.y = y;
  for (let index = 0; index < 4; index += 1) {
    const link = new THREE.Group();
    link.name = `occurrence_of_Intake_Pivot_Linkage_(Scissor)_${index}`;
    link.position.set(index * 0.1, 0, index % 2 ? -0.18 : 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.025), new THREE.MeshBasicMaterial());
    bar.position.set(0.09, 0, index % 2 ? 0.08 : -0.08);
    link.add(bar);
    assembly.add(link);
  }
  for (let index = 0; index < 4; index += 1) {
    const joint = fakePart(`REX_Shaft_Collar_${index}`);
    joint.position.set(index * 0.1, 0, index % 2 ? -0.18 : 0);
    assembly.add(joint);
  }
  const motor = fakePart('Axon_MAX_step');
  motor.position.set(0, 0, -0.09);
  assembly.add(motor);
  return assembly;
}

function fakeTemplate(fileName) {
  const model = new THREE.Group();
  if (fileName === 'quixilver-claw.glb') {
    model.add(fakePart('telemark-cad-claw-static'));
    model.add(fakePart('telemark-cad-claw-left', {
      telemarkCadAxis: 'x', telemarkCadMin: 0, telemarkCadMax: 0.42,
      telemarkCadOpen: 0.42, telemarkCadClosed: 0, telemarkCadPivot: [0, 0, 0],
    }));
    model.add(fakePart('telemark-cad-claw-right', {
      telemarkCadAxis: 'x', telemarkCadMin: -0.42, telemarkCadMax: 0,
      telemarkCadOpen: -0.42, telemarkCadClosed: 0, telemarkCadPivot: [0, 0, 0],
    }));
  } else if (fileName === 'quixilver-slide.glb') {
    const mechanism = new THREE.Group();
    mechanism.name = 'telemark-cad-mechanism';
    mechanism.userData = {
      telemarkCadAxis: 'x',
      telemarkCadMin: 0,
      telemarkCadMax: 0.29,
      telemarkCadMotion: 'scissor',
    };
    mechanism.add(fakeScissorAssembly('Horizontal_Slides_Linkage_Assembly_Mirrored_<1>', -0.1));
    mechanism.add(fakeScissorAssembly('Horizontal_Slides_Linkage_Assembly_<1>', 0.1));
    model.add(mechanism);
  } else if (fileName === 'quixilver-arm.glb') {
    model.add(fakePart('telemark-cad-arm', {telemarkCadAxis: 'z', telemarkCadMin: -0.65, telemarkCadMax: 0.65}));
  } else if (fileName === 'decode-intake.glb') {
    model.add(fakePart('telemark-cad-intake-plate', {
      telemarkDecodeMechanism: 'intake', telemarkCadRole: 'intake-mount',
    }));
    for (let stage = 1; stage <= 3; stage += 1) {
      model.add(fakePart(`telemark-cad-intake-stage-${stage}`, {
        telemarkDecodeMechanism: 'intake', intakeStage: stage, spinAxis: 'x',
      }));
    }
  } else if (fileName === 'skystone-lift.glb') {
    for (const name of ['lower-low', 'lower-high', 'upper-low', 'upper-high', 'middle', 'base', 'carriage']) {
      model.add(fakePart(`telemark-cad-lift-${name}`));
    }
  } else if (fileName === 'roverruckus-lift.glb') {
    for (let stage = 1; stage <= 3; stage += 1) {
      model.add(fakePart(`telemark-cad-rover-lift-stage-${stage}`, {
        telemarkCadAxis: 'z', telemarkCadMin: 0, telemarkCadMax: stage * 0.085,
      }));
    }
    model.add(fakePart('telemark-cad-rover-lift-carriage', {
      telemarkCadAxis: 'z', telemarkCadMin: 0, telemarkCadMax: 0.34,
    }));
  } else {
    model.add(fakePart('telemark-cad-transfer', {telemarkCadAxis: 'z'}));
  }
  return model;
}

function loadRuntime() {
  const window = {THREE, location: {href: 'https://telemark.example/simulator/'}};
  const context = vm.createContext({
    window,
    document: {currentScript: {src: 'https://telemark.example/simulator/cad-parts.js'}},
    URL,
    console,
  });
  vm.runInContext(readText('static/simulator/cad-parts.js'), context, {filename: 'cad-parts.js'});
  return window.TelemarkCadParts;
}

async function testRuntime() {
  const runtime = loadRuntime();
  assert.ok(runtime && Object.isFrozen(runtime), 'CAD runtime must expose a frozen TelemarkCadParts API');
  assert.equal(typeof runtime.mount, 'function');
  assert.equal(typeof runtime.preload, 'function');
  assert.equal(typeof runtime.dock, 'function');
  assert.ok(Object.isFrozen(runtime.catalog), 'CAD runtime catalog must be immutable');

  const catalogFiles = Object.values(runtime.catalog).map((entry) => entry.file).sort();
  assert.deepEqual(catalogFiles, expectedFiles, 'runtime catalog must address every extracted part exactly once');
  for (const [key, entry] of Object.entries(runtime.catalog)) {
    assert.equal(PARTS[entry.file]?.runtime, entry.type, `${key} must use the correct rig type`);
    assert.ok(Number.isFinite(entry.fit) && entry.fit > 0, `${key} must define a positive normalization fit`);
  }

  const clawParent = new THREE.Group();
  const clawFallback = new THREE.Group();
  const clawRig = await runtime.mount('quixilver-claw', {THREE, parent: clawParent, fallback: clawFallback});
  assert.equal(clawFallback.visible, false, 'procedural claw must stay suppressed when the CAD rig mounts');
  assert.ok(clawRig.getAnchor('mount'), 'claw rigs must expose a semantic mount anchor');
  assert.equal(typeof clawRig.setFingerProgress, 'function', 'claw rig must support independent finger commands');
  clawRig.setFingerProgress(0.25, 0.75);
  approximately(clawRig.model.getObjectByName('telemark-cad-claw-left-physical-pivot').rotation.x, 0.315, 'left claw must close from its positive open limit');
  approximately(clawRig.model.getObjectByName('telemark-cad-claw-right-physical-pivot').rotation.x, -0.105, 'right claw must close from its negative open limit');
  clawRig.setFingerProgress(-1, 2);
  approximately(clawRig.model.getObjectByName('telemark-cad-claw-left-physical-pivot').rotation.x, 0.42, 'left claw command must clamp open');
  approximately(clawRig.model.getObjectByName('telemark-cad-claw-right-physical-pivot').rotation.x, 0, 'right claw command must clamp closed');

  const slideRig = await runtime.mount('quixilver-slide', {THREE, parent: new THREE.Group()});
  assert.equal(slideRig._articulation, 'scissor', 'Quixilver slide must use the articulated scissor controller');
  const slideMechanism = slideRig.model.getObjectByName('telemark-cad-mechanism');
  const mechanismRest = slideMechanism.position.clone();
  const slideCarriage = slideRig.model.getObjectByName('telemark-cad-slide-carriage');
  const carriageRestX = slideCarriage.position.x;
  const movingJoint = slideRig.model.getObjectByName('REX_Shaft_Collar_3-scissor-joint');
  const jointRestX = movingJoint.position.x;
  const movingLink = slideRig.model.getObjectByName('occurrence_of_Intake_Pivot_Linkage_(Scissor)_3-scissor-pivot');
  slideRig.setProgress(0.5);
  approximately(slideMechanism.position.distanceTo(mechanismRest), 0, 'scissor base must stay fixed instead of translating the whole assembly');
  approximately(slideCarriage.position.x, carriageRestX + 0.145, 'scissor carriage must move through half its measured extension');
  assert.ok(movingJoint.position.x > jointRestX, 'scissor joints must spread apart as the mechanism extends');
  assert.ok(Math.abs(movingLink.rotation.y) > 0.01, 'real CAD linkage bars must rotate as the X mechanism opens');
  slideRig.setProgress(4);
  approximately(slideCarriage.position.x, carriageRestX + 0.29, 'scissor progress must clamp at its safe mechanical limit');

  const intakeRig = await runtime.mount('decode-intake', {THREE, parent: new THREE.Group()});
  const intakePlate = intakeRig.model.getObjectByName('telemark-cad-intake-plate');
  const plateRotation = intakePlate.rotation.clone();
  intakeRig.setPower(1);
  intakeRig.update(0.05);
  for (let stage = 1; stage <= 3; stage += 1) {
    approximately(
      intakeRig.model.getObjectByName(`telemark-cad-intake-stage-${stage}-physical-pivot`).rotation.x,
      -0.45,
      `positive intake power must rotate DECODE roller stage ${stage}`,
    );
  }
  assert.equal(intakeRig.model.getObjectByName('telemark-cad-intake-plate-physical-pivot'), undefined, 'the intake floor must not become an animated pivot');
  assert.ok(intakePlate.rotation.equals(plateRotation), 'the intake floor must remain fixed while all rollers spin');

  const armRig = await runtime.mount('quixilver-arm', {THREE, parent: new THREE.Group()});
  armRig.setAngle(4);
  approximately(armRig.model.getObjectByName('telemark-cad-arm-physical-pivot').rotation.z, 0.65, 'arm angle must clamp at its upper stop');
  armRig.setAngle(-4);
  approximately(armRig.model.getObjectByName('telemark-cad-arm-physical-pivot').rotation.z, -0.65, 'arm angle must clamp at its lower stop');
  assert.ok(armRig.getAnchor('tool_mount'), 'arm rigs must expose a moving tool mount');
  assert.equal(runtime.dock(armRig, 'tool_mount', clawRig, 'mount'), true, 'CAD parts must dock by semantic anchors');
  const armMount = armRig.getAnchor('tool_mount').getWorldPosition(new THREE.Vector3());
  const clawMount = clawRig.getAnchor('mount').getWorldPosition(new THREE.Vector3());
  approximately(armMount.distanceTo(clawMount), 0, 'docking must align the child mount to the moving arm tool point');
  armRig.setAngle(0.3);
  const movedArmMount = armRig.getAnchor('tool_mount').getWorldPosition(new THREE.Vector3());
  const movedClawMount = clawRig.getAnchor('mount').getWorldPosition(new THREE.Vector3());
  approximately(movedArmMount.distanceTo(movedClawMount), 0, 'a docked claw must follow bounded arm motion without drifting');

  const liftRig = await runtime.mount('skystone-lift', {THREE, parent: new THREE.Group()});
  liftRig.setProgress(1);
  approximately(liftRig.model.getObjectByName('telemark-cad-lift-lower-low-physical-pivot').rotation.y, -1, 'DR4B lower links must rotate toward the deployed pose');
  approximately(liftRig.model.getObjectByName('telemark-cad-lift-upper-low-physical-pivot').rotation.y, 1, 'DR4B upper links must counter-rotate');
  const expectedMiddleX = -0.2 + 0.441 * Math.cos(1.32) - 0.2195;
  const expectedMiddleZ = 0.2685 + 0.441 * Math.sin(1.32) - 0.408;
  const middleTravel = liftRig.model.getObjectByName('telemark-cad-lift-middle-bounded-travel');
  approximately(middleTravel.position.x, expectedMiddleX, 'DR4B middle stage must follow linkage X geometry');
  approximately(middleTravel.position.z, expectedMiddleZ, 'DR4B middle stage must follow linkage Z geometry');

  const roverLiftRig = await runtime.mount('roverruckus-lift', {THREE, parent: new THREE.Group()});
  assert.equal(roverLiftRig._articulation, 'telescoping', 'Rover Ruckus lift must use independent telescoping stages');
  const roverStageOne = roverLiftRig.model.getObjectByName('telemark-cad-rover-lift-stage-1-bounded-travel');
  const roverStageThree = roverLiftRig.model.getObjectByName('telemark-cad-rover-lift-stage-3-bounded-travel');
  const roverCarriage = roverLiftRig.model.getObjectByName('telemark-cad-rover-lift-carriage-bounded-travel');
  roverLiftRig.setProgress(0.5);
  approximately(roverStageOne.position.z, 0.0425, 'Rover first stage must extend to half its own travel');
  approximately(roverStageThree.position.z, 0.1275, 'Rover third stage must extend farther than its preceding stages');
  approximately(roverCarriage.position.z, 0.17, 'Rover carriage must travel farthest at half extension');
  roverLiftRig.setProgress(3);
  approximately(roverCarriage.position.z, 0.34, 'Rover lift progress must clamp at its mechanical limit');
  assert.ok(roverLiftRig.getAnchor('carriage'), 'Rover lift must expose a semantic moving carriage anchor');

  const failedParent = new THREE.Group();
  const failedFallback = new THREE.Group();
  failedFallback.visible = false;
  FakeGLTFLoader.failedFile = 'decode-transfer.glb';
  let reportedError = null;
  await assert.rejects(
    runtime.mount('decode-transfer', {
      THREE,
      parent: failedParent,
      fallback: failedFallback,
      onError(error) { reportedError = error; },
    }),
    /intentional decode-transfer\.glb load failure/,
  );
  assert.ok(reportedError, 'CAD loader failures must be reported to the caller');
  assert.equal(failedFallback.visible, false, 'CAD load failures must not restore the removed procedural robot');
  assert.equal(failedParent.children.length, 0, 'failed CAD roots must be removed from the scene');
}

function assertLessonIntegration(fileName, key, controllerPattern) {
  const source = readText(`static/simulator/${fileName}`);
  assert.match(source, /<script\s+src=["']\.\/cad-parts\.js["']><\/script>/, `${fileName} must load the shared CAD runtime`);
  assert.match(source, new RegExp(`TelemarkCadParts\\.mount\\s*\\(\\s*["']${key}["']`), `${fileName} must mount ${key}`);
  assert.match(source, controllerPattern, `${fileName} must drive its CAD mechanism from lesson state`);
}

function testLessonIntegrations() {
  assertLessonIntegration('unit8.1.html', 'decode-intake', /cadIntake\.setPower[\s\S]*cadIntake\.update/);
  assertLessonIntegration('unit8.5.html', 'roverruckus-lift', /cadLift\.setProgress\s*\(\s*h\s*\)/);
  assertLessonIntegration('unit9.5.html', 'quixilver-claw', /cadClaw\.setFingerProgress\s*\(\s*leftAmount\s*,\s*rightAmount\s*\)/);
  assertLessonIntegration('unit10.4.html', 'decode-drivetrain', /cadDrivetrain\.setWheelAngles\s*\(/);
  assertLessonIntegration('unit10.5.html', 'quixilver-slide', /cadSlide\.setProgress\s*\(\s*ratio\s*\)/);
  assertLessonIntegration('unit11.1.html', 'skystone-lift', /cadLift\.setProgress\s*\(/);
  assertLessonIntegration('unit11.5.html', 'decode-intake', /cadIntake\.setPower[\s\S]*cadIntake\.update/);
  assertLessonIntegration('unit13.1.html', 'decode-intake', /cadIntake\.setPower[\s\S]*cadIntake\.update/);
  assertLessonIntegration('unit13.2.html', 'quixilver-claw', /cadClaw\.setProgress\s*\(/);
  assertLessonIntegration('unit13.3.html', 'quixilver-slide', /cadSlide\.setProgress\s*\(/);
  assertLessonIntegration('unit13.4.html', 'quixilver-arm', /cadWristArm\.setProgress\s*\(/);
  assertLessonIntegration('unit13.4.html', 'quixilver-claw', /cadClaw\.setProgress\s*\(/);
  assertLessonIntegration('unit13.5.html', 'quixilver-arm', /cadWristArm\.setAngle\s*\(/);
  assertLessonIntegration('unit13.5.html', 'quixilver-claw', /cadClaw\.setProgress\s*\(/);

  for (const fileName of ['unit13.4.html', 'unit13.5.html']) {
    const linkedAssembly = readText(`static/simulator/${fileName}`);
    assert.match(
      linkedAssembly,
      /TelemarkCadParts\.dock\([\s\S]*cadWristArm[\s\S]*["']tool_mount["'][\s\S]*cadClaw[\s\S]*["']mount["']/,
      `${fileName} must align its claw mount to the moving arm tool anchor`,
    );
  }

  const projectHtml = readText('static/simulator/unit13.project.html');
  assert.match(projectHtml, /<script\s+src=["']\.\/cad-parts\.js["']><\/script>/, 'Unit 13 project must load the shared CAD runtime');
  assert.ok(
    projectHtml.indexOf('./cad-parts.js') < projectHtml.indexOf('./unit13-project.js'),
    'Unit 13 project must load CAD support before its stage runtime',
  );
  const project = readText('static/simulator/unit13-project.js');
  assert.match(project, /lesson === 'intake'[\s\S]*TelemarkCadParts\.mount\('decode-intake'/, 'intake project stage must use the real DECODE intake');
  assert.match(project, /lesson === 'lift'[\s\S]*TelemarkCadParts\.mount\('skystone-lift'/, 'lift project stage must use the real SKYSTONE lift');
  assert.match(project, /cadIntake\.setPower[\s\S]*cadIntake\.update/, 'project intake stage must animate the real rollers');
  assert.match(project, /cadLift\.setProgress\s*\(/, 'project lift stage must animate the bounded linkage');
  assert.match(
    project,
    /fallback:\s*\[visual\.baseFallback,\s*visual\.intakeFallback\]/,
    'intake project stage must remove the procedural base with its mechanism fallback',
  );
  assert.match(
    project,
    /fallback:\s*\[visual\.baseFallback,\s*visual\.liftFallback\]/,
    'lift project stage must remove the procedural base with its mechanism fallback',
  );

  for (const unit of [7, 9, 11]) {
    const html = readText(`static/simulator/unit${unit}.mastery.html`);
    assert.match(html, /<script\s+src=["']\.\/cad-parts\.js["']><\/script>/, `unit${unit} mastery must load the shared CAD runtime`);
    assert.ok(
      html.indexOf('./cad-parts.js') < html.indexOf('./mastery_challenge.js'),
      `unit${unit} mastery must load CAD support before the mastery runtime`,
    );
  }
  const unit3Mastery = readText('static/simulator/unit3.mastery.html');
  assert.match(unit3Mastery, /<script\s+src=["']\.\/cad-parts\.js["']><\/script>/, 'Unit 3 mastery must load the shared CAD runtime');
  assert.ok(
    unit3Mastery.indexOf('./cad-parts.js') < unit3Mastery.indexOf('./mastery_challenge.js'),
    'Unit 3 mastery must load CAD support before its challenge runtime',
  );
  const mastery = readText('static/simulator/mastery_challenge.js');
  assert.match(mastery, /TelemarkCadParts\.mount\s*\(\s*["']quixilver-slide["']/, 'Unit 3 mastery must mount the isolated scissor slide');
  assert.match(mastery, /cadMechanism\.setProgress\s*\(/, 'Unit 3 mastery must open the scissor rig from lesson state');
  assert.doesNotMatch(mastery, /cadMechanism\.position\.x\s*=/, 'Unit 3 mastery must not translate the complete mechanism sideways');
  for (const key of ['inputoutput-arm', 'quixilver-claw', 'decode-intake']) {
    assert.match(mastery, new RegExp(`TelemarkCadParts\\.mount\\s*\\(\\s*["']${key}["']`), `mastery runtime must mount ${key}`);
  }
  for (const [unit, key] of [[7, 'inputoutput-drivetrain'], [9, 'quixilver-drivetrain'], [11, 'decode-drivetrain']]) {
    assert.match(mastery, new RegExp(`${unit}:\\s*["']${key}["']`), `Unit ${unit} mastery must select ${key}`);
  }
  assert.match(
    mastery,
    /TelemarkCadParts\.mount\(isolatedDrivetrainKey/,
    'mastery runtime must mount the selected isolated drivetrain',
  );
  assert.match(mastery, /cadArm\.setProgress\s*\(/, 'Unit 7 mastery must animate the isolated arm');
  assert.match(mastery, /cadClaw\.setFingerProgress\s*\(/, 'Unit 9 mastery must preserve independent isolated-claw commands');
  assert.match(mastery, /cadIntake\.setPower[\s\S]*cadIntake\.update/, 'Unit 11 mastery must animate the isolated intake');
  assert.match(mastery, /isolatedDrivetrain\.setWheelAngles\s*\(/, 'generated mastery units must animate their isolated drivetrain wheels');
  assert.match(
    mastery,
    /unit === 11 \? ["']front["'] : ["']mechanism_mount["']/,
    'Unit 11 mastery must dock its intake to the drivetrain front rather than its roof',
  );
  assert.match(
    mastery,
    /mount\(["']decode-intake["'][\s\S]*?rotation:\s*\[0,\s*0,\s*0\]/,
    'Unit 11 mastery intake must face the approaching game piece',
  );
  assert.match(mastery, /alignAccessoryToCadFront\(model, visionCameraMount/, 'Unit 14 camera must align after CAD normalization');
  assert.match(mastery, /alignAccessoryToCadFront\(model, limelightMount/, 'Unit 15 Limelight must align after CAD normalization');
}

async function main() {
  await testRuntime();
  testLessonIntegrations();
  console.log(`CAD part contracts passed for ${expectedFiles.length} isolated GLBs, runtime rigs, and lesson integrations.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
