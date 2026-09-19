const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const TelemarkJava = require('../static/simulator/telemark-java.js');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const curriculumSource = read('src/telemark/curriculum.ts');
const {outputText} = ts.transpileModule(curriculumSource, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});
const loaded = {exports: {}};
new Function('exports', 'require', 'module', outputText)(loaded.exports, require, loaded);
const {CURRICULUM_UNITS, CURRICULUM_LESSONS, CURRICULUM_LESSON_COUNT} = loaded.exports;

assert.equal(CURRICULUM_LESSON_COUNT, 118);
assert.equal(CURRICULUM_LESSONS.length, 104);
assert.equal(CURRICULUM_UNITS.find((unit) => unit.slug === 'unit-13').lessonCount, 10);

const unit0Ids = CURRICULUM_LESSONS
  .filter((lesson) => lesson.unitSlug === 'unit-00')
  .map((lesson) => lesson.id);
assert.deepEqual(unit0Ids, [
  'unit-00/classes-and-objects',
  'unit-00/how-java-runs',
  'unit-00/references-and-identity',
  'unit-00/objects-working-together',
  'unit-00/static-and-nested-members',
]);

const unit0Files = [
  'docs/unit-00/0.1-classes-and-objects.mdx',
  'docs/unit-00/0.2-fields-constructors-methods.mdx',
  'docs/unit-00/0.3-references-and-identity.mdx',
  'docs/unit-00/0.4-objects-working-together.mdx',
  'docs/unit-00/0.5-static-and-nested-members.mdx',
];
unit0Files.forEach((file, index) => {
  const lesson = read(file);
  assert.match(lesson, new RegExp(`sidebar_position:\\s*${index + 1}`));
  assert.match(lesson, /Terms to Keep/);
  assert.match(lesson, /Check Your Understanding/);
  assert.match(lesson, /Where You Will Use This/);
  assert.match(lesson, /RobotArm/);
});
assert.match(read(unit0Files[0]), /blueprint/i);
assert.match(read(unit0Files[0]), /house/i);
for (const word of ['class', 'public', 'private', 'double', 'void', 'new', 'this', 'return']) {
  assert.match(read(unit0Files[0]), new RegExp('\\| `' + word + '` \\|'), `Unit 0.1 must explain ${word}`);
}
assert.match(read(unit0Files[0]), /String.*not keywords/s);
assert.match(
  read(unit0Files[1]),
  /Java keyword reference from Lesson 0\.1.*\/docs\/unit-00\/classes-and-objects#read-the-java-keywords/s,
  'Unit 0.2 must link back to the beginner keyword reference',
);
assert.match(read(unit0Files[2]), /null.*Java keyword/s);
assert.match(read(unit0Files[3]), /extends[\s\S]*@Override[\s\S]*annotation, not a keyword/);
assert.match(read(unit0Files[4]), /static.*final.*Java keywords/s);
assert.match(read(unit0Files[4]), /boolean.*Java keyword and primitive type/s);
assert.match(read(unit0Files[4]), /does not support nested classes/i);
assert.match(read(unit0Files[4]), /top-level files/i);

const unit13Ids = CURRICULUM_LESSONS
  .filter((lesson) => lesson.unitSlug === 'unit-13')
  .map((lesson) => lesson.id);
assert.equal(unit13Ids.at(-1), 'unit-13/mastery-coding-challenge');
assert.deepEqual(unit13Ids.slice(5, 9), [
  'unit-13/build-intake',
  'unit-13/build-lift',
  'unit-13/build-robot-hardware',
  'unit-13/competition-teleop',
]);

for (const file of [
  'docs/unit-13/13.6-build-intake.mdx',
  'docs/unit-13/13.7-build-lift.mdx',
  'docs/unit-13/13.8-build-robot-hardware.mdx',
  'docs/unit-13/13.9-competition-teleop.mdx',
]) {
  assert.match(read(file), /Unit13BuildSimulator/);
}

const conceptSimulatorAlignment = [
  ['13.1-encapsulation.mdx', 'unit13.1.html', ['IntakeMechanism', 'CRServo', 'collect()', 'eject()', 'stop()']],
  ['13.2-inheritance.mdx', 'unit13.2.html', ['BaseServoMechanism', 'GrabberMechanism', 'OPEN_POS', 'CLOSED_POS']],
  ['13.3-override.mdx', 'unit13.3.html', ['SafetySlide', 'move(double power)', 'Math.min', 'Math.signum']],
  ['13.4-static-constants.mdx', 'unit13.4.html', ['HardwareNames', 'CLAW_SERVO', 'WRIST_MOTOR', 'RANGE_SENSOR']],
  ['13.5-robot-class.mdx', 'unit13.5.html', ['ClawMechanism', 'WristMechanism', 'MyRobot', 'stopAll()']],
];
for (const [docName, simulatorName, sharedTerms] of conceptSimulatorAlignment) {
  const lesson = read(path.join('docs/unit-13', docName));
  const simulator = read(path.join('static/simulator', simulatorName));
  for (const term of sharedTerms) {
    assert.ok(lesson.includes(term), `${docName} is missing simulator term ${term}`);
    assert.ok(simulator.includes(term), `${simulatorName} is missing lesson term ${term}`);
  }
  assert.match(simulator, /function\s+(?:setupScene|initThreeScene|buildScene)\s*\(/, `${simulatorName} needs a lesson-specific 3D scene`);
}

const unit13Simulator = read('static/simulator/unit13-project.js');
for (const name of ['RobotConfig.java', 'Intake.java', 'MotorMechanism.java', 'Lift.java', 'RobotHardware.java', 'CompetitionTeleOp.java']) {
  assert.ok(unit13Simulator.includes(name), `Unit 13 project is missing ${name}`);
}
assert.match(unit13Simulator, /const restoredMain = getCode\(\)/);
assert.match(unit13Simulator, /initialFiles/);
assert.match(unit13Simulator, /setupStageScene\(\)/);
assert.match(unit13Simulator, /tickStageScene/);
assert.match(unit13Simulator, /RobotHardware coordinates both subsystems/);
assert.match(unit13Simulator, /CompetitionTeleOp delegates to RobotHardware/);
assert.match(read('static/simulator/simulator_base.js'), /prepareSimulatorValidationSource/);
assert.match(unit13Simulator, /sim-gp-collapse-btn/);
assert.match(read('static/simulator/unit13.project.html'), /@media \(max-width: 1100px\)[\s\S]*?flex-direction: column !important/);
assert.match(read('static/simulator/unit13.5.html'), /point\.project\(window\.camera\)/, 'Unit 13.5 labels must follow their 3D mechanisms');
for (const stage of ['intake', 'lift', 'hardware', 'teleop']) {
  assert.match(unit13Simulator, new RegExp(`${stage}: \\{[\\s\\S]*?heading:`), `Unit 13 ${stage} stage needs matched visual guidance`);
}
assert.match(
  read('static/simulator/mastery_challenge.js'),
  /function rigDecodeMechanisms\(model\)[\s\S]*?getObjectByName\("telemark-cad-" \+ name\)[\s\S]*?decodeMechanisms = rigDecodeMechanisms\(model\)/,
  'Unit 13 mastery must bind the DECODE subsystem architecture to the imported CAD nodes',
);

let unit13TeleopFiles = [];
for (const lesson of ['intake', 'lift', 'hardware', 'teleop']) {
  let files = [];
  const editor = {value: ''};
  const context = {
    window: {
      location: {search: `?lesson=${lesson}`},
      TelemarkSimulatorBase: {compileStudentSource: () => ({ok: true})},
      TelemarkProject: {attach: (_editor, _refresh, options) => { files = options.initialFiles; }},
    },
    document: {getElementById: () => editor},
    URLSearchParams,
    setCode: (source) => { editor.value = source; },
    getCode: () => editor.value,
    setChallenge() {}, setBadges() {}, setActiveInputs() {}, clearHints() {}, addHint() {}, setRequirement() {},
  };
  vm.createContext(context);
  vm.runInContext(unit13Simulator, context, {filename: 'unit13-project.js'});
  context.window.onSimulatorReady();
  if (lesson !== 'teleop') {
    files.push({
      name: 'BuildCheck.java',
      source: `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
@TeleOp(name="Build Check") public class BuildCheck extends OpMode {}`,
    });
  }
  const compilation = TelemarkJava.compileProject(files);
  assert.equal(compilation.ok, true, `Unit 13 ${lesson} project must compile: ${compilation.diagnostics?.[0]?.message}`);
  if (lesson === 'teleop') unit13TeleopFiles = files;
}

const masterySource = read('static/simulator/mastery_challenge.js');
const masteryContext = {window: {TelemarkJava}, document: {currentScript: {dataset: {unit: '0'}}}};
vm.runInNewContext(masterySource, masteryContext, {filename: 'mastery_challenge.js'});
const cumulativeFiles = masteryContext.window.TelemarkMasteryChallenge
  .decodeProjectOptions(13, masteryContext.window.TelemarkMasteryChallenge.configs[13])
  .initialFiles.map((file) => file.name);
assert.ok(cumulativeFiles.includes('PoweredMechanism.java'));
assert.ok(cumulativeFiles.includes('RobotHardware.java'));
assert.ok(cumulativeFiles.includes('CompetitionTeleOp.java'));
assert.ok(!cumulativeFiles.includes('Lift.java'), 'the DECODE project remains lift-free');
assert.ok(!cumulativeFiles.includes('MotorMechanism.java'), 'the DECODE parent is PoweredMechanism');
const coordinationOnly = `class RobotHardware {} class CompetitionTeleOp extends OpMode { private final RobotHardware robot = new RobotHardware(); void loop() {} }`;
const inlineHardware = `class RobotHardware {} class CompetitionTeleOp extends OpMode { private final RobotHardware robot = new RobotHardware(); private DcMotor duplicatedMotor; void loop() {} }`;
assert.equal(masteryContext.window.TelemarkMasteryChallenge.evaluate(13, coordinationOnly).at(-1), true);
assert.equal(masteryContext.window.TelemarkMasteryChallenge.evaluate(13, inlineHardware).at(-1), false);

const finalAuto = read('docs/unit-15/15.5-full-autonomous.mdx');
for (const call of ['new RobotHardware()', 'robot.init(hardwareMap)', 'robot.update()', 'robot.lift', 'robot.intake', 'robot.stopAll()']) {
  assert.ok(finalAuto.includes(call), `Lesson 15.5 must include ${call}`);
}
assert.doesNotMatch(finalAuto, /hardwareMap\.get\s*\(\s*(?:DcMotor|CRServo|Servo)\.class/);
assert.match(finalAuto, /same TeamCode package/);
assert.match(finalAuto, /completed[- ]lesson/i);

const finalSimulator = read('static/simulator/unit15.5.html');
assert.match(finalSimulator, /telemark-project\.js/);
assert.match(finalSimulator, /FullAutonomousPractice\.java/);
assert.match(finalSimulator, /referenceFiles/);
assert.match(finalSimulator, /hasMechanisms/);
assert.match(finalSimulator, /Keep raw intake and lift mapping out of the OpMode/);

const finalStarter = finalSimulator.match(/const starterCode = `([\s\S]*?)`;\n\n  const referenceFiles/)?.[1];
const referenceSection = finalSimulator.match(/const referenceFiles = \[([\s\S]*?)\n  \];\n\n  const requirements/)?.[1];
assert.ok(finalStarter && referenceSection, 'Lesson 15.5 must expose its project fixtures');
const finalFiles = [{name: 'FullAutonomousPractice.java', source: finalStarter}];
for (const match of referenceSection.matchAll(/name: "([^"]+)",[\s\S]*?source: `([\s\S]*?)`/g)) {
  finalFiles.push({name: match[1], source: match[2]});
}
assert.equal(finalFiles.length, 6);
assert.match(finalStarter, /Constants\.create\(hardwareMap\)/);
assert.match(finalStarter, /return sequential\(/);
assert.match(finalStarter, /Scheduler\.execute\(\)/);
assert.doesNotMatch(finalStarter, /setStartingPose|followPathChain|PathChain/);

console.log('OOP progression, multi-file builds, and autonomous carry-forward checks passed');
