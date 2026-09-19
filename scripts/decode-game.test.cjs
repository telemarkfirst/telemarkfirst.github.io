const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DecodeGame = require('../static/simulator/decode-game.js');
const TelemarkJava = require('../static/simulator/telemark-java.js');

function advance(game, seconds, frame, step = 0.05) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    game.step(Math.min(step, seconds - elapsed), frame);
  }
  return game.snapshot();
}

function collectArtifact(game, artifact) {
  const robot = {x: artifact.x, z: artifact.z + 0.48, heading: 0, velocityX: 0, velocityZ: 0};
  const frame = {robot, hardware: {intake: 1, transfer: 0, flywheelVelocity: 0}, gamepad: {a: false}};
  advance(game, 4.1, frame);
  return game.snapshot();
}

function testArtifactStateMachineAndCapacity() {
  const game = DecodeGame.create({mode: 'practice'});
  game.start();
  const firstLine = game.snapshot().artifacts.filter((artifact) => artifact.state === 'FIELD').slice(0, 3);
  const snapshot = collectArtifact(game, firstLine[1]);
  assert.ok(firstLine.every((artifact) => snapshot.artifacts.find((candidate) => candidate.id === artifact.id).state === 'READY'));
  assert.equal(snapshot.controlledArtifacts, 3, 'the robot must hold no more than three artifacts');
  const ready = snapshot.artifacts.filter((artifact) => artifact.state === 'READY').sort((left, right) => left.x - right.x);
  assert.ok(ready.every((artifact) => Math.abs(artifact.z - ready[0].z) < 1e-9), 'all three stored artifacts must sit in one horizontal row');
  assert.deepEqual(ready.map((artifact, index) => index ? Number((artifact.x - ready[index - 1].x).toFixed(3)) : null).slice(1), [0.26, 0.26]);
  const fourth = game.snapshot().artifacts.find((artifact) => artifact.state === 'FIELD');
  collectArtifact(game, fourth);
  assert.equal(game.snapshot().controlledArtifacts, 3);
  assert.equal(game.snapshot().artifacts.find((artifact) => artifact.id === fourth.id).state, 'FIELD');
}

function testEveryControlledArtifactState() {
  const game = DecodeGame.create();
  const artifact = game.snapshot().artifacts[0];
  const robot = {x: artifact.x, z: artifact.z + 0.48, heading: 0};
  game.start();
  advance(game, 0.3, {robot, hardware: {intake: 1, transfer: 0}, gamepad: {}});
  assert.equal(game.snapshot().artifacts[0].state, 'INTAKE');
  advance(game, 0.8, {robot, hardware: {intake: 1, transfer: 0}, gamepad: {}});
  assert.equal(game.snapshot().artifacts[0].state, 'READY', 'all three intake stages must store the artifact without transfer power');
  game.setTriggerRestPosition(0);
  game.step(0.05, {robot, hardware: {flywheelVelocity: 1900, triggerPosition: 1}});
  assert.equal(game.snapshot().artifacts[0].state, 'FEEDING');
  assert.ok(game.snapshot().artifacts[0].y > 0.39, 'the trigger must visibly lift the staged artifact');
  game.step(0.06, {robot, hardware: {flywheelVelocity: 1900, triggerPosition: 1}});
  assert.equal(game.snapshot().artifacts[0].state, 'FLIGHT');
  advance(game, 2, {robot, hardware: {flywheelVelocity: 1900}, gamepad: {a: false}});
  assert.ok(['SCORED', 'MISSED'].includes(game.snapshot().artifacts[0].state));
}

function testReverseReturnsArtifactToField() {
  const game = DecodeGame.create();
  const artifact = game.snapshot().artifacts[0];
  game.start();
  const robot = {x: artifact.x, z: artifact.z + 0.48, heading: 0};
  advance(game, 0.3, {robot, hardware: {intake: 1}, gamepad: {}});
  assert.equal(game.snapshot().artifacts[0].state, 'INTAKE');
  advance(game, 1, {robot, hardware: {intake: -1, transfer: -1}, gamepad: {}});
  assert.equal(game.snapshot().artifacts[0].state, 'FIELD');
}

function testLaunchRisingEdge() {
  const game = DecodeGame.create();
  assert.equal(game.setArtifactState(1, 'READY', 0), true);
  assert.equal(game.setArtifactState(2, 'READY', 0), true);
  game.setTriggerRestPosition(0);
  game.start();
  const frame = {robot: {x: 0, z: 0, heading: 0}, hardware: {flywheelVelocity: 1900, triggerPosition: 1}, gamepad: {a: true}};
  game.step(0.05, {...frame, hardware: {flywheelVelocity: 1900, triggerPosition: 0}});
  assert.equal(game.snapshot().launches, 0, 'a gamepad button alone must not bypass the student-controlled trigger servo');
  game.step(0.05, frame);
  assert.equal(game.snapshot().artifacts[0].state, 'FEEDING', 'the servo must visibly push the artifact before launch');
  game.step(0.06, frame);
  assert.equal(game.snapshot().launches, 1, 'holding the trigger servo at fire for 0.10 seconds must release one artifact');
  game.step(0.05, frame);
  assert.equal(game.snapshot().launches, 1, 'holding the trigger servo at fire must release only one artifact');
  game.step(0.05, {...frame, hardware: {flywheelVelocity: 1900, triggerPosition: 0}, gamepad: {a: false}});
  game.step(0.05, frame);
  game.step(0.06, frame);
  assert.equal(game.snapshot().launches, 2, 'a second trigger-servo pulse may launch the next ready artifact');

  const shortPulse = DecodeGame.create();
  shortPulse.setArtifactState(1, 'READY', 0);
  shortPulse.setTriggerRestPosition(0);
  shortPulse.start();
  shortPulse.step(0.04, frame);
  shortPulse.step(0.02, {...frame, hardware: {flywheelVelocity: 1900, triggerPosition: 0}});
  assert.equal(shortPulse.snapshot().launches, 0, 'a pulse shorter than 0.10 seconds must not reach the flywheel');
  assert.equal(shortPulse.snapshot().artifacts[0].state, 'READY', 'a short trigger pulse must return the artifact to storage');
}

function testHardwareSequenceMovesArtifactThroughRobot() {
  const game = DecodeGame.create({mode: 'practice', practiceArtifacts: 1});
  const artifact = game.snapshot().artifacts[0];
  const robot = {x: artifact.x, z: artifact.z + 0.48, heading: 0, velocityX: 0, velocityZ: 0};
  game.start();
  advance(game, 1.1, {robot, hardware: {intake: 1, transfer: 0}});
  assert.equal(game.snapshot().artifacts.find(candidate => candidate.id === artifact.id).state, 'READY', 'the three intake stages must carry the artifact directly into the magazine');

  const transferOnly = DecodeGame.create({mode: 'practice', practiceArtifacts: 1});
  const transferArtifact = transferOnly.snapshot().artifacts[0];
  transferOnly.start();
  advance(transferOnly, 1.1, {
    robot: {x: transferArtifact.x, z: transferArtifact.z + 0.48, heading: 0},
    hardware: {intake: 0, transfer: 1},
  });
  assert.equal(transferOnly.snapshot().artifacts[0].state, 'FIELD', 'the anti-jam transfer spinner must not act like a fourth intake stage');
}

function testPickupAndArtifactPathUseRobotForward() {
  const game = DecodeGame.create({mode: 'practice', practiceArtifacts: 1});
  const spawn = game.snapshot().artifacts[0];
  const robot = {x: spawn.x, z: spawn.z + 0.48, heading: 0, velocityX: 0, velocityZ: 0};
  game.start();
  advance(game, 0.4, {robot, hardware: {intake: 1, transfer: 0}});
  const entering = game.snapshot().artifacts[0];
  assert.equal(entering.state, 'INTAKE');
  assert.ok(entering.z < robot.z, 'the artifact must remain on robot-forward (-Z) while entering the visible intake');
  assert.ok(entering.z > spawn.z, 'the intake animation must carry the artifact inward instead of pinning it at the pickup rollers');
  assert.ok(entering.y > spawn.y, 'the artifact must rise through the intake roller rows');

  const rearPickup = DecodeGame.create({mode: 'practice', practiceArtifacts: 1});
  const rearSpawn = rearPickup.snapshot().artifacts[0];
  rearPickup.start();
  advance(rearPickup, 0.4, {
    robot: {x: rearSpawn.x, z: rearSpawn.z - 0.48, heading: 0},
    hardware: {intake: 1, transfer: 0},
  });
  assert.equal(rearPickup.snapshot().artifacts[0].state, 'FIELD', 'the rear bumper must not act as an invisible intake');
}

function testTrajectoryAndScoring() {
  const scoring = DecodeGame.create();
  scoring.setArtifactState(1, 'READY', 0);
  scoring.setTriggerRestPosition(0);
  scoring.start();
  scoring.step(0.05, {
    robot: {x: 2.88, z: 0, heading: 0, velocityX: 0, velocityZ: 0},
    hardware: {flywheelVelocity: 1900, flywheelTarget: 1900, triggerPosition: 1},
    gamepad: {a: false},
  });
  scoring.step(0.06, {
    robot: {x: 2.88, z: 0, heading: 0, velocityX: 0, velocityZ: 0},
    hardware: {flywheelVelocity: 1900, flywheelTarget: 1900, triggerPosition: 1},
  });
  advance(scoring, 2, {
    robot: {x: 2.88, z: 0, heading: 0, velocityX: 0, velocityZ: 0},
    hardware: {flywheelVelocity: 1900, flywheelTarget: 1900, triggerPosition: 0},
    gamepad: {a: false},
  });
  assert.equal(scoring.snapshot().hits, 1, 'a centered, correctly tuned shot should pass through the goal opening');

  const low = DecodeGame.predictTrajectory({x: 2.88, z: 0, heading: 0}, 900);
  const tuned = DecodeGame.predictTrajectory({x: 2.88, z: 0, heading: 0}, 1900);
  assert.equal(low.outcome, 'MISSED');
  assert.equal(tuned.outcome, 'SCORED');
  assert.notDeepEqual(low.points, tuned.points, 'measured flywheel velocity must change the visible arc');

  const redGoal = DecodeGame.predictTrajectory({x: -2.88, z: 0, heading: 0}, 1900);
  assert.equal(redGoal.outcome, 'SCORED', 'the mirrored red goal must also score in Practice');
  const reversed = DecodeGame.predictTrajectory({x: 2.88, z: 0, heading: 0}, -1900);
  assert.ok(reversed.points[1].z > reversed.points[0].z, 'a reversed flywheel must send the artifact inward instead of outward');
  assert.ok(reversed.points[1].y < reversed.points[0].y, 'a reversed flywheel must not receive an upward launch impulse');
}

function testLenientGoalSurfaces() {
  const manifest = DecodeGame.defaultManifest;
  const practiceGoals = DecodeGame.scoringOpenings(manifest, 'practice');
  assert.equal(practiceGoals.length, 2, 'Practice must accept both field goals');
  assert.deepEqual(practiceGoals.map((goal) => Math.sign((goal.minX + goal.maxX) / 2)).sort(), [-1, 1]);
  assert.equal(DecodeGame.scoringOpenings(manifest, 'match').length, 1, 'Match must retain its alliance goal');

  const settings = {...DecodeGame.defaults};
  const topBackWall = DecodeGame.lenientGoalContact(
    {x: 2.88, y: 2.15, z: -3.20},
    {x: 2.88, y: 2.05, z: -3.36},
    practiceGoals,
    settings,
  );
  assert.equal(topBackWall?.contact, 'back-wall', 'a shot descending onto the goal back wall from above must score');

  const redTriangle = DecodeGame.goalTriangle(practiceGoals[1], settings);
  const triangleCenter = redTriangle.reduce((point, vertex) => ({
    x: point.x + vertex.x / 3,
    z: point.z + vertex.z / 3,
  }), {x: 0, z: 0});
  const triangleContact = DecodeGame.lenientGoalContact(
    {x: triangleCenter.x, y: 1.1, z: triangleCenter.z + 0.02},
    {x: triangleCenter.x, y: 1.05, z: triangleCenter.z - 0.02},
    practiceGoals,
    settings,
  );
  assert.equal(triangleContact?.goal, 'red-goal');
  assert.equal(triangleContact?.contact, 'triangle', 'the invisible triangular catch region must score once');
}

function testModesAndMatchTermination() {
  const practice = DecodeGame.create({mode: 'practice'});
  assert.equal(practice.snapshot().timeRemaining, null);
  assert.equal(practice.snapshot().fieldArtifacts, 9, 'practice must include all three complete artifact lines');
  assert.ok(practice.snapshot().predictedTrajectory.length > 1, 'practice must show trajectory prediction');
  practice.setArtifactState(1, 'READY', 0);
  practice.setTriggerRestPosition(0);
  practice.start();
  practice.step(0.05, {hardware: {flywheelVelocity: 1900, triggerPosition: 1}, gamepad: {a: false}});
  practice.step(0.06, {hardware: {flywheelVelocity: 1900, triggerPosition: 1}, gamepad: {a: false}});
  advance(practice, 2, {hardware: {flywheelVelocity: 1900, triggerPosition: 0}, gamepad: {a: false}});
  assert.equal(practice.snapshot().fieldArtifacts, 9, 'practice must replenish a resolved artifact');
  assert.ok(
    practice.snapshot().artifacts.filter((artifact) => artifact.state === 'FIELD').every((artifact) => artifact.x < 0),
    'Practice replenishment must return to the original negative-X side instead of alternating sides',
  );

  let endings = 0;
  const match = DecodeGame.create({mode: 'match', onEnd() { endings++; }});
  assert.equal(match.snapshot().fieldArtifacts, 18, 'match must supply exactly 18 alliance-side artifacts');
  assert.equal(match.snapshot().predictedTrajectory.length, 0, 'match must hide predicted trajectories');
  match.start();
  advance(match, 120.2, {hardware: {}, gamepad: {}}, 0.2);
  assert.equal(match.snapshot().ended, true);
  assert.equal(match.snapshot().timeRemaining, 0);
  assert.equal(endings, 1, 'match completion should be reported once');
}

function runDeterministicShot(chunks) {
  const game = DecodeGame.create();
  game.setArtifactState(1, 'READY', 0);
  game.setTriggerRestPosition(0);
  game.start();
  advance(game, 0.12, {robot: {x: 0.14, z: 0.2, heading: 0.04}, hardware: {flywheelVelocity: 1850, triggerPosition: 1}, gamepad: {a: false}}, 1 / 120);
  for (const dt of chunks) {
    game.step(dt, {robot: {x: 0.14, z: 0.2, heading: 0.04}, hardware: {flywheelVelocity: 1850, triggerPosition: 0}, gamepad: {a: false}});
  }
  return game.snapshot();
}

function testDeterministicFixedStep() {
  const fine = runDeterministicShot(Array(180).fill(1 / 120));
  const coarse = runDeterministicShot(Array(30).fill(0.05));
  assert.deepEqual(
    fine.artifacts.map(({state, x, y, z}) => ({state, x, y, z})),
    coarse.artifacts.map(({state, x, y, z}) => ({state, x, y, z})),
    'equal initial state and inputs must produce identical fixed-step results',
  );
  assert.deepEqual({hits: fine.hits, misses: fine.misses}, {hits: coarse.hits, misses: coarse.misses});
}

function settle(runtime, seconds, step = 0.05) {
  for (let elapsed = 0; elapsed < seconds; elapsed += step) runtime.tick(step);
}

function testBatteryChangesPowerArcButVelocityStaysStable() {
  const openLoop = TelemarkJava.createRuntime();
  const openMotor = openLoop.hardwareMap.get('DcMotorEx', 'launcher');
  openMotor.setPower(0.65);
  openLoop.start();
  settle(openLoop, 1);
  const freshVelocity = openMotor.getVelocity();
  settle(openLoop, 120);
  const tiredVelocity = openMotor.getVelocity();
  assert.ok(tiredVelocity < freshVelocity * 0.9, 'open-loop measured launcher speed must fall as voltage drains');
  assert.notDeepEqual(
    DecodeGame.predictTrajectory({x: 0, z: 0, heading: 0}, freshVelocity).points,
    DecodeGame.predictTrajectory({x: 0, z: 0, heading: 0}, tiredVelocity).points,
    'battery-related measured speed loss must alter the shot arc',
  );

  const closedLoop = TelemarkJava.createRuntime();
  const velocityMotor = closedLoop.hardwareMap.get('DcMotorEx', 'launcher');
  velocityMotor.setVelocityPIDFCoefficients(10, 0, 0, 12 / 2800);
  velocityMotor.setVelocity(1900);
  closedLoop.start();
  settle(closedLoop, 1);
  const first = velocityMotor.getVelocity();
  settle(closedLoop, 120);
  assert.ok(Math.abs(velocityMotor.getVelocity() - first) < 1, 'reachable setVelocity target must retain the same shot speed');
}

function testManifestAndBrowserWiring() {
  const manifest = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../static/simulator/models/decode-field.manifest.json'),
    'utf8',
  ));
  assert.equal(manifest.asset.primarySource, 'robot-cad-sources/DECODE™ presented by RTX Full Field - am-5700_Full.glb');
  assert.equal(manifest.asset.alternateSource, 'robot-cad-sources/decode-field.obj');
  assert.equal(manifest.asset.browserAsset, 'decode-field-optimized.glb');
  assert.equal(manifest.asset.status, 'uploaded-glb');
  assert.equal(manifest.rotation.x, -Math.PI / 2);
  assert.equal(manifest.artifactSpawnPoints.length, 18);
  assert.equal(manifest.goalOpenings.length, 2);
  assert.deepEqual(manifest.goalOpenings.map((goal) => goal.id), ['blue-goal', 'red-goal']);
  assert.deepEqual(
    [...new Set(manifest.artifactSpawnPoints.map((point) => Math.sign(point.x)))],
    [-1, 1],
    'artifacts must occupy the six official red/blue spike-mark stacks',
  );
  for (let index = 0; index < manifest.artifactSpawnPoints.length; index += 3) {
    const line = manifest.artifactSpawnPoints.slice(index, index + 3);
    assert.ok(line.every((point) => point.z === line[0].z), 'each field artifact group must be a straight horizontal line');
    assert.deepEqual(
      line.slice(1).map((point, pointIndex) => Number(Math.abs(point.x - line[pointIndex].x).toFixed(3))),
      [0.255, 0.255],
      'artifact centers must be adjacent without overlapping',
    );
  }
  for (const key of ['scale', 'origin', 'boundaries', 'goalOpening', 'collisionAreas']) assert.ok(manifest[key]);

  const fieldBytes = fs.readFileSync(path.resolve(__dirname, '../static/simulator/models/decode-field-optimized.glb'));
  const jsonLength = fieldBytes.readUInt32LE(12);
  const fieldJson = JSON.parse(fieldBytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
  assert.equal(fieldJson.extras.telemarkDecodeField, true);
  assert.equal(
    fieldJson.nodes.some((node) => /Driver Station .* Tape/i.test(node.name || '')
      && (fieldJson.nodes || []).some((parent) => (parent.children || []).includes(fieldJson.nodes.indexOf(node)))),
    false,
    'outer driver-station tape must not remain in the rendered field hierarchy',
  );

  const html = fs.readFileSync(path.resolve(__dirname, '../static/simulator/unit13.mastery.html'), 'utf8');
  assert.match(html, /decode-game\.js/);
  assert.match(html, /decode-game-view\.js/);
  const view = fs.readFileSync(path.resolve(__dirname, '../static/simulator/decode-game-view.js'), 'utf8');
  assert.match(view, /decode-procedural-field/);
  assert.match(view, /decode-uploaded-field/);
  assert.match(view, /SphereGeometry\(0\.125/);
  assert.match(view, /alphaMap: artifactAlpha/);
  assert.match(view, /Successful hardware sequence/);
  assert.match(view, /launcher_trigger/);
  assert.doesNotMatch(view, /then tap A once/);
  assert.match(view, /data-decode-stat=\\"supply\\">9</, 'the initial Practice HUD must not briefly report a missing ninth artifact');
  const unit13Lesson = fs.readFileSync(path.resolve(__dirname, '../docs/unit-13/13.6-mastery-coding-challenge.mdx'), 'utf8');
  assert.match(unit13Lesson, /simulator watches the resulting hardware state, not any particular button/);
  assert.match(unit13Lesson, /launcher_trigger/);
  assert.doesNotMatch(unit13Lesson, /Hold \*\*right bumper|Tap \*\*A|Hold \*\*right trigger/i, 'Unit 13 shot instructions must not prescribe learner-customizable button bindings');
}

testArtifactStateMachineAndCapacity();
testEveryControlledArtifactState();
testReverseReturnsArtifactToField();
testLaunchRisingEdge();
testHardwareSequenceMovesArtifactThroughRobot();
testPickupAndArtifactPathUseRobotForward();
testTrajectoryAndScoring();
testLenientGoalSurfaces();
testModesAndMatchTermination();
testDeterministicFixedStep();
testBatteryChangesPowerArcButVelocityStaysStable();
testManifestAndBrowserWiring();
console.log('DECODE game physics tests passed.');
