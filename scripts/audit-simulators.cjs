const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TelemarkJava = require('../static/simulator/telemark-java.js');

const simulatorRoot = path.resolve(__dirname, '../static/simulator');
const htmlFiles = fs.readdirSync(simulatorRoot)
  .filter((name) => name.endsWith('.html'))
  .sort();
const lessonFiles = htmlFiles.filter((name) => /^unit\d/.test(name));
const masteryFiles = new Set(
  Array.from({length: 14}, (_, index) => `unit${index + 2}.mastery.html`),
);
const legacyLessonFiles = new Set([
  'unit2.html',
  'unit3.html',
  'unit4.html',
  'unit5.html',
  'unit6.html',
  'unit7.html',
  'unit8.1.html',
  'unit8.2.html',
  'unit8.3.html',
  'unit8.4.html',
  'unit8.5.html',
  'unit9.1.html',
]);
const cumulativeProjectFiles = new Set(['unit13.project.html', 'unit15.5.html']);

assert.equal(htmlFiles.length, 62, 'Expected 62 simulator HTML pages');
assert.equal(lessonFiles.length, 61, 'Expected 61 lesson simulator pages');

const masteryRuntimeSource = fs.readFileSync(
  path.join(simulatorRoot, 'mastery_challenge.js'),
  'utf8',
);
assert.match(
  masteryRuntimeSource,
  /TelemarkSimulatorBase\.compileStudentSource\s*\(/,
  'the mastery runtime must compile through simulator_base',
);
assert.match(
  masteryRuntimeSource,
  /setRequirement\s*\(/,
  'the mastery runtime must publish unit-objective results',
);

const masteryContext = {window: {}, document: {currentScript: null}};
vm.runInNewContext(masteryRuntimeSource, masteryContext, {filename: 'mastery_challenge.js'});
const masteryApi = masteryContext.window.TelemarkMasteryChallenge;
const masteryConfigs = masteryApi.configs;
assert.deepEqual(
  Object.keys(masteryConfigs),
  Array.from({length: 14}, (_, index) => String(index + 2)),
  'mastery runtime must configure Units 2-15',
);

for (let unit = 2; unit <= 15; unit += 1) {
  const name = `unit${unit}.mastery.html`;
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  const config = masteryConfigs[unit];
  const project = masteryApi.decodeProjectOptions(unit, config);
  const activeFile = project.initialFiles.find((file) => file.name === config.activeFile);
  const entryFile = project.initialFiles.find((file) => file.name === `${config.entryClass}.java`);
  assert.match(source, new RegExp(`mastery_challenge\\.js["'][^>]*data-unit=["']${unit}["']`));
  assert.equal(project.key, 'telemark:decode-project:v1');
  assert.ok(activeFile, `Unit ${unit} cumulative project needs its active stage file`);
  assert.match(activeFile.source, /^package\s+org\.firstinspires\.ftc\.teamcode;/);
  assert.match(activeFile.source, new RegExp(`\\bclass\\s+${path.basename(config.activeFile, '.java')}\\b`));
  assert.ok(entryFile, `Unit ${unit} cumulative project needs its runnable entry file`);
  assert.match(entryFile.source, /@(TeleOp|Autonomous)\s*\(/, `Unit ${unit} entry file needs an OpMode annotation`);
  assert.ok(config.checks.length >= 4, `Unit ${unit} mastery challenge is not comprehensive`);
}

let starterCount = 0;
for (const name of htmlFiles) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.match(source, /telemark-java\.js/, `${name} must load TelemarkJava`);

  const inlineScripts = source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  let inlineIndex = 0;
  for (const script of inlineScripts) {
    inlineIndex += 1;
    const attributes = script[1];
    if (/\bsrc\s*=|\btype\s*=\s*["']module["']/i.test(attributes)) continue;
    assert.doesNotThrow(
      () => new vm.Script(script[2], {filename: `${name}:inline-${inlineIndex}`}),
      `${name} inline script ${inlineIndex} must parse`,
    );
  }

  if (/^unit\d/.test(name)) {
    assert.match(source, /telemark-editor\.js/, `${name} must load the shared editor behavior`);
    const supportsProjects = legacyLessonFiles.has(name) || masteryFiles.has(name) || cumulativeProjectFiles.has(name) || /^unit(?:9\.[2-5]|10\.[1-5]|12\.[24])\.html$/.test(name);
    assert.equal(/telemark-project\.js/.test(source), supportsProjects, `${name} project controls must match its runtime capability`);
    const usesSharedBase = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*simulator_base\.js["']/i.test(source);
    assert.equal(usesSharedBase, true, `${name} must load simulator_base.js`);
    assert.match(
      source,
      /telemetry|setRequirement|requirements|addHint|visual/i,
      `${name} must expose student feedback`,
    );

    const convertsAndExecutesJava =
      /TelemarkSimulatorBase\s*\.\s*compileStudentSource\s*\(/.test(source)
      || /TelemarkJava\s*\.\s*(?:compile|transpileBody)\s*\(/.test(source)
      || /\btranspileAndRun\s*\(/.test(source)
      || /\b_simTranspile\s*\(/.test(source)
      || (/\b(?:eval|new Function)\s*\(/.test(source) && /\b(?:transpil|compileStudent)/i.test(source))
      || /unit13-project\.js/.test(source)
      || (masteryFiles.has(name) && /mastery_challenge\.js/.test(source));
    assert.equal(
      convertsAndExecutesJava,
      true,
      `${name} must convert student Java and execute the result in the browser`,
    );
    assert.doesNotMatch(
      source,
      /(?:window\s*\.\s*)?TelemarkJava\s*\.\s*(?:compile|createRuntime)\s*\(/,
      `${name} must not bypass the shared base Java runtime wrappers`,
    );

    const usesLegacyBase = /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*simulator_base\.js["'])(?=[^>]*\bdata-telemark-mode\s*=\s*["']legacy["'])[^>]*>/i.test(source);
    if (legacyLessonFiles.has(name)) {
      assert.equal(
        usesLegacyBase,
        true,
        `${name} must mark simulator_base.js as legacy mode`,
      );
    }
    if (usesLegacyBase) {
      assert.match(
        source,
        /TelemarkSimulatorBase\s*\.\s*installLegacy\s*\(\s*\{\s*state\s*:/,
        `${name} legacy controller must install through simulator_base.js`,
      );
      assert.match(
        source,
        /TelemarkSimulatorBase\s*\.\s*compileStudentSource\s*\(/,
        `${name} legacy Java validation must use the shared base compiler wrapper`,
      );
      assert.doesNotMatch(
        source,
        /TelemarkGamepadControls\s*\.\s*install\s*\(/,
        `${name} must not bypass the shared base controller installer`,
      );
    }
  }

  const starter = source.match(
    /(?:const|let|var)\s+starterCode\s*=\s*`([\s\S]*?)`;?/,
  );
  if (!starter) continue;

  starterCount += 1;
  const result = TelemarkJava.compile(starter[1]);
  assert.equal(
    result.ok,
    true,
    `${name} starter code failed: ${result.diagnostics?.[0]?.message}`,
  );
  const className = starter[1].match(/public\s+class\s+(\w+)/)?.[1];
  if (className) {
    const projectFiles = [{name: className + '.java', source: starter[1]}];
    if (name === 'unit15.5.html') {
      projectFiles.push({
        name: 'RobotHardware.java',
        source: `package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.hardware.HardwareMap;
class Intake { void stop() {} void eject() {} }
class Lift { void moveToScore() {} boolean isAtTarget() { return true; } }
public class RobotHardware {
  public final Intake intake = new Intake();
  public final Lift lift = new Lift();
  public void init(HardwareMap hardwareMap) {}
  public void update() {}
  public void stopAll() {}
}`,
      });
    }
    const project = TelemarkJava.compileProject(projectFiles);
    assert.equal(project.ok, true, `${name} project starter failed: ${project.diagnostics?.[0]?.message}`);
  }
}

assert.equal(starterCount, 34, 'Expected 34 embedded starter-code fixtures');

const sharedOwnershipPages = [
  'unit4.html',
  'unit5.html',
  'unit6.html',
  'unit7.html',
  'unit8.1.html',
  'unit8.4.html',
  'unit8.5.html',
  'unit9.1.html',
];

for (const name of sharedOwnershipPages) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.match(
    source,
    /Fallback only: simulator_base owns gamepad input(?: and card interactions)?\.[\s\S]{0,120}if\s*\(\s*!window\.TelemarkSimulatorBase\s*\)\s*\{/,
    `${name} local gamepad listeners must remain disabled whenever simulator_base is available`,
  );
}

for (const name of ['unit2.html', 'unit3.html']) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:buttonMap|setupTriggerSlider|updateStickFromPointer|resetStick)\b/,
    `${name} must not reinstall page-local controller handlers alongside simulator_base`,
  );
}

const unit91OwnershipSource = fs.readFileSync(path.join(simulatorRoot, 'unit9.1.html'), 'utf8');
assert.doesNotMatch(
  unit91OwnershipSource,
  /onclick\s*=\s*["'][^"']*toggleGamepad|\bfunction\s+toggleGamepad\b/,
  'unit9.1.html collapse must be owned only by simulator_base',
);

for (const name of [
  'unit2.html',
  'unit3.html',
  'unit4.html',
  'unit5.html',
  'unit6.html',
  'unit7.html',
  'unit8.1.html',
  'unit8.2.html',
  'unit8.3.html',
  'unit8.4.html',
  'unit8.5.html',
]) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.match(source, /TelemarkEditor\.attach\s*\(/, `${name} must attach the shared textarea editor`);
}

const codeMirrorSource = fs.readFileSync(path.join(simulatorRoot, 'unit9.1.html'), 'utf8');
assert.match(codeMirrorSource, /closeOrOvertype/, 'unit9.1.html must overtype paired CodeMirror closers');
assert.match(
  codeMirrorSource,
  /shouldIndentUnbracedControl/,
  'unit9.1.html must indent unbraced Java control bodies',
);

for (const name of [
  'unit11.1.html',
  'unit11.2.html',
  'unit11.3.html',
  'unit11.4.html',
  'unit11.5.html',
]) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  const initIndex = source.indexOf('window.onInit =');
  const startIndex = source.indexOf('window.onStart =');
  const stopIndex = source.indexOf('window.onStop =');
  assert.ok(initIndex >= 0 && startIndex > initIndex, `${name} must prepare student code during Init`);
  assert.ok(stopIndex > startIndex, `${name} must expose a separate Start lifecycle hook`);

  const initSection = source.slice(initIndex, startIndex);
  const startSection = source.slice(startIndex, stopIndex);
  assert.match(
    initSection,
    /new Function\s*\(|compileStudentCode\s*\(/,
    `${name} must compile student code before Start`,
  );
  assert.match(initSection, /preparedLoopRunner\s*=/, `${name} must prepare its loop during Init`);
  assert.doesNotMatch(initSection, /sim\.running\s*=\s*true/, `${name} must not run during Init`);
  assert.match(startSection, /sim\.running\s*=\s*true/, `${name} must activate on Start`);
  assert.match(startSection, /preparedLoopRunner\s*\(/, `${name} must run only the prepared loop on Start`);
  assert.doesNotMatch(
    startSection,
    /new Function\s*\(|compileStudentCode\s*\(/,
    `${name} must not defer compilation until Start`,
  );
}

const unit115Source = fs.readFileSync(path.join(simulatorRoot, 'unit11.5.html'), 'utf8');
assert.match(
  unit115Source,
  /function updateRequirementStates\s*\(\)[\s\S]*window\.setRequirement\(index,passed\)/,
  'unit11.5.html must publish its validation results to the shared requirement UI',
);

const baseSource = fs.readFileSync(
  path.join(simulatorRoot, 'simulator_base.js'),
  'utf8',
);

assert.match(
  baseSource,
  /function compileStudentSource\s*\([^)]*\)[\s\S]{0,500}TelemarkJava\.compile(?:\.apply)?\s*\(/,
  'simulator_base.js must own the shared Java compiler wrapper',
);
assert.doesNotMatch(
  baseSource,
  /TelemarkProject\.attach\([^)]*,\s*function\s*\([^)]*\)\s*\{[\s\S]{0,160}dispatchEvent\(new Event\(['"]input/,
  'file switches must not dispatch synthetic editor input events',
);
assert.match(
  baseSource,
  /function createRuntime\s*\([^)]*\)[\s\S]{0,1200}TelemarkJava\.createRuntime(?:\.apply)?\s*\(/,
  'simulator_base.js must own the shared Java runtime wrapper',
);
assert.match(
  baseSource,
  /function installLegacy\s*\(/,
  'simulator_base.js must expose the legacy-page integration entry point',
);

const baseInitLifecycle = baseSource.slice(
  baseSource.indexOf('function handleInit()'),
  baseSource.indexOf('function handleStart()'),
);
const baseStartLifecycle = baseSource.slice(
  baseSource.indexOf('function handleStart()'),
  baseSource.indexOf('function handleRun()'),
);
const baseTranspiler = baseSource.slice(
  baseSource.indexOf('window.transpileAndRun ='),
  baseSource.indexOf('window.stopExecution ='),
);

assert.match(
  baseSource,
  /function reportLifecycleError\s*\([\s\S]*lifecycleError\s*=\s*true[\s\S]*showTelemetryError/,
  'simulator_base.js must surface lifecycle failures and mark the lifecycle invalid',
);
assert.match(
  baseSource,
  /function resetAfterLifecycleError\s*\([\s\S]*initialized\s*=\s*false[\s\S]*running\s*=\s*false[\s\S]*setPrimaryButton\s*\(\s*["']Init["']/,
  'simulator_base.js must reset controls after lifecycle failures',
);
assert.match(
  baseInitLifecycle,
  /if\s*\(\s*lifecycleError\s*\)\s*\{[\s\S]*resetAfterLifecycleError\s*\(\s*\)[\s\S]*return false/,
  'shared Init must not advance after a Java compile/runtime failure',
);
assert.match(
  baseSource,
  /function validateFullStudentSource\s*\(\s*\)[\s\S]*compileStudentSource\s*\(\s*source\s*\)[\s\S]*reportLifecycleError\s*\(\s*["']Java compile error["']/,
  'simulator_base.js must compile and report diagnostics for the complete editor source',
);
assert.match(
  baseInitLifecycle,
  /if\s*\(\s*!validateFullStudentSource\s*\(\s*\)\s*\)\s*\{[\s\S]*resetAfterLifecycleError\s*\(\s*\)[\s\S]*return false[\s\S]*window\.onInit/,
  'shared Init must validate all Java before invoking a challenge-specific callback',
);
assert.match(
  baseInitLifecycle,
  /init_loop\(\) runtime error[\s\S]*resetAfterLifecycleError\s*\(\s*\)/,
  'shared init_loop() failures must stop and reset the simulator',
);
assert.match(
  baseStartLifecycle,
  /start\(\) runtime error[\s\S]*resetAfterLifecycleError\s*\(\s*\)[\s\S]*return false/,
  'shared start() failures must not leave the simulator running',
);
assert.match(
  baseTranspiler,
  /resetRuntime\s*:\s*function\s*\(\s*\)\s*\{\s*runtimeStart\s*=\s*Date\.now\s*\(\s*\)/,
  'shared Java execution must expose resetRuntime() to student code',
);
assert.match(
  baseTranspiler,
  /if\s*\(\s*!compiled\.ok\s*\)[\s\S]*reportLifecycleError\s*\([\s\S]*return false/,
  'shared Java compile errors must invalidate Init and return failure',
);
assert.match(
  baseTranspiler,
  /loop\(\) runtime error[\s\S]*window\.stopExecution\s*\(\s*\)/,
  'shared loop() runtime failures must stop execution',
);

for (const name of ['unit3.html', 'unit4.html', 'unit5.html']) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.match(
    source,
    /resetRuntime\s*(?::\s*function\s*\(\s*\)|\(\s*\))\s*\{[\s\S]{0,100}runtimeOffset\s*=\s*Date\.now\s*\(\s*\)/,
    `${name} must expose resetRuntime() to compiled student lifecycle methods`,
  );
  assert.match(
    source,
    /Java compile error[\s\S]{0,500}failJavaExecution|failJavaExecution[\s\S]{0,500}Java compile error/,
    `${name} must surface full-compiler diagnostics and reset its controls`,
  );
  assert.match(
    source,
    /runtime error[\s\S]{0,300}failJavaExecution|failJavaExecution[\s\S]{0,300}runtime error/,
    `${name} must visibly stop after lifecycle runtime failures`,
  );
  assert.match(
    source,
    /if\s*\(\s*!executeMethod\s*\(\s*['"](?:init|start)['"]\s*\)\s*\)\s*return/,
    `${name} must not advance after failed Init or Start execution`,
  );
}

const requiredMethodSources = Object.fromEntries(
  [
    'unit8.1.html',
    'unit8.2.html',
    'unit8.3.html',
    'unit8.4.html',
    'unit8.5.html',
    'unit9.1.html',
    'unit11.1.html',
    'unit12.1.html',
    'unit12.3.html',
  ].map((name) => [name, fs.readFileSync(path.join(simulatorRoot, name), 'utf8')]),
);

assert.match(
  requiredMethodSources['unit8.1.html'],
  /body\s*===\s*null[\s\S]{0,180}Java compile error[\s\S]{0,180}Required loop\(\) method is missing or has unmatched braces/,
  'unit8.1.html must visibly reject a missing or malformed loop()',
);
assert.match(
  requiredMethodSources['unit8.1.html'],
  /function failJavaExecution\s*\([\s\S]{0,500}handleStop\s*\(\s*\)[\s\S]{0,120}return false/,
  'unit8.1.html Java failures must stop and re-enable its controls',
);

const unit82Source = requiredMethodSources['unit8.2.html'];
assert.match(
  unit82Source,
  /initBody\s*===\s*null[\s\S]{0,180}Java compile error[\s\S]{0,180}Required init\(\) method is missing or has unmatched braces[\s\S]{0,100}return false/,
  'unit8.2.html must visibly reject a missing or malformed init()',
);
assert.match(
  unit82Source,
  /loopBody\s*===\s*null[\s\S]{0,180}Java compile error[\s\S]{0,180}Required loop\(\) method is missing or has unmatched braces[\s\S]{0,100}handleStop\s*\(\s*\)[\s\S]{0,100}return false/,
  'unit8.2.html must stop after a missing or malformed loop()',
);
assert.match(
  unit82Source,
  /if\s*\(\s*!executeInit\s*\(\s*\)\s*\)\s*\{\s*handleStop\s*\(\s*\)\s*;\s*return/,
  'unit8.2.html must not begin its loop after Init compilation fails',
);
function assertPositiveZNoseDrive(name, source) {
  assert.match(
    source,
    /marker\.position\.set\s*\(\s*0\s*,\s*0?\.31\s*,\s*0?\.51\s*\)/,
    `${name} must retain its +Z-facing robot nose marker`,
  );
  assert.match(
    source,
    /robotGroup\.position\.x\s*\+\s*\(\s*forward\s*\*\s*sin\s*\+\s*strafe\s*\*\s*cos\s*\)/,
    `${name} forward power must move toward the robot nose on the X axis`,
  );
  assert.match(
    source,
    /robotGroup\.position\.z\s*\+\s*\(\s*forward\s*\*\s*cos\s*-\s*strafe\s*\*\s*sin\s*\)/,
    `${name} forward power must move toward the robot nose on the Z axis`,
  );
}

assertPositiveZNoseDrive('unit8.2.html', unit82Source);
assertPositiveZNoseDrive(
  'unit10.4.html',
  fs.readFileSync(path.join(simulatorRoot, 'unit10.4.html'), 'utf8'),
);

const unit83Source = requiredMethodSources['unit8.3.html'];
assert.match(
  unit83Source,
  /id=["']axis-readout["']/,
  'unit8.3.html must render the axis readout used during shared gamepad installation',
);

const unit85Source = requiredMethodSources['unit8.5.html'];
assert.match(
  unit85Source,
  /id=["']axis-readout["']/,
  'unit8.5.html must render the axis readout used by the shared gamepad callback',
);
assert.match(
  unit85Source,
  /function updateAxisReadout\s*\(\s*\)[\s\S]{0,260}getElementById\s*\(\s*["']axis-readout["']\s*\)/,
  'unit8.5.html must retain a safe shared-input axis readout callback',
);
assert.match(
  unit85Source,
  /installLegacy\s*\(\s*\{[\s\S]{0,160}onInput\s*:\s*updateAxisReadout/,
  'unit8.5.html must update its readout through simulator_base input ownership',
);
assert.doesNotMatch(
  unit85Source,
  /addEventListener\s*\(\s*["']pointerup["']\s*,\s*\(\s*\)\s*=>\s*\{[\s\S]{0,180}releasePointerCapture\s*\(\s*e\.pointerId\s*\)/,
  'unit8.5.html must not reference an undefined pointer event while releasing capture',
);
assert.doesNotMatch(
  unit85Source,
  /^\s*setupGamepad\s*\(\s*\)\s*;\s*$/m,
  'unit8.5.html startup must not reinstall its page-local gamepad handlers',
);

for (const name of ['unit10.3.html', 'unit10.4.html']) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  assert.match(
    source,
    /telemarkThemeRole\s*=\s*["']floor["']/,
    `${name} custom environment floor must opt into shared Three.js theming`,
  );
  assert.match(
    source,
    /telemarkThemeRole\s*=\s*["']wall["']/,
    `${name} custom structural walls must opt into shared Three.js theming`,
  );
  assert.match(
    source,
    /TelemarkSimulatorBase\.themeThreeScene\s*\(\s*scene\s*\)/,
    `${name} asynchronously-created environment must receive the current theme immediately`,
  );
}
assert.match(
  unit83Source,
  /function updateAxisReadout\s*\(\s*\)[\s\S]{0,220}getElementById\s*\(\s*["']axis-readout["']\s*\)/,
  'unit8.3.html shared gamepad callback must update its rendered axis readout',
);

for (const name of ['unit8.3.html', 'unit8.4.html', 'unit8.5.html']) {
  const source = requiredMethodSources[name];
  const runStart = source.indexOf('function handleRun()');
  const preflight = source.indexOf("const requiredInitBody = getMethodBody(projectSource, 'init');", runStart);
  const runningAssignment = source.indexOf('running = true', runStart);
  assert.ok(
    preflight > runStart && runningAssignment > preflight,
    `${name} must validate init() and loop() before entering RUNNING`,
  );
  assert.match(
    source.slice(preflight, runningAssignment),
    /requiredLoopBody[\s\S]*Java compile error:[\s\S]*method is missing or has unmatched braces[\s\S]*return/,
    `${name} must visibly reject missing or malformed required methods`,
  );
  assert.match(
    source,
    /loopBody\s*===\s*null[\s\S]{0,500}Java compile error:[\s\S]{0,500}handleStop\s*\(\s*\)/,
    `${name} must stop if loop() becomes missing or malformed while running`,
  );
  assert.doesNotMatch(
    source,
    /catch\s*\([^)]*\)\s*\{\s*\}/,
    `${name} must not silently swallow Java compile/runtime errors`,
  );
}

const unit91Source = requiredMethodSources['unit9.1.html'];
assert.match(
  unit91Source,
  /ib\s*===\s*null[\s\S]{0,180}telemetryError\s*=[\s\S]{0,180}Required init\(\) method is missing or has unmatched braces[\s\S]{0,100}return false/,
  'unit9.1.html must visibly reject a missing or malformed init()',
);
const unit91RunStart = unit91Source.indexOf('function handleRun()');
const unit91LoopGuard = unit91Source.indexOf('if(lb===null)', unit91RunStart);
const unit91Running = unit91Source.indexOf('state.running=true', unit91RunStart);
assert.ok(
  unit91LoopGuard > unit91RunStart && unit91Running > unit91LoopGuard,
  'unit9.1.html must reject a missing or malformed loop() before entering RUNNING',
);
assert.match(
  unit91Source.slice(unit91LoopGuard, unit91Running),
  /Java compile error:[\s\S]*Required loop\(\) method is missing or has unmatched braces[\s\S]*return/,
  'unit9.1.html must render the loop() extraction error',
);
assert.match(
  unit91Source,
  /loop\(\) runtime error[\s\S]{0,300}handleStop\s*\(\s*\)/,
  'unit9.1.html must stop after a loop() runtime error',
);

for (const name of ['unit11.1.html', 'unit12.1.html']) {
  const source = requiredMethodSources[name];
  assert.match(
    source,
    /Required init\(\) method is missing or has unmatched braces/,
    `${name} must reject a missing or malformed init()`,
  );
  assert.match(
    source,
    /Required loop\(\) method is missing or has unmatched braces/,
    `${name} must reject a missing or malformed loop()`,
  );
  assert.match(
    source,
    /Java compile\/runtime error[\s\S]{0,500}(?:stopExecution\s*\(\s*\)|throw)/,
    `${name} must surface extraction/compilation failures and stop lifecycle execution`,
  );
  assert.match(
    source,
    /loop\(\) runtime error[\s\S]{0,500}stopExecution\s*\(\s*\)/,
    `${name} must visibly report and stop after loop() runtime errors`,
  );
}

assert.match(
  requiredMethodSources['unit12.3.html'],
  /getFieldRelativeStrafe\(\) was not found or is missing a closing brace/,
  'unit12.3.html must distinguish a missing/malformed required student method',
);
assert.match(
  requiredMethodSources['unit12.3.html'],
  /getFieldRelativeStrafe\(\) (?:compile|runtime) error/,
  'unit12.3.html must visibly report student formula failures',
);

for (const name of [
  'unit12.3.html',
  'unit13.1.html',
  'unit13.2.html',
  'unit13.3.html',
  'unit13.4.html',
  'unit13.5.html',
  'unit14.1.html',
  'unit14.2.html',
  'unit14.3.html',
  'unit14.4.html',
  'unit14.5.html',
  'unit15.1.html',
  'unit15.2.html',
  'unit15.3.html',
  'unit15.4.html',
  'unit15.5.html',
]) {
  const source = fs.readFileSync(path.join(simulatorRoot, name), 'utf8');
  const helper = source.match(/function\s+(failStudent(?:Execution|Formula))\s*\([^)]*\)\s*\{([\s\S]{0,700}?)\n\s*\}/);
  assert.ok(helper, `${name} must provide a shared student-failure path`);
  assert.match(helper[2], /stopExecution\s*\(/, `${name} student failures must reset execution`);
  assert.match(
    helper[2],
    /showStudentError\s*\(|reportStudentFormulaError\s*\(|_simShowTelemetryError/,
    `${name} student failures must remain visible after reset`,
  );
  const helperUses = source.match(new RegExp(`${helper[1]}\\s*\\(`, 'g')) || [];
  assert.ok(helperUses.length >= 2, `${name} must route caught student failures through its reset path`);
}
for (const api of [
  'setFaultModes',
  'getActiveFault',
  'isFaultActive',
  'createSeededRandom',
  'evaluateChallengeHints',
]) {
  assert.match(baseSource, new RegExp(`window\\.${api}`), `Missing ${api} API`);
}

for (const [file, faultId] of [
  ['unit10.3.html', 'lift-stall'],
  ['unit11.5.html', 'threshold-noise'],
  ['unit12.2.html', 'imu-drift'],
  ['unit14.2.html', 'stale-detections'],
]) {
  const source = fs.readFileSync(path.join(simulatorRoot, file), 'utf8');
  assert.match(source, new RegExp(faultId), `${file} is missing ${faultId}`);
}

assert.doesNotMatch(
  fs.readFileSync(path.join(simulatorRoot, 'unit14.2.html'), 'utf8'),
  /Math\.random\(\)/,
  'Unit 14.2 random scenarios must be seeded',
);

console.log(
  `Simulator audit passed for ${lessonFiles.length} lesson pages and ${starterCount} starter fixtures`,
);
