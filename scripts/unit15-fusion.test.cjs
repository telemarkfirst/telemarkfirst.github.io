const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'static', 'simulator', 'unit15.4.html'),
  'utf8',
);

function extractMethodBody(source, methodName) {
  const match = new RegExp(`\\b${methodName}\\s*\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(match, `${methodName}() must exist in the fixture`);
  const open = source.indexOf('{', match.index);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unbalanced ${methodName}() fixture`);
}

function loadCorrectBodyTranspiler() {
  const match = html.match(
    /  function transpileCorrectBody\(body\) \{([\s\S]*?)\n  \}\n\n  function transpileLoopBody/,
  );
  assert.ok(match, 'unit15.4 must expose its correctPose body transpiler');
  return new Function(`return function transpileCorrectBody(body) {${match[1]}\n}`)();
}

const answer = `
void correctPoseFromLimelight() {
    LLResult result = limelight.getLatestResult();
    if (!result.isValid()) return;
    if (result.getStaleness() > 100 || result.getBotposeTagCount() < 1) return;

    Pose3D botpose = result.getBotpose();
    if (botpose == null) return;

    Pose estimate = follower.pose();
    double innovationX = botpose.getPosition().x * 39.3701 - estimate.x();
    double innovationY = botpose.getPosition().y * 39.3701 - estimate.y();
    double innovationHeading = AngleUnit.normalizeRadians(
        botpose.getOrientation().getYaw(AngleUnit.RADIANS) - estimate.heading()
    );

    if (Math.hypot(innovationX, innovationY) > 12.0) return;

    double gain = 0.35;
    follower.setPose(new Pose(
        estimate.x() + gain * innovationX,
        estimate.y() + gain * innovationY,
        AngleUnit.normalizeRadians(
            estimate.heading() + gain * innovationHeading
        )
    ));
}
`;

const transpile = loadCorrectBodyTranspiler();
const javascript = transpile(extractMethodBody(answer, 'correctPoseFromLimelight'));
const runFusion = new Function(
  'getLimelightResult',
  'getFollowerPose',
  'setFollowerPose',
  'createPose',
  'normalizeAngle',
  `"use strict";\n${javascript}`,
);

function normalizeAngle(value) {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function measurement(xInches, yInches, heading, overrides = {}) {
  return {
    valid: true,
    staleness: 20,
    tagCount: 2,
    botpose: {
      position: {x: xInches / 39.3701, y: yInches / 39.3701},
      orientation: {yawRadians: heading},
    },
    ...overrides,
  };
}

function execute(result, estimate = {x: 85, y: 64.5, heading: 0.77}) {
  let fused;
  runFusion(
    () => result,
    () => estimate,
    (pose) => { fused = pose; },
    (x, y, heading) => ({x, y, heading}),
    normalizeAngle,
  );
  return fused;
}

const truth = {x: 78, y: 68, heading: Math.PI / 5};
const fused = execute(measurement(truth.x, truth.y, truth.heading));
assert.ok(fused, 'a fresh in-family measurement should be fused');
assert.ok(Math.abs(fused.x - (85 + 0.35 * (truth.x - 85))) < 1e-9);
assert.ok(Math.abs(fused.y - (64.5 + 0.35 * (truth.y - 64.5))) < 1e-9);

assert.equal(execute(measurement(truth.x, truth.y, truth.heading, {valid: false})), undefined);
assert.equal(execute(measurement(truth.x, truth.y, truth.heading, {staleness: 250})), undefined);
assert.equal(execute(measurement(truth.x, truth.y, truth.heading, {tagCount: 0})), undefined);
assert.equal(execute(measurement(truth.x, truth.y, truth.heading, {botpose: null})), undefined);
assert.equal(execute(measurement(truth.x + 50, truth.y, truth.heading)), undefined);

console.log('Unit 15.4 fusion simulator tests passed');
