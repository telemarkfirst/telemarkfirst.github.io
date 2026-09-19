const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const telemarkJavaSource = fs.readFileSync(
  path.join(repoRoot, 'static/simulator/telemark-java.js'),
  'utf8',
);

function lastInlineScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  return scripts.at(-1);
}

function initialEditorSource(file) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<textarea id="code-editor"[\s\S]*?>([\s\S]*?)<\/textarea>/);
  assert.ok(match, `expected starter code in ${file}`);
  return match[1];
}

function createPageHarness(relativeFile) {
  const elements = new Map();
  const intervals = new Map();
  let nextInterval = 1;

  function makeClassList() {
    const values = new Set();
    return {
      add(...names) { names.forEach((name) => values.add(name)); },
      remove(...names) { names.forEach((name) => values.delete(name)); },
      toggle(name, force) {
        const enabled = force === undefined ? !values.has(name) : Boolean(force);
        if (enabled) values.add(name);
        else values.delete(name);
        return enabled;
      },
      contains(name) { return values.has(name); },
    };
  }

  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const listeners = new Map();
    const value = {
      id,
      value: id === 'speed-slider' ? '5' : '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      scrollTop: 0,
      scrollLeft: 0,
      scrollHeight: 0,
      offsetWidth: 400,
      offsetHeight: 250,
      selectionStart: 0,
      selectionEnd: 0,
      style: {},
      dataset: {},
      classList: makeClassList(),
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatchEvent(event) {
        for (const listener of listeners.get(event.type) || []) listener.call(value, event);
      },
      setPointerCapture() {},
      appendChild() {},
      removeChild() {},
      querySelector(selector) { return element(`${id}:${selector}`); },
      getBoundingClientRect() {
        return {left: 0, top: 0, width: 400, height: 250, right: 400, bottom: 250};
      },
    getContext() { return {}; },
    };
    elements.set(id, value);
    return value;
  }

  const windowListeners = new Map();
  const document = {
    getElementById: element,
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) { return element(`created:${tag}:${elements.size}`); },
  };
  const context = {
    console,
    document,
    location: {search: ''},
    innerWidth: 1200,
    innerHeight: 800,
    devicePixelRatio: 1,
    URLSearchParams,
    TelemarkEditor: {attach() {}},
    Prism: {highlightElement() {}},
    requestAnimationFrame() { return 0; },
    setTimeout,
    clearTimeout,
    setInterval(callback) {
      const id = nextInterval++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id) { intervals.delete(id); },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(telemarkJavaSource, context, {filename: 'telemark-java.js'});
  context.TelemarkSimulatorBase = {
    compileStudentSource: (source, runtime, options) => {
      const editor=element('code-editor');
      return context.TelemarkJava.compile(source===editor.value && editor.__telemarkProject ? editor.__telemarkProject.source() : source, runtime, options);
    },
    createRuntime: (...args) => context.TelemarkJava.createRuntime(...args),
    installLegacy() {},
  };
  vm.runInContext(fs.readFileSync(path.join(repoRoot, 'static/simulator/telemark-project.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(repoRoot, 'static/simulator/telemark-project-checks.js'), 'utf8'), context);
  const file = path.join(repoRoot, relativeFile);
  vm.runInContext(lastInlineScript(file), context, {filename: file});

  return {
    context,
    elements,
    evaluate(source) { return vm.runInContext(source, context); },
    runInterval(id) {
      assert.ok(intervals.has(id), `expected active interval ${id}`);
      intervals.get(id)();
    },
  };
}

async function testUnit6LifecycleAndCancellation() {
  const page = createPageHarness('static/simulator/unit6.html');
  const sim = page.context;
  sim.currentMode = 'opmode';
  sim.codeEditor.value = `
    @TeleOp(name="Lifecycle")
    public class Lifecycle extends OpMode {
      int initCount = 0;
      int initLoopCount = 0;
      int startCount = 0;
      int loopCountField = 0;
      int stopCount = 0;
      public void init() { initCount++; telemetry.addData("phase", "init"); }
      public void init_loop() { initLoopCount++; }
      public void start() { startCount++; }
      public void loop() { loopCountField++; telemetry.addData("loop", loopCountField); }
      public void stop() { stopCount++; }
    }
  `;

  sim.handleInit();
  assert.equal(sim.simState, 'INIT');
  assert.equal(sim.compiledProgram.scope.initCount, 1);
  page.runInterval(sim.loopIntervalId);
  assert.equal(sim.compiledProgram.scope.initLoopCount, 1);

  sim.handleStart();
  assert.equal(sim.compiledProgram.scope.startCount, 1);
  page.runInterval(sim.loopIntervalId);
  assert.equal(sim.compiledProgram.scope.loopCountField, 1);
  sim.handleStop();
  assert.equal(sim.compiledProgram.scope.stopCount, 1);
  assert.equal(sim.simState, 'STOPPED');

  sim.currentMode = 'linear';
  sim.codeEditor.value = `
    @Autonomous(name="StopSafe")
    public class StopSafe extends LinearOpMode {
      int commandsAfterWait = 0;
      public void runOpMode() {
        waitForStart();
        commandsAfterWait++;
      }
    }
  `;
  sim.handleLinearRun();
  assert.equal(sim.simState, 'WAITING');
  const stoppedProgram = sim.compiledProgram;
  sim.handleStop();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stoppedProgram.scope.commandsAfterWait, 0, 'STOP during waitForStart must not resume student commands');
  assert.equal(sim.simState, 'STOPPED');

  sim.currentMode = 'linear';
  page.elements.get('speed-slider').value = '100';
  sim.codeEditor.value = `
    @Autonomous(name="StopDuringTick")
    public class StopDuringTick extends LinearOpMode {
      int commandsAfterTick = 0;
      public void runOpMode() {
        waitForStart();
        while (opModeIsActive()) {
          commandsAfterTick++;
        }
      }
    }
  `;
  sim.handleLinearRun();
  sim.handleLinearStart();
  const tickingProgram = sim.compiledProgram;
  sim.handleStop();
  await new Promise((resolve) => setTimeout(resolve, 75));
  assert.equal(
    tickingProgram.scope.commandsAfterTick,
    0,
    'STOP during a cooperative tick must cancel the rest of that iteration',
  );
  assert.equal(sim.simState, 'STOPPED');
}

function testUnit7CompiledLifecycle() {
  const page = createPageHarness('static/simulator/unit7.html');
  const sim = page.context;
  sim.codeEditor.value = `
    @TeleOp(name="HardwareLifecycle")
    public class HardwareLifecycle extends OpMode {
      DcMotor motor;
      int initCount = 0;
      int initLoopCount = 0;
      int startCount = 0;
      int loopCount = 0;
      int stopCount = 0;
      public void init() {
        motor = hardwareMap.get(DcMotor.class, "motor");
        initCount++;
      }
      public void init_loop() { initLoopCount++; }
      public void start() { startCount++; }
      public void loop() {
        loopCount++;
        motor.setPower(gamepad1.left_stick_y);
        telemetry.addData("loop", loopCount);
      }
      public void stop() { stopCount++; }
    }
  `;

  sim.handleMainButton();
  assert.equal(sim.currentState, 'INIT_LOOP');
  assert.equal(sim.compiledProgram.scope.initCount, 1);
  page.runInterval(sim.intervalId);
  assert.equal(sim.compiledProgram.scope.initLoopCount, 1);

  sim.handleMainButton();
  assert.equal(sim.compiledProgram.scope.startCount, 1);
  page.runInterval(sim.intervalId);
  assert.equal(sim.compiledProgram.scope.loopCount, 1);
  sim.handleStopButton();
  assert.equal(sim.compiledProgram.scope.stopCount, 1);
  assert.equal(sim.currentState, 'STOPPED');
  assert.match(page.elements.get('telemetry-log').innerHTML, /No telemetry data/);

  const multiPage = createPageHarness('static/simulator/unit7.html');
  const multi = multiPage.context;
  multi.codeEditor.value = '@TeleOp(name="Slide") public class SlideTeleOp extends OpMode { LinearSlide slide = new LinearSlide(); public void init() { slide.init(hardwareMap); } public void loop() { slide.move(gamepad1.left_stick_y); } }';
  const helperSource = 'public class LinearSlide { private DcMotor motor; static final String NAME = "slide_motor"; public void init(HardwareMap hw) { motor = hw.get(DcMotor.class, NAME); } public void move(double speed) { motor.setPower(speed); } }';
  multi.codeEditor.__telemarkProject = {source: () => multi.codeEditor.value + '\n' + helperSource};
  multi.runAnalysis();
  assert.equal(multi.hwDevices[0].configName, 'slide_motor');
  assert.equal(multi.hwDevices[0].inInit, true);
  multi.handleMainButton();
  assert.equal(multi.currentState, 'INIT_LOOP', multiPage.elements.get('telemetry-log').innerHTML);
  multi.handleMainButton();
  multi.gamepad.left_stick_y = 0.6;
  multiPage.runInterval(multi.intervalId);
  assert.equal(multi.compiledRuntime.devices.get('DcMotor:slide_motor').getPower(), 0.6);
  multi.handleStopButton();

  const classLiteralPage = createPageHarness('static/simulator/unit7.html');
  const classLiteral = classLiteralPage.context;
  const classLiteralFiles = [
    {name: 'SlideTeleOp.java', source: 'public class SlideTeleOp extends OpMode { LinearSlide slide; public void init() { slide = hardwareMap.get(LinearSlide.class, "slide"); } public void loop() {} }'},
    {name: 'LinearSlide.java', source: 'public class LinearSlide {}'},
  ];
  classLiteral.codeEditor.value = classLiteralFiles[0].source;
  classLiteral.codeEditor.__telemarkProject = {
    source: () => classLiteral.TelemarkJava.serializeProject(classLiteralFiles),
  };
  classLiteral.handleMainButton();
  assert.equal(
    classLiteral.currentState,
    'STOPPED',
    'a mechanism class cannot be mapped as Robot Controller hardware',
  );
  assert.match(classLiteralPage.elements.get('telemetry-log').innerHTML, /Create it with new LinearSlide\(\)/);
  assert.doesNotMatch(classLiteralPage.elements.get('telemetry-log').innerHTML, /TMProjectClass/);

  const starterPage = createPageHarness('static/simulator/unit7.html');
  const starter = starterPage.context;
  starter.codeEditor.value = initialEditorSource(path.join(repoRoot, 'static/simulator/unit7.html'));
  starter.handleMainButton();
  assert.equal(
    starter.currentState,
    'INIT_LOOP',
    `the IMU/hardware starter must execute through the compiled runtime: ${starterPage.elements.get('telemetry-log').innerHTML}`,
  );
  assert.match(starterPage.elements.get('telemetry-log').innerHTML, /Hardware Mapped/);
  starter.handleStopButton();
}

module.exports = {createPageHarness};
if (require.main === module) (async () => {
  await testUnit6LifecycleAndCancellation();
  testUnit7CompiledLifecycle();
  console.log('Unit 6/7 compiled lifecycle tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
