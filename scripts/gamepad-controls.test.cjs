const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GamepadControls = require('../static/simulator/gamepad-controls.js');
const TelemarkJava = require('../static/simulator/telemark-java.js');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  dispatch(type, event = {}) {
    event.type = type;
    for (const listener of [...(this.listeners.get(type) || [])]) {
      listener.call(this, event);
    }
    return event;
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const enabled = force === undefined ? !this.values.has(name) : Boolean(force);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.className = '';
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.id = '';
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  querySelector(selector) {
    if (selector === '[data-telemark-gamepad-legend]') {
      return this.children.find(
        (child) => child.getAttribute('data-telemark-gamepad-legend') === 'true',
      ) || null;
    }
    if (selector.includes('trigger-fill')) {
      return this.children.find((child) => /trigger-fill/.test(child.className)) || null;
    }
    if (selector.includes('stick-knob')) {
      return this.children.find((child) => /stick-knob/.test(child.className)) || null;
    }
    return null;
  }

  querySelectorAll() {
    return [];
  }

  closest() {
    return null;
  }

  setPointerCapture() {}

  getBoundingClientRect() {
    return {left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100};
  }
}

class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.hidden = false;
    this.visibilityState = 'visible';
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return [...this.head.children, ...this.body.children].find(
      (element) => element.id === id,
    ) || null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function keyboardEvent(code, target = new FakeElement('div')) {
  return {
    code,
    target,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

function testUmdExports() {
  assert.equal(GamepadControls.CANONICAL_INPUTS.length, 18);
  assert.equal(new Set(GamepadControls.CANONICAL_INPUTS).size, 18);
  assert.equal(GamepadControls.KEY_BINDINGS.buttons.KeyA, 'a');
  assert.equal(GamepadControls.KEY_BINDINGS.buttons.KeyQ, 'left_bumper');
  assert.equal(GamepadControls.KEY_BINDINGS.buttons.ArrowRight, 'dpad_right');
  assert.equal(GamepadControls.KEY_BINDINGS.buttons.Enter, 'start');
  assert.equal(GamepadControls.KEY_BINDINGS.buttons.Backspace, 'back');
  assert.equal(GamepadControls.KEY_BINDINGS.triggers.KeyZ, 'left_trigger');
  assert.deepEqual(
    GamepadControls.KEY_BINDINGS.axes.left_stick_y,
    {negative: 'KeyT', positive: 'KeyG'},
  );

  const source = fs.readFileSync(
    path.resolve(__dirname, '../static/simulator/gamepad-controls.js'),
    'utf8',
  );
  const browserContext = {};
  vm.createContext(browserContext);
  vm.runInContext(source, browserContext, {filename: 'gamepad-controls.js'});
  assert.equal(typeof browserContext.TelemarkGamepadControls.install, 'function');
  assert.match(source, /\.telemark-gp-added-dpad\.up \{ left: 18\.8%; top: 29%; \}/);
  assert.match(source, /\.telemark-gp-added-dpad\.down \{ left: 18\.8%; top: 45%; \}/);
  assert.match(source, /\.telemark-gp-added-dpad\.left \{ left: 13\.5%; top: 37%; \}/);
  assert.match(source, /\.telemark-gp-added-dpad\.right \{ left: 24\.1%; top: 37%; \}/);
}

function testPureKeyboardReducer() {
  const state = GamepadControls.computeKeyboardState(new Set([
    'KeyA',
    'KeyY',
    'KeyQ',
    'ArrowUp',
    'Enter',
    'KeyZ',
    'KeyT',
    'KeyF',
    'KeyI',
    'KeyL',
  ]));

  assert.equal(state.a, true);
  assert.equal(state.y, true);
  assert.equal(state.left_bumper, true);
  assert.equal(state.dpad_up, true);
  assert.equal(state.start, true);
  assert.equal(state.left_trigger, 1);
  assert.equal(state.left_stick_x, -1);
  assert.equal(state.left_stick_y, -1, 'FTC stick-up must be -1');
  assert.equal(state.right_stick_x, 1);
  assert.equal(state.right_stick_y, -1, 'FTC stick-up must be -1');

  const opposing = GamepadControls.computeKeyboardState([
    'KeyF', 'KeyH', 'KeyT', 'KeyG', 'KeyJ', 'KeyL', 'KeyI', 'KeyK',
  ]);
  assert.equal(opposing.left_stick_x, 0);
  assert.equal(opposing.left_stick_y, 0);
  assert.equal(opposing.right_stick_x, 0);
  assert.equal(opposing.right_stick_y, 0);

  const objectHeld = GamepadControls.computeKeyboardState({KeyB: true, KeyC: true});
  assert.equal(objectHeld.b, true);
  assert.equal(objectHeld.right_trigger, 1);
}

function testCamelCaseNormalization() {
  const legacy = {
    leftStickX: 0.25,
    leftStickY: -0.5,
    rightStickX: 0.75,
    rightStickY: 1,
    a: false,
  };
  const normalized = GamepadControls.normalizeState(legacy);

  assert.equal(normalized.left_stick_x, 0.25);
  assert.equal(normalized.left_stick_y, -0.5);
  normalized.right_stick_y = -1;
  assert.equal(legacy.rightStickY, -1, 'canonical writes must update legacy state');

  GamepadControls.setInputValue(legacy, 'left_stick_x', -5);
  assert.equal(legacy.leftStickX, -1, 'axes must clamp to -1..1');
  GamepadControls.setInputValue(legacy, 'left_trigger', 5);
  assert.equal(legacy.left_trigger, 1, 'triggers must clamp to 0..1');
  assert.equal(GamepadControls.CANONICAL_INPUTS.every((input) => input in legacy), true);
}

function testEditableDetection() {
  assert.equal(GamepadControls.isEditableTarget(new FakeElement('textarea')), true);
  assert.equal(GamepadControls.isEditableTarget(new FakeElement('input')), true);
  assert.equal(GamepadControls.isEditableTarget(new FakeElement('select')), true);

  const editable = new FakeElement('div');
  editable.isContentEditable = true;
  assert.equal(GamepadControls.isEditableTarget(editable), true);

  const codeMirrorChild = new FakeElement('span');
  codeMirrorChild.closest = (selector) => selector.includes('.CodeMirror') ? {} : null;
  assert.equal(GamepadControls.isEditableTarget(codeMirrorChild), true);
  assert.equal(GamepadControls.isEditableTarget(new FakeElement('button')), false);
}

function testFallbackOverlaySynthesis() {
  const document = new FakeDocument();
  const controller = new FakeElement('div');
  const controls = new Map(
    GamepadControls.CANONICAL_INPUTS.map((input) => [input, []]),
  );

  const added = GamepadControls.ensureControlOverlays(document, controller, controls);
  assert.equal(added.length, 16, 'two stick overlays jointly cover four axes');
  assert.equal(controller.children.length, 16);
  assert.equal(
    GamepadControls.CANONICAL_INPUTS.every((input) => controls.get(input).length > 0),
    true,
    'fallback overlays must cover every canonical input',
  );
  assert.equal(
    added.some((element) => element.getAttribute('data-gp-input') === 'left_stick_x,left_stick_y'),
    true,
  );
  assert.equal(
    added.find((element) => element.getAttribute('data-gp-input') === 'left_trigger').children.length,
    1,
    'a synthesized trigger needs a visible fill element',
  );

  const secondPass = GamepadControls.ensureControlOverlays(document, controller, controls);
  assert.equal(secondPass.length, 0, 'overlay synthesis must be idempotent for one control map');
}

function testInstalledKeyboardLifecycleAndLegend() {
  const document = new FakeDocument();
  const eventTarget = new FakeEventTarget();
  const legendContainer = new FakeElement('div');
  const aControl = new FakeElement('div');
  const bControl = new FakeElement('div');
  const leftBumperControl = new FakeElement('div');
  const state = GamepadControls.createNeutralState();
  const controller = GamepadControls.install({
    state,
    document,
    eventTarget,
    legendContainer,
    elementMap: {
      a: aControl,
      b: bControl,
      left_bumper: leftBumperControl,
    },
    discoverControls: false,
    addMissingOverlays: false,
    injectStyles: false,
    pointer: false,
  });

  assert.equal(legendContainer.children.length, 1);
  assert.equal(controller.legend.innerHTML, GamepadControls.LEGEND_HTML);
  assert.match(controller.legend.getAttribute('aria-label'), /Left stick.*T.*F.*G.*H/);

  const aDown = eventTarget.dispatch('keydown', keyboardEvent('KeyA'));
  eventTarget.dispatch('keydown', keyboardEvent('KeyB'));
  assert.equal(aDown.defaultPrevented, true);
  assert.equal(state.a, true);
  assert.equal(state.b, true, 'multiple held face keys must remain active together');
  assert.equal(aControl.classList.contains('pressed'), true);
  assert.equal(bControl.classList.contains('pressed'), true);

  eventTarget.dispatch('keyup', keyboardEvent('KeyA'));
  assert.equal(state.a, false);
  assert.equal(state.b, true, 'releasing one key must preserve other held keys');

  eventTarget.dispatch('keydown', keyboardEvent('KeyT'));
  assert.equal(state.left_stick_y, -1);
  eventTarget.dispatch('keydown', keyboardEvent('KeyG'));
  assert.equal(state.left_stick_y, 0, 'opposing directions cancel');
  eventTarget.dispatch('keyup', keyboardEvent('KeyG'));
  assert.equal(state.left_stick_y, -1, 'releasing one opposite restores the other');

  const editor = new FakeElement('textarea');
  const ignored = eventTarget.dispatch('keydown', keyboardEvent('KeyQ', editor));
  assert.equal(state.left_bumper, false, 'editor keydown must not drive the gamepad');
  assert.equal(ignored.defaultPrevented, false);

  eventTarget.dispatch('keydown', keyboardEvent('KeyQ'));
  assert.equal(state.left_bumper, true);
  eventTarget.dispatch('keyup', keyboardEvent('KeyQ', editor));
  assert.equal(
    state.left_bumper,
    false,
    'keyup must release even when focus moved into the editor',
  );

  eventTarget.dispatch('keydown', keyboardEvent('KeyZ'));
  eventTarget.dispatch('keydown', keyboardEvent('ArrowRight'));
  eventTarget.dispatch('blur');
  assert.equal(state.left_trigger, 0);
  assert.equal(state.dpad_right, false);
  assert.equal(state.b, false);
  assert.equal(state.left_stick_y, 0);
  assert.equal(controller.heldCodes.size, 0);

  eventTarget.dispatch('keydown', keyboardEvent('KeyE'));
  assert.equal(state.right_bumper, true);
  document.hidden = true;
  document.visibilityState = 'hidden';
  document.dispatch('visibilitychange');
  assert.equal(state.right_bumper, false, 'hidden documents must clear held controls');

  controller.destroy();
  eventTarget.dispatch('keydown', keyboardEvent('KeyA'));
  assert.equal(state.a, false, 'destroy must detach keyboard listeners');
}

function testLegacyDpadBecomesPointerInteractive() {
  const document = new FakeDocument();
  const eventTarget = new FakeEventTarget();
  const state = GamepadControls.createNeutralState();
  const dpadContainer = new FakeElement('div');
  dpadContainer.className = 'dpad-container';
  dpadContainer.style.pointerEvents = 'none';
  const dpadUp = dpadContainer.appendChild(new FakeElement('div'));

  const installed = GamepadControls.install({
    state,
    document,
    eventTarget,
    elementMap: {dpad_up: dpadUp},
    discoverControls: false,
    addMissingOverlays: false,
    injectStyles: false,
    legend: false,
  });

  assert.equal(dpadUp.style.pointerEvents, 'auto');
  assert.equal(dpadUp.classList.contains('telemark-gp-control-enabled'), true);
  assert.equal(dpadContainer.style.pointerEvents, 'auto');

  dpadUp.dispatch('pointerdown', {
    pointerId: 1,
    preventDefault() {},
  });
  assert.equal(state.dpad_up, true);
  dpadUp.dispatch('pointerup', {pointerId: 1});
  assert.equal(state.dpad_up, false);
  installed.destroy();
}

function testPointerStickSnapbackAndArrowVisuals() {
  const document = new FakeDocument();
  const eventTarget = new FakeEventTarget();
  const state = GamepadControls.createNeutralState();
  const stick = new FakeElement('div');
  const knob = stick.appendChild(new FakeElement('div'));
  knob.className = 'sim-stick-knob';
  const dpadUp = new FakeElement('div');
  dpadUp.className = 'dpad-btn dpad-up';

  const installed = GamepadControls.install({
    state,
    document,
    eventTarget,
    elementMap: {
      left_stick_x: stick,
      left_stick_y: stick,
      dpad_up: dpadUp,
    },
    discoverControls: false,
    addMissingOverlays: false,
    injectStyles: false,
    legend: false,
  });

  stick.dispatch('pointerdown', {
    pointerId: 7,
    clientX: 88,
    clientY: 12,
    preventDefault() {},
  });
  assert.ok(state.left_stick_x > 0.7);
  assert.ok(state.left_stick_y < -0.7, 'pointer-up must use FTC-negative Y');
  assert.notEqual(knob.style.left, '50%');

  stick.dispatch('lostpointercapture', {pointerId: 7});
  assert.equal(state.left_stick_x, 0);
  assert.equal(state.left_stick_y, 0);
  assert.equal(knob.style.left, '50%');
  assert.equal(knob.style.top, '50%');

  eventTarget.dispatch('keydown', keyboardEvent('ArrowUp'));
  assert.equal(state.dpad_up, true);
  assert.equal(dpadUp.classList.contains('pressed'), true, 'arrow keys need visible pressed state');
  eventTarget.dispatch('blur');
  assert.equal(state.dpad_up, false);
  assert.equal(dpadUp.classList.contains('pressed'), false);

  installed.destroy();
}

function testUnit82UsesFtcYAxisExactlyOnce() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../static/simulator/unit8.2.html'),
    'utf8',
  );
  const controlsScript = source.indexOf('<script src="./gamepad-controls.js"></script>');
  const baseScript = source.indexOf('<script src="./simulator_base.js" data-telemark-mode="legacy"></script>');
  const legacyInstall = source.indexOf('window.TelemarkSimulatorBase.installLegacy({');

  assert.ok(controlsScript >= 0 && controlsScript < baseScript && baseScript < legacyInstall);
  assert.equal(
    (source.match(/TelemarkSimulatorBase\.installLegacy\(/g) || []).length,
    1,
    'Unit 8.2 must install one shared gamepad owner',
  );
  assert.doesNotMatch(
    source,
    /function\s+(?:setupStick|updateStickFromPointer)\b/,
    'Unit 8.2 must not add a second lesson-specific stick transform',
  );

  const starterMatch = source.match(
    /<textarea id="code-editor"[^>]*>([\s\S]*?)<\/textarea>/,
  );
  assert.ok(starterMatch, 'Unit 8.2 starter Java must be present');

  const document = new FakeDocument();
  const eventTarget = new FakeEventTarget();
  const state = {left_stick_x: 0, left_stick_y: 0, right_stick_x: 0};
  const stick = new FakeElement('div');
  const observedY = [];
  const controls = GamepadControls.install({
    state,
    document,
    eventTarget,
    elementMap: {
      left_stick_x: stick,
      left_stick_y: stick,
    },
    discoverControls: false,
    addMissingOverlays: false,
    injectStyles: false,
    legend: false,
    onInput(gamepad) {
      observedY.push(gamepad.left_stick_y);
    },
  });

  const motorPowers = new Map();
  const runtime = TelemarkJava.createRuntime({
    gamepad1: state,
    onPower(power, device) {
      motorPowers.set(device.name, power);
    },
  });
  const program = TelemarkJava.compile(starterMatch[1], runtime);
  assert.equal(program.ok, true, program.diagnostics?.[0]?.message);
  program.methods.init();

  stick.dispatch('pointerdown', {
    pointerId: 82,
    clientX: 50,
    clientY: 0,
    preventDefault() {},
  });
  assert.equal(state.left_stick_y, -1, 'Unit 8.2 stick-up must reach gamepad1 as -1');
  assert.equal(observedY.at(-1), -1, 'Unit 8.2 readout must display stick-up as -1');
  program.methods.loop();
  assert.deepEqual(
    [...motorPowers.values()],
    [1, 1, 1, 1],
    'the starter Java must negate FTC Y once to command positive forward power',
  );

  stick.dispatch('pointerup', {pointerId: 82});
  stick.dispatch('pointerdown', {
    pointerId: 83,
    clientX: 50,
    clientY: 100,
    preventDefault() {},
  });
  assert.equal(state.left_stick_y, 1, 'Unit 8.2 stick-down must reach gamepad1 as +1');
  assert.equal(observedY.at(-1), 1, 'Unit 8.2 readout must display stick-down as +1');
  program.methods.loop();
  assert.deepEqual(
    [...motorPowers.values()],
    [-1, -1, -1, -1],
    'the starter Java must negate FTC Y once to command negative reverse power',
  );

  controls.destroy();
}

function testEverySimulatorUsesFtcYAxisSign() {
  const simulatorRoot = path.resolve(__dirname, '../static/simulator');
  const simulatorSources = fs.readdirSync(simulatorRoot)
    .filter((name) => name.endsWith('.html'))
    .map((name) => fs.readFileSync(path.join(simulatorRoot, name), 'utf8'))
    .join('\n');

  assert.doesNotMatch(
    simulatorSources,
    /(?:left|right)_stick_y\s*=\s*-sy/,
    'legacy simulators must not invert an already-normalized stick Y value',
  );
  assert.doesNotMatch(
    simulatorSources,
    /setValues\([^\n]*-c(?:lampedD|d)y/,
    'pointer-up must remain negative throughout legacy simulator paths',
  );
  assert.doesNotMatch(
    simulatorSources,
    /\bny\s*=\s*-\s*dy\s*\//,
    'legacy joystick helpers must not negate screen-space Y',
  );
  assert.doesNotMatch(
    simulatorSources,
    /\bset\([^\n;]*,\s*Math\.max\([^\n;]*-\s*dy\s*\//,
    'legacy compact joystick helpers must pass screen-space Y through once',
  );
  const simulatorBase = fs.readFileSync(path.join(simulatorRoot, 'simulator_base.js'), 'utf8');
  assert.match(simulatorBase, /const ny = Math\.max\(-1, Math\.min\(1, dy \/ maxR\)\)/, 'the Unit 13 controller must report pointer-up as negative Y');
  assert.doesNotMatch(simulatorBase, /const ny = Math\.max\(-1, Math\.min\(1, -dy \/ maxR\)\)/, 'the base controller must not negate the normalized Y axis');
  assert.match(simulatorBase, /TelemarkGamepadControls\.install\(\{[\s\S]*?state: window\.gamepad,[\s\S]*?pointer: false/, 'the shared control layer must not install a second pointer handler');

  const challenge = fs.readFileSync(path.join(simulatorRoot, 'mastery_challenge.js'), 'utf8');
  assert.doesNotMatch(challenge, /global\.gamepad\.(?:left|right)_stick_y\s*=\s*-/, 'the challenge must pass the already-normalized FTC Y axis through unchanged');
}

function testInputCallbackFailureDoesNotAbortInstall() {
  const document = new FakeDocument();
  const eventTarget = new FakeEventTarget();
  const state = GamepadControls.createNeutralState();
  let reportedErrors = 0;

  const installed = GamepadControls.install({
    state,
    document,
    eventTarget,
    globalObject: {
      console: {
        error() {
          reportedErrors += 1;
        },
      },
    },
    discoverControls: false,
    addMissingOverlays: false,
    injectStyles: false,
    legend: false,
    pointer: false,
    onInput() {
      throw new Error('missing optional lesson readout');
    },
  });

  assert.equal(reportedErrors, 1, 'the failed initial readout must be reported');
  eventTarget.dispatch('keydown', keyboardEvent('ArrowLeft'));
  assert.equal(state.dpad_left, true, 'a failed readout must not prevent keyboard installation');
  assert.equal(installed.heldCodes.has('ArrowLeft'), true);
  installed.destroy();
}

testUmdExports();
testPureKeyboardReducer();
testCamelCaseNormalization();
testEditableDetection();
testFallbackOverlaySynthesis();
testInstalledKeyboardLifecycleAndLegend();
testLegacyDpadBecomesPointerInteractive();
testPointerStickSnapbackAndArrowVisuals();
testUnit82UsesFtcYAxisExactlyOnce();
testEverySimulatorUsesFtcYAxisSign();
testInputCallbackFailureDoesNotAbortInstall();

console.log('Gamepad controls tests passed');
