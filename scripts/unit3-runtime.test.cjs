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

function createUnit3Harness() {
  const elements = new Map();
  const intervals = new Map();
  const windowListeners = new Map();
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

  function makeStyle() {
    return {
      setProperty(name, value) { this[name] = String(value); },
      removeProperty(name) { delete this[name]; },
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
      innerText: '',
      className: '',
      disabled: false,
      scrollTop: 0,
      scrollLeft: 0,
      offsetWidth: 400,
      offsetHeight: 250,
      selectionStart: 0,
      selectionEnd: 0,
      style: makeStyle(),
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
    console,
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
    lastInlineScript(path.join(simulatorRoot, 'unit3.html')),
    context,
    {filename: 'unit3.html'},
  );

  assert.ok(installedGamepadState, 'unit3 must pass its live gamepad state to simulator_base');
  return {context, elements, gamepad: installedGamepadState};
}

function startIterativeOpMode(page, source) {
  page.elements.get('code-editor').value = source;
  page.context.runStaticAnalysis();
  page.context.handleMainButton();
  page.context.handleMainButton();
  assert.equal(vm.runInContext('currentState', page.context), 'RUNNING');
}

function assertInspectorValue(page, name, expected) {
  const html = page.elements.get('var-list').innerHTML;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    html,
    new RegExp(
      `<span class="var-name">${escapedName}</span>`
      + `<span class="var-val">${escapedValue}</span>`,
    ),
    `expected ${name} to render as ${expected}; inspector was ${html}`,
  );
}

function testBooleanLocalTracksButtonAcrossLoopTicks() {
  const page = createUnit3Harness();
  startIterativeOpMode(page, `
    @TeleOp(name="Button_Capture_Challenge")
    public class ButtonCapture extends OpMode {
      public void init() {}

      public void loop() {
        boolean buttonState = gamepad1.a;
        telemetry.addData("Button A Pressed", buttonState);
      }
    }
  `);

  page.context.executeMethod('loop');
  assertInspectorValue(page, 'buttonState', 'false');

  page.gamepad.a = true;
  page.context.executeMethod('loop');
  assertInspectorValue(page, 'buttonState', 'true');

  page.gamepad.a = false;
  page.context.executeMethod('loop');
  assertInspectorValue(page, 'buttonState', 'false');
}

function testDynamicPowerLocalsTrackStickAndBumperAcrossLoopTicks() {
  const page = createUnit3Harness();
  startIterativeOpMode(page, `
    @TeleOp(name="Precision_Mode_Challenge")
    public class PrecisionMode extends OpMode {
      DcMotor motor;
      double scaleFactor = 0.5;

      public void init() {
        motor = hardwareMap.get(DcMotor.class, "motor");
      }

      public void loop() {
        double input = -gamepad1.left_stick_y;
        double finalPower;
        if (gamepad1.left_bumper) {
          finalPower = input * scaleFactor;
        } else {
          finalPower = input;
        }
        motor.setPower(finalPower);
      }
    }
  `);

  vm.runInContext('gamepad.leftStickY = -0.8', page.context);
  page.context.executeMethod('loop');
  assertInspectorValue(page, 'input', '0.80');
  assertInspectorValue(page, 'finalPower', '0.80');

  page.gamepad.left_bumper = true;
  page.context.executeMethod('loop');
  assertInspectorValue(page, 'input', '0.80');
  assertInspectorValue(page, 'finalPower', '0.40');

  page.gamepad.left_bumper = false;
  page.context.executeMethod('loop');
  assertInspectorValue(page, 'input', '0.80');
  assertInspectorValue(page, 'finalPower', '0.80');
}

testBooleanLocalTracksButtonAcrossLoopTicks();
testDynamicPowerLocalsTrackStickAndBumperAcrossLoopTicks();
console.log('Unit 3 live variable inspector regression tests passed.');
