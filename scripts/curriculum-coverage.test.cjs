const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const challengeSource = fs.readFileSync(path.join(root, 'static/simulator/mastery_challenge.js'), 'utf8');
const context = {window: {}, document: {currentScript: {dataset: {unit: '0'}}}};
vm.runInNewContext(challengeSource, context, {filename: 'mastery_challenge.js'});
const mastery = context.window.TelemarkMasteryChallenge;

function unitCorpus(unit) {
  const directory = path.join(root, `docs/unit-${String(unit).padStart(2, '0')}`);
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.mdx') && !name.includes('overview'))
    .sort()
    .map((name) => fs.readFileSync(path.join(directory, name), 'utf8'))
    .join('\n');
}

const coverage = {
  2: [/CompetitionTeleOp\.java/, /iterative OpMode/, /init\(\)/, /start\(\)/, /loop\(\)/, /stop\(\)/],
  3: [/RobotConfig/, /static final String/, /double/, /boolean/, /int/],
  4: [/Drivetrain\.java/, /deadzone/i, /mecanum/i, /normalize/i, /gamepad1/],
  5: [/Intake\.java/, /Transfer\.java/, /if.*else if.*else/is, /right bumper/i, /left bumper/i],
  6: [/array/i, /for-each|for loop/i, /rising edge/i, /getRuntime\(\)/, /deadline/i, /sleep\(\)/],
  7: [/Launcher\.java/, /ArtifactSensors\.java/, /init\(HardwareMap\)/, /hardware lookup|hardwareMap\.get/i],
  8: [/setDirection\(\)/, /RUN_USING_ENCODER/, /BRAKE/, /setPower\(0\)/],
  9: [/Launcher\.java/, /Servo/, /setPosition\(\)/, /rising edge/i, /deadline/i],
  10: [/DcMotorEx/, /setVelocity\(\)/, /getVelocity\(\)/, /PIDF/, /RUN_USING_ENCODER/],
  11: [/ArtifactSensors\.java/, /three artifacts/i, /sensor transitions/i, /hasCapacity\(\)/, /interlock/i],
  12: [/Drivetrain\.java/, /IMU/, /radians/i, /sine and cosine/i, /field-centric/i],
  13: [/PoweredMechanism\.java/, /RobotHardware\.java/, /Drivetrain, Intake, Transfer, Launcher, and ArtifactSensors/, /robot\.stopAll\(\)/],
  14: [/Vision\.java/, /AprilTagProcessor/, /VisionPortal/, /left, center, and right/i, /close/i],
  15: [/FullAutonomous\.java/, /Limelight/, /Follower/, /Bezier|Bézier/, /robot\.update\(\)/, /robot\.stopAll\(\)/],
};

let covered = 0;
for (let unit = 2; unit <= 15; unit += 1) {
  const config = mastery.configs[unit];
  const options = mastery.decodeProjectOptions(unit, config);
  const corpus = unitCorpus(unit);
  assert.ok(config.activeFile, `Unit ${unit} needs an active project file`);
  assert.ok(config.scenario.length > 40, `Unit ${unit} needs a clear project-stage scenario`);
  assert.ok(corpus.includes(config.activeFile), `Unit ${unit} docs must name its active file`);
  assert.ok(options.stage.files.includes(config.activeFile), `Unit ${unit} stage must snapshot its active file`);
  assert.ok(config.checks.length >= 4, `Unit ${unit} needs clear behavioral requirements`);
  coverage[unit].forEach((pattern) => {
    assert.match(corpus, pattern, `Unit ${unit} does not teach ${pattern}`);
    covered += 1;
  });
}

console.log(`Curriculum progression checks passed for ${covered} stage concepts.`);
