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

function lastInlineScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  return scripts.at(-1);
}

function createUnit2Harness() {
  const elements = new Map();
  const intervals = new Map();
  const windowListeners = new Map();
  const reportedErrors = [];
  let nextInterval = 1;
  let installedGamepadState = null;

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
    let html = '';
    let text = '';
    const value = {
      id,
      value: '',
      get textContent() { return text; },
      set textContent(next) {
        text = String(next);
        html = '';
      },
      get innerHTML() { return html; },
      set innerHTML(next) {
        html = String(next);
        text = '';
      },
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
      getBoundingClientRect() {
        return {left: 0, top: 0, width: 400, height: 250, right: 400, bottom: 250};
      },
    };
    elements.set(id, value);
    return value;
  }

  const document = {
    getElementById: element,
    addEventListener() {},
  };
  const context = {
    console: {
      ...console,
      error(...args) { reportedErrors.push(args); },
    },
    document,
    location: {search: ''},
    innerWidth: 1200,
    innerHeight: 800,
    URLSearchParams,
    TelemarkEditor: {attach() {}},
    Prism: {highlightElement() {}},
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
    compileStudentSource: (...args) => context.TelemarkJava.compile(...args),
    createRuntime: (...args) => context.TelemarkJava.createRuntime(...args),
    installLegacy(options) {
      installedGamepadState = options.state;
      return {state: installedGamepadState};
    },
  };
  vm.runInContext(
    lastInlineScript(path.join(simulatorRoot, 'unit2.html')),
    context,
    {filename: 'unit2.html'},
  );

  assert.ok(installedGamepadState, 'unit2 must pass its live gamepad state to simulator_base');
  return {
    context,
    elements,
    intervals,
    reportedErrors,
    gamepad: installedGamepadState,
    runIntervals() {
      for (const callback of [...intervals.values()]) callback();
    },
  };
}

function lifecycleSource(startBody, methods = {}) {
  return `
    @Autonomous(name="Lifecycle_Regression")
    public class LifecycleRegression extends OpMode {
      int starts = 0;

      @Override
      public void init() {
        ${methods.init || 'telemetry.addData("Status", "Initialized");'}
      }

      ${methods.initLoop === undefined ? '' : `
      @Override
      public void init_loop() {
        ${methods.initLoop}
      }`}

      @Override
      public void start() {
        ${startBody}
      }

      @Override
      public void loop() {
        ${methods.loop || 'telemetry.addData("Status", "Running");'}
      }
    }
  `;
}

function visibleTelemetry(page) {
  const telemetry = page.elements.get('telemetry-log');
  return `${telemetry.textContent}\n${telemetry.innerHTML}`;
}

function pageValue(page, expression) {
  return vm.runInContext(expression, page.context);
}

function testEditedStartBodyExecutes() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource(`
    starts++;
    resetRuntime();
    telemetry.addData("Start", "Custom body ran");
  `);

  assert.doesNotThrow(() => sim.handleMainButton(), 'Init must compile an edited lifecycle');
  assert.equal(pageValue(page, 'currentState'), 'INIT_LOOP');
  assert.equal(page.elements.get('btn-main').textContent, 'START');

  assert.doesNotThrow(
    () => sim.handleMainButton(),
    'Start must execute a student-authored body, including resetRuntime()',
  );
  assert.equal(pageValue(page, 'currentState'), 'RUNNING');
  assert.equal(
    pageValue(page, 'telemarkCompiledProgram.scope.starts'),
    1,
    'start() must run exactly once',
  );
  assert.match(visibleTelemetry(page), /Custom body ran/);
}

function testEditedStartSyntaxErrorIsVisible() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource('starts++;');

  sim.handleMainButton();
  assert.equal(pageValue(page, 'currentState'), 'INIT_LOOP');

  page.elements.get('code-editor').value = lifecycleSource('int broken = ;');
  assert.doesNotThrow(
    () => sim.handleMainButton(),
    'a compile error on Start must be rendered instead of escaping the click handler',
  );
  assert.equal(
    pageValue(page, 'currentState'),
    'INIT_LOOP',
    'a failed Start must remain initialized and allow the student to retry',
  );
  assert.equal(page.elements.get('btn-main').textContent, 'START');
  assert.match(visibleTelemetry(page), /start\(\) compile error|Unexpected token/i);

  page.elements.get('code-editor').value = lifecycleSource(`
    starts++;
    telemetry.addData("Start", "Retry succeeded");
  `);
  sim.handleMainButton();
  assert.equal(pageValue(page, 'currentState'), 'RUNNING', 'corrected code must be retryable');
  assert.match(visibleTelemetry(page), /Retry succeeded/);
  assert.doesNotMatch(visibleTelemetry(page), /compile error|Unexpected token/i);
}

function testInitSyntaxErrorDoesNotAdvance() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource('int broken = ;');

  assert.doesNotThrow(() => sim.handleMainButton());
  assert.equal(
    pageValue(page, 'currentState'),
    'STOPPED',
    'an OpMode that failed to compile must not enter INIT_LOOP',
  );
  assert.match(visibleTelemetry(page), /compile error|Unexpected token/i);
}

function testEditedStartRuntimeErrorIsVisible() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource('starts++;');

  sim.handleMainButton();
  assert.equal(pageValue(page, 'currentState'), 'INIT_LOOP');

  page.elements.get('code-editor').value = lifecycleSource('resetRuntime(); missingRobotAction();');
  assert.doesNotThrow(
    () => sim.handleMainButton(),
    'a runtime error on Start must be rendered instead of escaping the click handler',
  );
  assert.equal(
    pageValue(page, 'currentState'),
    'INIT_LOOP',
    'a failed Start must not enter the running phase',
  );
  assert.match(visibleTelemetry(page), /missingRobotAction|runtime error|not defined/i);
  assert.equal(page.reportedErrors.length, 1, 'runtime failures should also reach the console');
  assert.equal(pageValue(page, 'runtimeOffset'), 0, 'a failed start() must not leave its timer running');
}

function testInitLoopRuntimeErrorResetsLifecycle() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource('starts++;', {
    initLoop: 'missingInitLoopAction();',
  });

  sim.handleMainButton();
  assert.equal(pageValue(page, 'currentState'), 'INIT_LOOP');
  page.runIntervals();

  assert.equal(
    pageValue(page, 'currentState'),
    'STOPPED',
    'an init_loop() runtime failure must stop and reset Unit 2',
  );
  assert.equal(page.elements.get('btn-main').textContent, 'INIT');
  assert.equal(page.elements.get('btn-main').disabled, false);
  assert.match(visibleTelemetry(page), /init_loop\(\).*missingInitLoopAction/is);
}

function testLoopRuntimeErrorResetsLifecycle() {
  const page = createUnit2Harness();
  const sim = page.context;
  page.elements.get('code-editor').value = lifecycleSource('starts++;', {
    loop: 'missingLoopAction();',
  });

  sim.handleMainButton();
  sim.handleMainButton();
  assert.equal(pageValue(page, 'currentState'), 'RUNNING');
  page.runIntervals();

  assert.equal(
    pageValue(page, 'currentState'),
    'STOPPED',
    'a loop() runtime failure must stop and reset Unit 2',
  );
  assert.equal(page.elements.get('btn-main').textContent, 'INIT');
  assert.equal(page.elements.get('btn-main').disabled, false);
  assert.match(visibleTelemetry(page), /loop\(\).*missingLoopAction/is);
}

testEditedStartBodyExecutes();
testEditedStartSyntaxErrorIsVisible();
testInitSyntaxErrorDoesNotAdvance();
testEditedStartRuntimeErrorIsVisible();
testInitLoopRuntimeErrorResetsLifecycle();
testLoopRuntimeErrorResetsLifecycle();
console.log('Unit 2 editable lifecycle regression tests passed.');
