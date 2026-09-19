const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const simulatorRoot = path.join(repoRoot, 'static/simulator');
const telemarkJavaSource = fs.readFileSync(
  path.join(simulatorRoot, 'telemark-java.js'),
  'utf8',
);
const simulatorBaseSource = fs.readFileSync(
  path.join(simulatorRoot, 'simulator_base.js'),
  'utf8',
);

function createBaseHarness() {
  const elements = new Map();
  const intervals = new Map();
  const errors = [];
  let nextInterval = 1;

  function element(id = '') {
    if (id && elements.has(id)) return elements.get(id);
    let html = '';
    const value = {
      id,
      value: '',
      textContent: '',
      get innerHTML() { return html; },
      set innerHTML(next) {
        html = String(next);
        value.children.length = 0;
      },
      disabled: false,
      scrollTop: 0,
      scrollHeight: 0,
      style: {},
      children: [],
      classList: {add() {}, remove() {}, toggle() {}},
      addEventListener() {},
      appendChild(child) { value.children.push(child); return child; },
      querySelector() { return null; },
      setAttribute() {},
    };
    if (id) elements.set(id, value);
    return value;
  }

  const document = {
    readyState: 'loading',
    getElementById: element,
    createElement() { return element(); },
    addEventListener() {},
  };
  const context = {
    console: {
      ...console,
      error(...args) { errors.push(args); },
    },
    document,
    setTimeout,
    clearTimeout,
    setInterval(callback) {
      const id = nextInterval++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    addEventListener() {},
  };
  context.window = context;

  vm.createContext(context);
  vm.runInContext(telemarkJavaSource, context, {filename: 'telemark-java.js'});
  vm.runInContext(simulatorBaseSource, context, {filename: 'simulator_base.js'});

  return {
    context,
    elements,
    errors,
    runIntervals() {
      for (const callback of [...intervals.values()]) callback();
    },
  };
}

function telemetryText(page) {
  const panel = page.elements.get('sim-telemetry-log');
  return [
    panel.textContent,
    panel.innerHTML,
    ...panel.children.map((child) => child.textContent),
  ].join('\n');
}

function iterativeSource(methods) {
  return `
    public class SharedLifecycleRegression extends OpMode {
      public void init() { ${methods.init || ''} }
      ${methods.initLoop === undefined ? '' : `public void init_loop() { ${methods.initLoop} }`}
      ${methods.start === undefined ? '' : `public void start() { ${methods.start} }`}
      public void loop() { ${methods.loop || ''} }
    }
  `;
}

function installStudentSource(page, source) {
  page.context.document.getElementById('sim-code-editor').value = source;
  page.context.onInit = function () {
    return page.context.transpileAndRun(source);
  };
}

function assertStopped(page, message) {
  assert.equal(page.context._simIsInitialized(), false, message);
  assert.equal(page.context._simIsRunning(), false, message);
  assert.equal(page.elements.get('sim-ds-state').textContent, 'STOPPED', message);
  assert.equal(page.elements.get('sim-btn-run').textContent, 'Init', message);
  assert.equal(page.elements.get('sim-btn-run').disabled, false, message);
}

function testCompileErrorGatesInit() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({start: 'int broken = ;'}));

  assert.equal(page.context._simHandleInit(), false);
  assertStopped(page, 'a compile failure must reset the shared lifecycle');
  assert.match(telemetryText(page), /Java compile error|Unexpected token/i);
}

function testMissingCompilerFailsClosed() {
  const page = createBaseHarness();
  const editor = page.context.document.getElementById('sim-code-editor');
  editor.value = iterativeSource({loop: 'telemetry.addData("Loop", "valid");'});
  page.context.TelemarkJava = undefined;

  assert.equal(page.context._simHandleInit(), false);
  assertStopped(page, 'a missing Java compiler must never fall back to direct execution');
  assert.match(telemetryText(page), /Java compiler is unavailable/i);
}

function testStudentOnlyTelemetryRoutesDiagnosticsToHints() {
  const page = createBaseHarness();
  page.context.setTelemetryStudentOnly(true);
  installStudentSource(page, iterativeSource({start: 'int broken = ;'}));

  assert.equal(page.context._simHandleInit(), false);
  assert.equal(telemetryText(page).trim(), '', 'system diagnostics must not enter student telemetry');
  const hints = page.elements.get('sim-hint-container');
  assert.equal(hints.children.length, 1);
  assert.match(hints.children[0].innerHTML, /Java compile error|Unexpected token/i);

  installStudentSource(page, iterativeSource({
    init: 'telemetry.addData("Student", "only"); telemetry.update();',
  }));
  assert.equal(page.context._simHandleInit(), true);
  assert.match(telemetryText(page), /Student.*only/is);
}

function testFtcHardwareRegistrySupportsChallengeDevices() {
  const page = createBaseHarness();
  const {hardwareMap} = page.context;
  let commandedPower = 0;
  hardwareMap.onMotorPower((_name, power) => { commandedPower = power; });
  const motor = hardwareMap.get('DcMotor', 'leftFront');
  motor.setMode(page.context.DcMotor.RunMode.RUN_TO_POSITION);
  motor.setTargetPosition(560);
  motor.setPower(1);
  assert.equal(commandedPower, 1);
  assert.equal(motor.isBusy(), true);
  hardwareMap.tick(0.1);
  assert.ok(motor.getCurrentPosition() > 0, 'encoder state should advance with motor power');

  const digital = hardwareMap.get('DigitalChannel', 'upperLimit');
  digital.setMode(page.context.DigitalChannel.Mode.INPUT);
  assert.equal(digital.getState(), true);
  digital._setState(false);
  assert.equal(digital.getState(), false);
  assert.equal(hardwareMap.get('AnalogInput', 'pot').getVoltage(), 1.65);
  assert.equal(hardwareMap.get('DistanceSensor', 'distance').getDistance('INCH'), 24);
}

function testSharedBatteryAndDcMotorExPhysics() {
  const page = createBaseHarness();
  const {hardwareMap} = page.context;
  const flywheel = hardwareMap.get('DcMotorEx', 'flywheel');
  assert.equal(flywheel._type, 'DcMotorEx');
  flywheel.setVelocityPIDFCoefficients(12, 0.5, 0.1, 0.004);
  assert.deepEqual(
    {...flywheel.getVelocityPIDFCoefficients()},
    {p: 12, i: 0.5, d: 0.1, f: 0.004},
  );
  flywheel.setVelocity(1700);
  hardwareMap.startBattery();
  for (let index = 0; index < 40; index += 1) hardwareMap.tick(0.05);
  assert.ok(Math.abs(flywheel.getVelocity() - 1700) < 1, 'base DcMotorEx holds a reasonable velocity target');
  for (let index = 0; index < 2360; index += 1) hardwareMap.tick(0.05);
  assert.ok(Math.abs(flywheel.getVelocity() - 1700) < 1, 'base velocity control compensates through 120 seconds');
  assert.ok(hardwareMap.getBatteryState().terminalVoltage < 11.1);

  flywheel.setVelocity(4000);
  for (let index = 0; index < 40; index += 1) hardwareMap.tick(0.05);
  assert.ok(flywheel.getVelocity() < 2700, 'base velocity control saturates at low-voltage headroom');
  hardwareMap.stopBattery();
  const stoppedAt = hardwareMap.getBatteryState().activeSeconds;
  for (let index = 0; index < 20; index += 1) hardwareMap.tick(0.05);
  assert.equal(hardwareMap.getBatteryState().activeSeconds, stoppedAt, 'base battery freezes while stopped');
  hardwareMap.resetBattery();
  assert.equal(hardwareMap.getBatteryState().terminalVoltage, 13);

  flywheel.setPower(0.75);
  hardwareMap.startBattery();
  const hints = page.context.document.getElementById('sim-hint-container');
  for (let index = 0; index < 1120; index += 1) hardwareMap.tick(0.05);
  assert.equal(hints.children.length, 0);
  for (let index = 0; index < 66; index += 1) hardwareMap.tick(0.05);
  assert.equal(hints.children.length, 1, 'battery warning uses the existing hint component');
  assert.match(hints.children[0].innerHTML, /setPower\(\).*DcMotorEx\.setVelocity\(\).*PIDF/i);
  for (let index = 0; index < 600; index += 1) hardwareMap.tick(0.05);
  assert.equal(hints.children.length, 1, 'base battery warning appears only once per run');
}

function testFullSourceGateRejectsUnusedMalformedMethodAndRetries() {
  const page = createBaseHarness();
  const editor = page.context.document.getElementById('sim-code-editor');
  let pageInitCalls = 0;

  page.context.onInit = function () {
    // Represents a custom simulator that only prepares init()/loop() and would
    // otherwise never inspect the malformed start() method.
    pageInitCalls += 1;
  };

  editor.value = iterativeSource({
    init: 'telemetry.addData("Init", "valid");',
    start: 'int broken = ;',
    loop: 'telemetry.addData("Loop", "valid");',
  });

  assert.equal(page.context._simHandleInit(), false);
  assertStopped(page, 'malformed Java anywhere in the source must gate Init');
  assert.equal(pageInitCalls, 0, 'page callbacks must not run before full-source validation');
  assert.match(telemetryText(page), /Java compile error|Unexpected token/i);

  editor.value = iterativeSource({
    init: 'telemetry.addData("Init", "valid");',
    start: 'telemetry.addData("Start", "corrected");',
    loop: 'telemetry.addData("Loop", "valid");',
  });

  assert.equal(page.context._simHandleInit(), true, 'corrected Java must initialize on retry');
  assert.equal(pageInitCalls, 1, 'the page callback must run after validation succeeds');
  assert.equal(page.context._simHandleStart(), true, 'corrected Java must remain startable');
}

function testCompileErrorCleansPageStateForRetry() {
  const page = createBaseHarness();
  let pageRunning = false;
  let stopCalls = 0;
  let source = iterativeSource({init: 'missingInitAction();'});
  const editor = page.context.document.getElementById('sim-code-editor');
  editor.value = source;

  page.context.onInit = function () {
    if (pageRunning) return false;
    pageRunning = true;
    return page.context.transpileAndRun(source);
  };
  page.context.onStop = function () {
    pageRunning = false;
    stopCalls += 1;
  };

  assert.equal(page.context._simHandleInit(), false);
  assert.equal(pageRunning, false, 'error cleanup must reset challenge-owned running guards');
  assert.equal(stopCalls, 1, 'error cleanup must notify the challenge page exactly once');

  source = iterativeSource({
    start: 'telemetry.addData("Start", "retry succeeded"); telemetry.update();',
  });
  editor.value = source;
  assert.equal(page.context._simHandleInit(), true, 'corrected Java must compile on the next Init');
  assert.equal(page.context._simHandleStart(), true, 'corrected Java must be startable immediately');
  assert.equal(page.context._simIsRunning(), true);
  assert.match(telemetryText(page), /retry succeeded/);
}

function testResetRuntimeBindingAndStartContinuation() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({
    start: `
      resetRuntime();
      telemetry.addData("Start", "continued");
      telemetry.update();
    `,
  }));

  assert.equal(page.context._simHandleInit(), true);
  assert.equal(page.context._simHandleStart(), true);
  assert.equal(page.context._simIsRunning(), true);
  assert.match(telemetryText(page), /continued/);
}

function testStartRuntimeErrorGatesRunning() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({start: 'missingStartAction();'}));

  assert.equal(page.context._simHandleInit(), true);
  assert.equal(page.context._simHandleStart(), false);
  assertStopped(page, 'a start() runtime failure must not leave the simulator running');
  assert.match(telemetryText(page), /start\(\) runtime error.*missingStartAction/is);
}

function testInitLoopRuntimeErrorGatesInitialized() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({initLoop: 'missingInitLoopAction();'}));

  assert.equal(page.context._simHandleInit(), true);
  page.runIntervals();
  assertStopped(page, 'an init_loop() runtime failure must reset the shared lifecycle');
  assert.match(telemetryText(page), /init_loop\(\) runtime error.*missingInitLoopAction/is);
}

function testLifecycleTelemetryFramesFlushAutomatically() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({
    initLoop: 'telemetry.addData("Phase", "init loop visible");',
    start: 'telemetry.addData("Phase", "start visible");',
  }));

  assert.equal(page.context._simHandleInit(), true);
  page.runIntervals();
  assert.match(
    telemetryText(page),
    /Phase.*init loop visible/is,
    'init_loop telemetry.addData() should render after that lifecycle frame',
  );

  assert.equal(page.context._simHandleStart(), true);
  assert.match(
    telemetryText(page),
    /Phase.*start visible/is,
    'start telemetry.addData() should render after that lifecycle frame',
  );
}

function testLoopRuntimeErrorStopsExecution() {
  const page = createBaseHarness();
  installStudentSource(page, iterativeSource({loop: 'missingLoopAction();'}));

  assert.equal(page.context._simHandleInit(), true);
  assert.equal(page.context._simHandleStart(), true);
  page.runIntervals();
  assertStopped(page, 'a loop() runtime failure must stop shared execution');
  assert.match(telemetryText(page), /loop\(\) runtime error.*missingLoopAction/is);
}

function testStarterCodeCanAlwaysBeRecovered() {
  const page = createBaseHarness();
  const editor = page.context.document.getElementById('sim-code-editor');

  page.context.setCode('public class Starter {}');
  editor.value = '';

  assert.equal(page.context.resetCodeToStarter(), true);
  assert.equal(editor.value, 'public class Starter {}');
  assert.deepEqual([editor.selectionStart, editor.selectionEnd], [0, 0]);
}

function testResetUsesAnInSimulatorConfirmationDialog() {
  assert.doesNotMatch(
    simulatorBaseSource,
    /window\.confirm\s*\(/,
    'reset must not use the browser-native confirmation prompt',
  );
  assert.match(simulatorBaseSource, /id:\s*"sim-reset-dialog-backdrop"/);
  assert.match(simulatorBaseSource, /aria-modal/);
  assert.match(simulatorBaseSource, /Restore starter code/);
  assert.match(simulatorBaseSource, /id:\s*"sim-scene-reset-btn"/);
  assert.match(simulatorBaseSource, /Reset robot/);
  assert.match(simulatorBaseSource, /__telemarkMasteryMotion\.resetPose\(\)/);
  assert.match(simulatorBaseSource, /id:\s*"sim-code-reset-btn"/);
  assert.match(simulatorBaseSource, /Reset code/);
}

testCompileErrorGatesInit();
testMissingCompilerFailsClosed();
testStudentOnlyTelemetryRoutesDiagnosticsToHints();
testFtcHardwareRegistrySupportsChallengeDevices();
testSharedBatteryAndDcMotorExPhysics();
testFullSourceGateRejectsUnusedMalformedMethodAndRetries();
testCompileErrorCleansPageStateForRetry();
testResetRuntimeBindingAndStartContinuation();
testStartRuntimeErrorGatesRunning();
testInitLoopRuntimeErrorGatesInitialized();
testLifecycleTelemetryFramesFlushAutomatically();
testLoopRuntimeErrorStopsExecution();
testStarterCodeCanAlwaysBeRecovered();
testResetUsesAnInSimulatorConfirmationDialog();
console.log('Shared simulator lifecycle regression tests passed.');
