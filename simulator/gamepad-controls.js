/**
 * Shared keyboard and pointer controls for Telemark's simulated FTC gamepad.
 *
 * The module is intentionally dependency-free and uses UMD so simulator pages
 * can load it with a normal <script> tag while Node regression tests can
 * require() the same implementation.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TelemarkGamepadControls = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CANONICAL_INPUTS = Object.freeze([
    "left_stick_x",
    "left_stick_y",
    "right_stick_x",
    "right_stick_y",
    "left_trigger",
    "right_trigger",
    "a",
    "b",
    "x",
    "y",
    "left_bumper",
    "right_bumper",
    "start",
    "back",
    "dpad_up",
    "dpad_down",
    "dpad_left",
    "dpad_right",
  ]);

  const ANALOG_INPUTS = Object.freeze([
    "left_stick_x",
    "left_stick_y",
    "right_stick_x",
    "right_stick_y",
    "left_trigger",
    "right_trigger",
  ]);

  const BUTTON_INPUTS = Object.freeze(
    CANONICAL_INPUTS.filter(function (input) {
      return ANALOG_INPUTS.indexOf(input) === -1;
    })
  );

  const STATE_ALIASES = Object.freeze({
    left_stick_x: "leftStickX",
    left_stick_y: "leftStickY",
    right_stick_x: "rightStickX",
    right_stick_y: "rightStickY",
    left_trigger: "leftTrigger",
    right_trigger: "rightTrigger",
    left_bumper: "leftBumper",
    right_bumper: "rightBumper",
    dpad_up: "dpadUp",
    dpad_down: "dpadDown",
    dpad_left: "dpadLeft",
    dpad_right: "dpadRight",
  });

  const BUTTON_KEY_BINDINGS = Object.freeze({
    KeyA: "a",
    KeyB: "b",
    KeyX: "x",
    KeyY: "y",
    KeyQ: "left_bumper",
    KeyE: "right_bumper",
    ArrowUp: "dpad_up",
    ArrowDown: "dpad_down",
    ArrowLeft: "dpad_left",
    ArrowRight: "dpad_right",
    Enter: "start",
    Backspace: "back",
  });

  const TRIGGER_KEY_BINDINGS = Object.freeze({
    KeyZ: "left_trigger",
    KeyC: "right_trigger",
  });

  const AXIS_KEY_BINDINGS = Object.freeze({
    left_stick_x: Object.freeze({negative: "KeyF", positive: "KeyH"}),
    left_stick_y: Object.freeze({negative: "KeyT", positive: "KeyG"}),
    right_stick_x: Object.freeze({negative: "KeyJ", positive: "KeyL"}),
    right_stick_y: Object.freeze({negative: "KeyI", positive: "KeyK"}),
  });

  const KEY_BINDINGS = Object.freeze({
    buttons: BUTTON_KEY_BINDINGS,
    triggers: TRIGGER_KEY_BINDINGS,
    axes: AXIS_KEY_BINDINGS,
  });

  const MAPPED_CODES = Object.freeze(
    Array.from(
      new Set(
        Object.keys(BUTTON_KEY_BINDINGS)
          .concat(Object.keys(TRIGGER_KEY_BINDINGS))
          .concat(
            Object.keys(AXIS_KEY_BINDINGS).flatMap(function (axis) {
              const binding = AXIS_KEY_BINDINGS[axis];
              return [binding.negative, binding.positive];
            })
          )
      )
    )
  );
  const MAPPED_CODE_SET = new Set(MAPPED_CODES);

  const CONTROL_SELECTORS = Object.freeze({
    a: Object.freeze([
      '[data-gp-input="a"]',
      "#btn-a",
      "#btn-a-visual",
      ".sim-face-a",
      ".a-btn",
    ]),
    b: Object.freeze([
      '[data-gp-input="b"]',
      "#btn-b",
      ".sim-face-b",
      ".b-btn",
    ]),
    x: Object.freeze([
      '[data-gp-input="x"]',
      "#btn-x",
      ".sim-face-x",
      ".x-btn",
    ]),
    y: Object.freeze([
      '[data-gp-input="y"]',
      "#btn-y",
      ".sim-face-y",
      ".y-btn",
    ]),
    left_bumper: Object.freeze([
      '[data-gp-input="left_bumper"]',
      "#btn-lb",
      "#btn-left-bumper",
      ".sim-bumper-left",
      ".left-bumper-btn",
    ]),
    right_bumper: Object.freeze([
      '[data-gp-input="right_bumper"]',
      "#btn-rb",
      "#btn-right-bumper",
      ".sim-bumper-right",
      ".right-bumper-btn",
    ]),
    start: Object.freeze([
      '[data-gp-input="start"]',
      "#btn-start",
      ".sim-small-start",
      ".start-btn",
    ]),
    back: Object.freeze([
      '[data-gp-input="back"]',
      "#btn-back",
      ".sim-small-back",
      ".back-btn",
    ]),
    dpad_up: Object.freeze([
      '[data-gp-input="dpad_up"]',
      "#dpad-up",
      "#btn-dpad-up",
      ".sim-dpad-image-up",
      ".dpad-up",
    ]),
    dpad_down: Object.freeze([
      '[data-gp-input="dpad_down"]',
      "#dpad-down",
      "#btn-dpad-down",
      ".sim-dpad-image-down",
      ".dpad-down",
    ]),
    dpad_left: Object.freeze([
      '[data-gp-input="dpad_left"]',
      "#dpad-left",
      "#btn-dpad-left",
      ".sim-dpad-image-left",
      ".dpad-left",
    ]),
    dpad_right: Object.freeze([
      '[data-gp-input="dpad_right"]',
      "#dpad-right",
      "#btn-dpad-right",
      ".sim-dpad-image-right",
      ".dpad-right",
    ]),
    left_trigger: Object.freeze([
      '[data-gp-input="left_trigger"]',
      "#left-trigger-slider",
      "#trigger-left",
      ".sim-trigger-image.left",
      ".left-trigger-slider",
    ]),
    right_trigger: Object.freeze([
      '[data-gp-input="right_trigger"]',
      "#right-trigger-slider",
      "#trigger-right",
      ".sim-trigger-image.right",
      ".right-trigger-slider",
    ]),
    left_stick_x: Object.freeze([
      '[data-gp-input*="left_stick_x"]',
      "#sim-joy-zone-left",
      "#stick-zone-left",
      "#stick-left",
      ".sim-stick-left",
      ".stick-zone-left",
    ]),
    left_stick_y: Object.freeze([
      '[data-gp-input*="left_stick_y"]',
      "#sim-joy-zone-left",
      "#stick-zone-left",
      "#stick-left",
      ".sim-stick-left",
      ".stick-zone-left",
    ]),
    right_stick_x: Object.freeze([
      '[data-gp-input*="right_stick_x"]',
      "#sim-joy-zone-right",
      "#stick-zone-right",
      "#stick-right",
      ".sim-stick-right",
      ".stick-zone-right",
    ]),
    right_stick_y: Object.freeze([
      '[data-gp-input*="right_stick_y"]',
      "#sim-joy-zone-right",
      "#stick-zone-right",
      "#stick-right",
      ".sim-stick-right",
      ".stick-zone-right",
    ]),
  });

  const CONTROLLER_SELECTORS = Object.freeze([
    "#sim-controller-wrap",
    "#controller-wrap",
    ".sim-controller-wrap",
    ".controller-wrap",
  ]);

  const LEGEND_CONTAINER_SELECTORS = Object.freeze([
    "#sim-gamepad-body",
    "#gamepad-card-body",
    "#gamepad-body",
    ".gamepad-card-body",
    ".gamepad-panel",
  ]);

  const LEGEND_TEXT =
    "Keyboard: Face A B X Y · D-pad arrow keys · LB/RB Q/E · LT/RT Z/C · " +
    "Left stick ↑T ←F ↓G →H · Right stick ↑I ←J ↓K →L · Back ⌫ · Start ↵";

  const LEGEND_HTML =
    '<span class="telemark-gp-legend-label">Keyboard</span> ' +
    'Face <kbd>A</kbd><kbd>B</kbd><kbd>X</kbd><kbd>Y</kbd> · ' +
    'D-pad <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> · ' +
    'LB/RB <kbd>Q</kbd>/<kbd>E</kbd> · LT/RT <kbd>Z</kbd>/<kbd>C</kbd> · ' +
    'Left <kbd>↑T</kbd><kbd>←F</kbd><kbd>↓G</kbd><kbd>→H</kbd> · ' +
    'Right <kbd>↑I</kbd><kbd>←J</kbd><kbd>↓K</kbd><kbd>→L</kbd> · ' +
    'Back <kbd>⌫</kbd> · Start <kbd>↵</kbd>';

  const STYLE_TEXT = `
    .controller-wrap,
    .sim-controller-wrap,
    #controller-wrap,
    #sim-controller-wrap {
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .controller-img,
    .sim-controller-img,
    #controller-wrap img,
    #sim-controller-wrap img {
      user-select: none;
      -webkit-user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
    .stick-knob-left,
    .stick-knob-right,
    .sim-stick-knob,
    .sim-joystick-knob,
    .telemark-gp-added-stick-knob {
      opacity: 1 !important;
    }
    .bumper-btn,
    .telemark-gp-added-bumper {
      position: absolute !important;
      top: 12% !important;
      width: 14% !important;
      height: 6% !important;
      border-radius: 8px !important;
      transform: translate(-50%, -50%) !important;
    }
    .left-bumper-btn,
    .telemark-gp-added-bumper.left {
      left: 20% !important;
      right: auto !important;
    }
    .right-bumper-btn,
    .telemark-gp-added-bumper.right {
      left: 80% !important;
      right: auto !important;
    }
    .dpad-container {
      position: absolute !important;
      left: 21.5% !important;
      top: 41% !important;
      width: 16% !important;
      height: 24% !important;
      transform: translate(-50%, -50%) !important;
      pointer-events: auto !important;
      opacity: 1 !important;
    }
    .dpad-btn.pressed,
    .bumper-btn.pressed,
    .telemark-gp-added-dpad.pressed,
    .telemark-gp-added-bumper.pressed {
      opacity: 1 !important;
      background: rgba(34, 211, 238, .38) !important;
      border-color: rgba(34, 211, 238, .9) !important;
      box-shadow: 0 0 0 2px rgba(34, 211, 238, .24) !important;
    }
    .telemark-gp-keyboard-legend {
      display: block;
      flex: 0 0 auto;
      margin: 6px 0 0;
      padding: 6px 8px;
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 6px;
      background: rgba(5, 8, 13, 0.88);
      color: #b8c7d9;
      font: 600 10px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      text-align: center;
      white-space: normal;
    }
    .telemark-gp-keyboard-legend .telemark-gp-legend-label {
      color: #22d3ee;
      font-weight: 800;
    }
    .telemark-gp-keyboard-legend kbd {
      display: inline-block;
      min-width: 17px;
      margin: 0 1px;
      padding: 0 3px;
      border: 1px solid #536273;
      border-bottom-width: 2px;
      border-radius: 3px;
      background: #17212b;
      color: #f8fafc;
      font: inherit;
      line-height: 1.35;
    }
    .telemark-gp-added-control {
      position: absolute;
      z-index: 12;
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,.2);
      background: rgba(255,255,255,.025);
      color: rgba(255,255,255,.8);
      cursor: pointer;
      touch-action: none;
      user-select: none;
    }
    .telemark-gp-added-control.pressed {
      background: rgba(34,211,238,.28);
      border-color: rgba(34,211,238,.75);
      box-shadow: 0 0 0 2px rgba(34,211,238,.2);
    }
    .telemark-gp-control-enabled {
      pointer-events: auto !important;
      cursor: pointer !important;
      touch-action: none;
    }
    .telemark-gp-added-trigger {
      top: 0;
      width: 10%;
      height: 14%;
      border-radius: 6px;
      overflow: hidden;
    }
    .telemark-gp-added-trigger.left { left: 21%; transform: translateX(-50%); }
    .telemark-gp-added-trigger.right { left: 79%; transform: translateX(-50%); }
    .telemark-gp-trigger-fill {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 0;
      background: linear-gradient(to top, #2563eb, #22d3ee);
      pointer-events: none;
    }
    .telemark-gp-added-bumper { top: 12%; width: 14%; height: 6%; border-radius: 8px; }
    .telemark-gp-added-bumper.left { left: 20%; }
    .telemark-gp-added-bumper.right { left: 80%; right: auto; }
    .telemark-gp-added-face { width: 7%; height: 10%; border-radius: 50%; }
    .telemark-gp-added-face.a { left: 75.5%; top: 49%; }
    .telemark-gp-added-face.b { left: 83%; top: 38%; }
    .telemark-gp-added-face.x { left: 68%; top: 38%; }
    .telemark-gp-added-face.y { left: 75.5%; top: 27%; }
    .telemark-gp-added-small { top: 27%; width: 5.2%; height: 6.4%; border-radius: 16px; }
    .telemark-gp-added-small.back { left: 37.5%; }
    .telemark-gp-added-small.start { left: 58%; }
    .telemark-gp-added-dpad { width: 5.3%; height: 8%; border-radius: 3px; }
    .telemark-gp-added-dpad.up { left: 18.8%; top: 29%; }
    .telemark-gp-added-dpad.down { left: 18.8%; top: 45%; }
    .telemark-gp-added-dpad.left { left: 13.5%; top: 37%; }
    .telemark-gp-added-dpad.right { left: 24.1%; top: 37%; }
    .telemark-gp-added-stick {
      top: 65.5%;
      width: 17%;
      height: 24%;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: transparent;
    }
    .telemark-gp-added-stick.left { left: 35.5%; }
    .telemark-gp-added-stick.right { left: 64%; }
    .telemark-gp-added-stick-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 52%;
      height: 52%;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 50%;
      background: rgba(30,30,30,.65);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
  `;

  const OVERLAY_DEFINITIONS = Object.freeze([
    Object.freeze({
      inputs: Object.freeze(["left_trigger"]),
      className:
        "telemark-gp-added-control telemark-gp-added-trigger left trigger-slider left-trigger-slider",
      kind: "trigger",
      label: "Left trigger",
    }),
    Object.freeze({
      inputs: Object.freeze(["right_trigger"]),
      className:
        "telemark-gp-added-control telemark-gp-added-trigger right trigger-slider right-trigger-slider",
      kind: "trigger",
      label: "Right trigger",
    }),
    Object.freeze({
      inputs: Object.freeze(["left_stick_x", "left_stick_y"]),
      className:
        "telemark-gp-added-control telemark-gp-added-stick left overlay stick-zone-left",
      kind: "stick",
      label: "Left stick",
    }),
    Object.freeze({
      inputs: Object.freeze(["right_stick_x", "right_stick_y"]),
      className:
        "telemark-gp-added-control telemark-gp-added-stick right overlay stick-zone-right",
      kind: "stick",
      label: "Right stick",
    }),
    Object.freeze({
      inputs: Object.freeze(["a"]),
      className:
        "telemark-gp-added-control telemark-gp-added-face a overlay button-overlay a-btn",
      kind: "button",
      label: "A button",
    }),
    Object.freeze({
      inputs: Object.freeze(["b"]),
      className:
        "telemark-gp-added-control telemark-gp-added-face b overlay button-overlay b-btn",
      kind: "button",
      label: "B button",
    }),
    Object.freeze({
      inputs: Object.freeze(["x"]),
      className:
        "telemark-gp-added-control telemark-gp-added-face x overlay button-overlay x-btn",
      kind: "button",
      label: "X button",
    }),
    Object.freeze({
      inputs: Object.freeze(["y"]),
      className:
        "telemark-gp-added-control telemark-gp-added-face y overlay button-overlay y-btn",
      kind: "button",
      label: "Y button",
    }),
    Object.freeze({
      inputs: Object.freeze(["left_bumper"]),
      className:
        "telemark-gp-added-control telemark-gp-added-bumper left overlay bumper-btn left-bumper-btn",
      kind: "button",
      label: "Left bumper",
    }),
    Object.freeze({
      inputs: Object.freeze(["right_bumper"]),
      className:
        "telemark-gp-added-control telemark-gp-added-bumper right overlay bumper-btn right-bumper-btn",
      kind: "button",
      label: "Right bumper",
    }),
    Object.freeze({
      inputs: Object.freeze(["back"]),
      className:
        "telemark-gp-added-control telemark-gp-added-small back overlay button-overlay small-button back-btn",
      kind: "button",
      label: "Back button",
    }),
    Object.freeze({
      inputs: Object.freeze(["start"]),
      className:
        "telemark-gp-added-control telemark-gp-added-small start overlay button-overlay small-button start-btn",
      kind: "button",
      label: "Start button",
    }),
    Object.freeze({
      inputs: Object.freeze(["dpad_up"]),
      className:
        "telemark-gp-added-control telemark-gp-added-dpad up dpad-btn dpad-up",
      kind: "button",
      label: "D-pad up",
    }),
    Object.freeze({
      inputs: Object.freeze(["dpad_down"]),
      className:
        "telemark-gp-added-control telemark-gp-added-dpad down dpad-btn dpad-down",
      kind: "button",
      label: "D-pad down",
    }),
    Object.freeze({
      inputs: Object.freeze(["dpad_left"]),
      className:
        "telemark-gp-added-control telemark-gp-added-dpad left dpad-btn dpad-left",
      kind: "button",
      label: "D-pad left",
    }),
    Object.freeze({
      inputs: Object.freeze(["dpad_right"]),
      className:
        "telemark-gp-added-control telemark-gp-added-dpad right dpad-btn dpad-right",
      kind: "button",
      label: "D-pad right",
    }),
  ]);

  const wiredPointerElements = new WeakSet();

  function neutralValue(input) {
    return ANALOG_INPUTS.indexOf(input) !== -1 ? 0 : false;
  }

  function createNeutralState() {
    const state = {};
    CANONICAL_INPUTS.forEach(function (input) {
      state[input] = neutralValue(input);
    });
    return state;
  }

  function coerceInputValue(input, value) {
    if (ANALOG_INPUTS.indexOf(input) !== -1) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      if (input === "left_trigger" || input === "right_trigger") {
        return Math.max(0, Math.min(1, number));
      }
      return Math.max(-1, Math.min(1, number));
    }
    return Boolean(value);
  }

  /**
   * Add canonical snake_case properties to older simulator state objects.
   * Accessors keep the older camelCase axes live rather than copying a stale
   * value once at installation time.
   */
  function normalizeState(state) {
    if (!state || (typeof state !== "object" && typeof state !== "function")) {
      throw new TypeError("A mutable gamepad state object is required");
    }

    CANONICAL_INPUTS.forEach(function (input) {
      if (input in state) return;
      const alias = STATE_ALIASES[input];
      if (alias && alias in state) {
        try {
          Object.defineProperty(state, input, {
            configurable: true,
            enumerable: true,
            get: function () {
              return state[alias];
            },
            set: function (value) {
              state[alias] = coerceInputValue(input, value);
            },
          });
          return;
        } catch (_) {
          // Fall through to a normal property for unusual host objects.
        }
      }
      state[input] = neutralValue(input);
    });
    return state;
  }

  function setInputValue(state, input, value) {
    if (CANONICAL_INPUTS.indexOf(input) === -1) return state;
    const normalized = normalizeState(state);
    normalized[input] = coerceInputValue(input, value);
    return normalized;
  }

  function getInputValue(state, input) {
    if (CANONICAL_INPUTS.indexOf(input) === -1) return undefined;
    return coerceInputValue(input, normalizeState(state)[input]);
  }

  function heldSet(heldCodes) {
    if (heldCodes instanceof Set) return heldCodes;
    if (Array.isArray(heldCodes)) return new Set(heldCodes);
    if (heldCodes && typeof heldCodes[Symbol.iterator] === "function") {
      return new Set(heldCodes);
    }
    if (heldCodes && typeof heldCodes === "object") {
      return new Set(
        Object.keys(heldCodes).filter(function (code) {
          return heldCodes[code];
        })
      );
    }
    return new Set();
  }

  /** Pure keyboard-state reducer used by both the browser and Node tests. */
  function computeKeyboardState(heldCodes) {
    const held = heldSet(heldCodes);
    const state = createNeutralState();

    Object.keys(BUTTON_KEY_BINDINGS).forEach(function (code) {
      if (held.has(code)) state[BUTTON_KEY_BINDINGS[code]] = true;
    });
    Object.keys(TRIGGER_KEY_BINDINGS).forEach(function (code) {
      if (held.has(code)) state[TRIGGER_KEY_BINDINGS[code]] = 1;
    });
    Object.keys(AXIS_KEY_BINDINGS).forEach(function (axis) {
      const binding = AXIS_KEY_BINDINGS[axis];
      state[axis] = (held.has(binding.positive) ? 1 : 0) -
        (held.has(binding.negative) ? 1 : 0);
    });

    return state;
  }

  function applyKeyboardState(state, heldCodes) {
    const snapshot = computeKeyboardState(heldCodes);
    CANONICAL_INPUTS.forEach(function (input) {
      setInputValue(state, input, snapshot[input]);
    });
    return snapshot;
  }

  function applyKeyboardDelta(state, nextSnapshot, previousSnapshot) {
    CANONICAL_INPUTS.forEach(function (input) {
      const neutral = neutralValue(input);
      const before = previousSnapshot ? previousSnapshot[input] : neutral;
      const after = nextSnapshot[input];
      // Avoid clearing pointer-owned inputs that the keyboard never touched.
      if (before !== neutral || after !== neutral) {
        setInputValue(state, input, after);
      }
    });
    return nextSnapshot;
  }

  function isEditableTarget(target) {
    if (!target) return false;
    const tagName = String(target.tagName || "").toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return true;
    }
    if (target.isContentEditable) return true;
    if (typeof target.getAttribute === "function") {
      const editable = target.getAttribute("contenteditable");
      if (editable === "" || editable === "true" || editable === "plaintext-only") {
        return true;
      }
    }
    if (typeof target.closest === "function") {
      try {
        if (
          target.closest(
            '.CodeMirror, .CodeMirror-code, .cm-editor, .cm-content, [contenteditable="true"], [contenteditable="plaintext-only"]'
          )
        ) {
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  function addUnique(list, value) {
    if (value && list.indexOf(value) === -1) list.push(value);
  }

  function queryAllSafe(documentObject, selector) {
    if (!documentObject || typeof documentObject.querySelectorAll !== "function") return [];
    try {
      return Array.from(documentObject.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function elementsFromSpec(spec, documentObject) {
    if (!spec) return [];
    if (typeof spec === "string") return queryAllSafe(documentObject, spec);
    if (Array.isArray(spec)) {
      return spec.flatMap(function (item) {
        return elementsFromSpec(item, documentObject);
      });
    }
    if (
      typeof spec !== "string" &&
      typeof spec[Symbol.iterator] === "function" &&
      typeof spec.addEventListener !== "function"
    ) {
      return Array.from(spec);
    }
    return [spec];
  }

  function collectControlElements(documentObject, customMap, discoverDefaults) {
    const controls = new Map();
    CANONICAL_INPUTS.forEach(function (input) {
      controls.set(input, []);
    });

    function collect(input, spec) {
      if (!controls.has(input)) return;
      elementsFromSpec(spec, documentObject).forEach(function (element) {
        addUnique(controls.get(input), element);
      });
    }

    if (discoverDefaults !== false) {
      CANONICAL_INPUTS.forEach(function (input) {
        (CONTROL_SELECTORS[input] || []).forEach(function (selector) {
          collect(input, selector);
        });
      });
    }

    if (customMap) {
      CANONICAL_INPUTS.forEach(function (input) {
        const spec = customMap instanceof Map ? customMap.get(input) : customMap[input];
        if (spec) collect(input, spec);
      });
    }

    return controls;
  }

  function firstMatch(documentObject, selectors) {
    if (!documentObject || typeof documentObject.querySelector !== "function") return null;
    for (let index = 0; index < selectors.length; index += 1) {
      try {
        const match = documentObject.querySelector(selectors[index]);
        if (match) return match;
      } catch (_) {}
    }
    return null;
  }

  function setAttributeSafe(element, name, value) {
    if (element && typeof element.setAttribute === "function") {
      element.setAttribute(name, value);
    }
  }

  function appendOverlayChild(documentObject, overlay, definition) {
    if (definition.kind === "trigger") {
      const fill = documentObject.createElement("div");
      fill.className = "telemark-gp-trigger-fill";
      overlay.appendChild(fill);
    } else if (definition.kind === "stick") {
      const knob = documentObject.createElement("div");
      knob.className = "telemark-gp-added-stick-knob";
      overlay.appendChild(knob);
    }
  }

  /**
   * Add only controls that are absent from the supplied element map. The
   * fallback classes deliberately include the common standalone class names.
   */
  function ensureControlOverlays(documentObject, controller, controls) {
    if (!documentObject || !controller || typeof controller.appendChild !== "function") return [];
    const knownControls = controls || collectControlElements(documentObject);
    const added = [];

    OVERLAY_DEFINITIONS.forEach(function (definition) {
      const exists = definition.inputs.some(function (input) {
        return (knownControls.get(input) || []).length > 0;
      });
      if (exists) return;

      const overlay = documentObject.createElement("div");
      overlay.className = definition.className;
      setAttributeSafe(overlay, "data-gp-input", definition.inputs.join(","));
      setAttributeSafe(overlay, "data-telemark-gp-added", definition.kind);
      setAttributeSafe(overlay, "role", definition.kind === "stick" ? "slider" : "button");
      setAttributeSafe(overlay, "aria-label", definition.label);
      if (definition.kind === "button") setAttributeSafe(overlay, "aria-pressed", "false");
      appendOverlayChild(documentObject, overlay, definition);
      controller.appendChild(overlay);
      added.push(overlay);
      definition.inputs.forEach(function (input) {
        if (!knownControls.has(input)) knownControls.set(input, []);
        addUnique(knownControls.get(input), overlay);
      });
    });

    return added;
  }

  function injectStyles(documentObject) {
    if (!documentObject || typeof documentObject.createElement !== "function") return null;
    if (
      typeof documentObject.getElementById === "function" &&
      documentObject.getElementById("telemark-gamepad-controls-style")
    ) {
      return documentObject.getElementById("telemark-gamepad-controls-style");
    }
    const style = documentObject.createElement("style");
    style.id = "telemark-gamepad-controls-style";
    style.textContent = STYLE_TEXT;
    const parent = documentObject.head || documentObject.documentElement || documentObject.body;
    if (parent && typeof parent.appendChild === "function") parent.appendChild(style);
    return style;
  }

  function resolveElement(spec, documentObject) {
    if (!spec) return null;
    if (typeof spec === "string") {
      if (!documentObject || typeof documentObject.querySelector !== "function") return null;
      try {
        return documentObject.querySelector(spec);
      } catch (_) {
        return null;
      }
    }
    return spec;
  }

  function createLegend(documentObject, container) {
    if (!documentObject || !container || typeof documentObject.createElement !== "function") {
      return null;
    }
    if (typeof container.querySelector === "function") {
      const existing = container.querySelector("[data-telemark-gamepad-legend]");
      if (existing) return existing;
    }
    const legend = documentObject.createElement("div");
    legend.className = "telemark-gp-keyboard-legend";
    legend.innerHTML = LEGEND_HTML;
    setAttributeSafe(legend, "data-telemark-gamepad-legend", "true");
    setAttributeSafe(legend, "role", "note");
    setAttributeSafe(legend, "aria-label", LEGEND_TEXT);
    container.appendChild(legend);
    return legend;
  }

  function togglePressed(element, pressed) {
    if (!element) return;
    if (element.classList && typeof element.classList.toggle === "function") {
      element.classList.toggle("pressed", Boolean(pressed));
    }
    setAttributeSafe(element, "aria-pressed", pressed ? "true" : "false");
  }

  function findFill(element) {
    if (!element || typeof element.querySelector !== "function") return null;
    const selectors = [
      ".sim-trigger-fill",
      ".trigger-slider-fill",
      ".gp-trigger-fill",
      ".telemark-gp-trigger-fill",
    ];
    for (let index = 0; index < selectors.length; index += 1) {
      const match = element.querySelector(selectors[index]);
      if (match) return match;
    }
    return null;
  }

  function syncTrigger(elements, value) {
    const normalized = coerceInputValue("left_trigger", value);
    elements.forEach(function (element) {
      togglePressed(element, normalized > 0);
      const fill = findFill(element);
      if (fill && fill.style) fill.style.height = normalized * 100 + "%";
      setAttributeSafe(element, "aria-valuenow", normalized.toFixed(2));
    });
  }

  function findStickKnob(documentObject, side, zones) {
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index];
      if (zone && typeof zone.querySelector === "function") {
        const child = zone.querySelector(
          ".sim-stick-knob, .sim-joystick-knob, .gp-stick-knob, .telemark-gp-added-stick-knob"
        );
        if (child) return {knob: child, zone: zone, nested: true};
      }
    }
    const selectors = side === "left"
      ? ["#sim-joy-knob-left", "#stick-knob-left", ".stick-knob-left"]
      : ["#sim-joy-knob-right", "#stick-knob-right", ".stick-knob-right"];
    const knob = firstMatch(documentObject, selectors);
    return knob ? {knob: knob, zone: zones[0] || null, nested: false} : null;
  }

  function syncStick(documentObject, side, zones, x, y) {
    const found = findStickKnob(documentObject, side, zones);
    zones.forEach(function (zone) {
      if (zone && zone.classList && typeof zone.classList.toggle === "function") {
        zone.classList.toggle("active", Math.abs(x) > 0 || Math.abs(y) > 0);
      }
      setAttributeSafe(zone, "aria-valuetext", x.toFixed(2) + ", " + y.toFixed(2));
    });
    if (!found || !found.knob || !found.knob.style) return;
    if (found.nested) {
      found.knob.style.left = 50 + x * 38 + "%";
      // FTC Y is negative upward, so adding Y moves the knob upward.
      found.knob.style.top = 50 + y * 38 + "%";
    } else {
      const centerLeft = side === "left" ? 35.5 : 64;
      found.knob.style.left = centerLeft + x * 6.2 + "%";
      found.knob.style.top = 65.5 + y * 8.5 + "%";
    }
  }

  function syncVisibleControls(state, controls, documentObject) {
    const normalized = normalizeState(state);
    BUTTON_INPUTS.forEach(function (input) {
      (controls.get(input) || []).forEach(function (element) {
        togglePressed(element, getInputValue(normalized, input));
      });
    });
    syncTrigger(controls.get("left_trigger") || [], normalized.left_trigger);
    syncTrigger(controls.get("right_trigger") || [], normalized.right_trigger);
    syncStick(
      documentObject,
      "left",
      controls.get("left_stick_x") || [],
      getInputValue(normalized, "left_stick_x"),
      getInputValue(normalized, "left_stick_y")
    );
    syncStick(
      documentObject,
      "right",
      controls.get("right_stick_x") || [],
      getInputValue(normalized, "right_stick_x"),
      getInputValue(normalized, "right_stick_y")
    );
    return normalized;
  }

  function eventPointValue(element, event) {
    if (!element || typeof element.getBoundingClientRect !== "function") return 1;
    const rect = element.getBoundingClientRect();
    if (!rect || !rect.height) return 1;
    return 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  }

  function enablePointerElement(element) {
    if (!element) return;
    if (element.classList && typeof element.classList.add === "function") {
      element.classList.add("telemark-gp-control-enabled");
    }
    if (element.style) {
      element.style.pointerEvents = "auto";
      element.style.cursor = "pointer";
      element.style.touchAction = "none";
    }
    // Unit 8.1 disables pointer events on the D-pad wrapper as well as leaving
    // them unset on its children. Re-enable that common wrapper explicitly.
    const parent = element.parentElement;
    const parentClass = parent && String(parent.className || "");
    if (parent && /(?:^|\s)(?:dpad-container|sim-dpad-overlay)(?:\s|$)/.test(parentClass)) {
      if (parent.style) parent.style.pointerEvents = "auto";
    }
  }

  function wireHoldElement(element, input, getState, sync) {
    if (!element || typeof element.addEventListener !== "function") return null;
    if (wiredPointerElements.has(element)) return null;
    wiredPointerElements.add(element);
    enablePointerElement(element);

    function press(event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      setInputValue(getState(), input, true);
      togglePressed(element, true);
      if (element.setPointerCapture && event && event.pointerId != null) {
        try {
          element.setPointerCapture(event.pointerId);
        } catch (_) {}
      }
      sync();
    }
    function release() {
      setInputValue(getState(), input, false);
      togglePressed(element, false);
      sync();
    }
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    element.addEventListener("mouseleave", release);
    return release;
  }

  function wireTriggerElement(element, input, getState, sync) {
    if (!element || typeof element.addEventListener !== "function") return null;
    if (wiredPointerElements.has(element)) return null;
    wiredPointerElements.add(element);
    enablePointerElement(element);
    let dragging = false;

    function update(event) {
      setInputValue(getState(), input, eventPointValue(element, event));
      sync();
    }
    function release() {
      dragging = false;
      setInputValue(getState(), input, 0);
      sync();
    }
    element.addEventListener("pointerdown", function (event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      dragging = true;
      if (element.setPointerCapture && event && event.pointerId != null) {
        try {
          element.setPointerCapture(event.pointerId);
        } catch (_) {}
      }
      update(event);
    });
    element.addEventListener("pointermove", function (event) {
      if (dragging) update(event);
    });
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    return release;
  }

  function wireAddedStick(element, side, getState, sync) {
    if (!element || typeof element.addEventListener !== "function") return null;
    if (wiredPointerElements.has(element)) return null;
    wiredPointerElements.add(element);
    enablePointerElement(element);
    let dragging = false;
    let pointerId = null;
    const xInput = side + "_stick_x";
    const yInput = side + "_stick_y";

    function update(event) {
      if (!element.getBoundingClientRect) return;
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = Math.max(1, Math.min(rect.width, rect.height) * 0.38);
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxRadius) {
        dx = dx / distance * maxRadius;
        dy = dy / distance * maxRadius;
      }
      setInputValue(getState(), xInput, dx / maxRadius);
      setInputValue(getState(), yInput, dy / maxRadius);
      sync();
    }
    function release() {
      dragging = false;
      pointerId = null;
      setInputValue(getState(), xInput, 0);
      setInputValue(getState(), yInput, 0);
      sync();
    }
    element.addEventListener("pointerdown", function (event) {
      if (event && typeof event.preventDefault === "function") event.preventDefault();
      dragging = true;
      pointerId = event.pointerId;
      if (element.setPointerCapture && pointerId != null) {
        try {
          element.setPointerCapture(pointerId);
        } catch (_) {}
      }
      update(event);
    });
    element.addEventListener("pointermove", function (event) {
      if (dragging && (pointerId == null || pointerId === event.pointerId)) update(event);
    });
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    return release;
  }

  function wirePointerControls(controls, getState, sync) {
    const resetters = [];
    function collect(reset) {
      if (typeof reset === "function") resetters.push(reset);
    }
    BUTTON_INPUTS.forEach(function (input) {
      (controls.get(input) || []).forEach(function (element) {
        collect(wireHoldElement(element, input, getState, sync));
      });
    });
    (controls.get("left_trigger") || []).forEach(function (element) {
      collect(wireTriggerElement(element, "left_trigger", getState, sync));
    });
    (controls.get("right_trigger") || []).forEach(function (element) {
      collect(wireTriggerElement(element, "right_trigger", getState, sync));
    });
    const leftZones = controls.get("left_stick_x") || [];
    const rightZones = controls.get("right_stick_x") || [];
    leftZones.forEach(function (element) {
      collect(wireAddedStick(element, "left", getState, sync));
    });
    rightZones.forEach(function (element) {
      collect(wireAddedStick(element, "right", getState, sync));
    });
    return resetters;
  }

  function preventControllerDragging(controller) {
    if (!controller) return;
    const images = [];
    if (String(controller.tagName || "").toLowerCase() === "img") images.push(controller);
    if (typeof controller.querySelectorAll === "function") {
      Array.prototype.push.apply(images, Array.from(controller.querySelectorAll("img")));
    }
    images.forEach(function (image) {
      image.draggable = false;
      setAttributeSafe(image, "draggable", "false");
      if (typeof image.addEventListener === "function") {
        image.addEventListener("dragstart", function (event) {
          if (event && event.preventDefault) event.preventDefault();
        });
      }
    });
    if (typeof controller.addEventListener === "function") {
      controller.addEventListener("dragstart", function (event) {
        if (event && event.preventDefault) event.preventDefault();
      });
    }
  }

  function defaultGlobal() {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    return null;
  }

  function discoverState(globalObject) {
    if (!globalObject) return null;
    if (globalObject.gamepad) return globalObject.gamepad;
    if (globalObject.gamepadState) return globalObject.gamepadState;
    if (globalObject.state && globalObject.state.gamepad) return globalObject.state.gamepad;
    return null;
  }

  function install(options) {
    const settings = options || {};
    const globalObject = settings.globalObject || defaultGlobal();
    const documentObject = settings.document || (globalObject && globalObject.document) || null;
    const eventTarget =
      settings.eventTarget ||
      settings.window ||
      (documentObject && documentObject.defaultView) ||
      globalObject;
    let fixedState = settings.state || null;

    function getState() {
      const current =
        typeof settings.getState === "function"
          ? settings.getState()
          : fixedState || discoverState(globalObject);
      if (!current) {
        throw new TypeError(
          "TelemarkGamepadControls.install requires state, getState(), or a global gamepad"
        );
      }
      if (!fixedState && typeof settings.getState !== "function") fixedState = current;
      return normalizeState(current);
    }

    getState();
    if (settings.injectStyles !== false) injectStyles(documentObject);

    let controls = collectControlElements(
      documentObject,
      settings.elementMap,
      settings.discoverControls !== false
    );
    const controller =
      resolveElement(settings.controller, documentObject) ||
      firstMatch(documentObject, CONTROLLER_SELECTORS);
    if (settings.addMissingOverlays !== false && controller) {
      ensureControlOverlays(documentObject, controller, controls);
    }
    preventControllerDragging(controller);

    let legendContainer = resolveElement(settings.legendContainer, documentObject);
    if (!legendContainer) legendContainer = firstMatch(documentObject, LEGEND_CONTAINER_SELECTORS);
    if (!legendContainer && controller) legendContainer = controller.parentElement || null;
    const legend = settings.legend === false
      ? null
      : createLegend(documentObject, legendContainer);

    function sync() {
      const normalized = syncVisibleControls(getState(), controls, documentObject);
      if (typeof settings.onInput === "function") {
        try {
          settings.onInput(normalized);
        } catch (error) {
          // A lesson-specific readout must never leave the shared controller in
          // a half-installed state with pointer handlers but no keyboard input.
          if (globalObject && globalObject.console && typeof globalObject.console.error === "function") {
            globalObject.console.error("Telemark gamepad input callback failed", error);
          }
        }
      }
      return normalized;
    }

    const pointerResetters = settings.pointer !== false
      ? wirePointerControls(controls, getState, sync)
      : [];
    sync();

    const heldCodes = new Set();
    let keyboardSnapshot = createNeutralState();
    let destroyed = false;

    function updateKeyboard() {
      const next = computeKeyboardState(heldCodes);
      keyboardSnapshot = applyKeyboardDelta(getState(), next, keyboardSnapshot);
      sync();
      return next;
    }

    function onKeyDown(event) {
      if (!event || !MAPPED_CODE_SET.has(event.code)) return;
      if (isEditableTarget(event.target)) return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      heldCodes.add(event.code);
      updateKeyboard();
    }

    function onKeyUp(event) {
      if (!event || !MAPPED_CODE_SET.has(event.code)) return;
      // Keyup must always clear a held control, even if focus moved into the
      // editor after keydown. Only suppress browser behavior outside editors.
      if (!isEditableTarget(event.target) && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      heldCodes.delete(event.code);
      updateKeyboard();
    }

    function reset() {
      heldCodes.clear();
      keyboardSnapshot = createNeutralState();
      pointerResetters.forEach(function (release) { release(); });
      const state = getState();
      CANONICAL_INPUTS.forEach(function (input) {
        setInputValue(state, input, neutralValue(input));
      });
      return sync();
    }

    function onVisibilityChange() {
      if (
        !documentObject ||
        documentObject.hidden ||
        documentObject.visibilityState === "hidden"
      ) {
        reset();
      }
    }

    if (eventTarget && typeof eventTarget.addEventListener === "function") {
      eventTarget.addEventListener("keydown", onKeyDown);
      eventTarget.addEventListener("keyup", onKeyUp);
      eventTarget.addEventListener("blur", reset);
    }
    if (documentObject && typeof documentObject.addEventListener === "function") {
      documentObject.addEventListener("visibilitychange", onVisibilityChange);
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      reset();
      if (eventTarget && typeof eventTarget.removeEventListener === "function") {
        eventTarget.removeEventListener("keydown", onKeyDown);
        eventTarget.removeEventListener("keyup", onKeyUp);
        eventTarget.removeEventListener("blur", reset);
      }
      if (documentObject && typeof documentObject.removeEventListener === "function") {
        documentObject.removeEventListener("visibilitychange", onVisibilityChange);
      }
    }

    return Object.freeze({
      state: getState(),
      controls: controls,
      controller: controller,
      legend: legend,
      heldCodes: heldCodes,
      reset: reset,
      sync: sync,
      destroy: destroy,
    });
  }

  return Object.freeze({
    CANONICAL_INPUTS: CANONICAL_INPUTS,
    ANALOG_INPUTS: ANALOG_INPUTS,
    BUTTON_INPUTS: BUTTON_INPUTS,
    STATE_ALIASES: STATE_ALIASES,
    KEY_BINDINGS: KEY_BINDINGS,
    MAPPED_CODES: MAPPED_CODES,
    CONTROL_SELECTORS: CONTROL_SELECTORS,
    OVERLAY_DEFINITIONS: OVERLAY_DEFINITIONS,
    LEGEND_TEXT: LEGEND_TEXT,
    LEGEND_HTML: LEGEND_HTML,
    createNeutralState: createNeutralState,
    normalizeState: normalizeState,
    setInputValue: setInputValue,
    getInputValue: getInputValue,
    computeKeyboardState: computeKeyboardState,
    applyKeyboardState: applyKeyboardState,
    isEditableTarget: isEditableTarget,
    collectControlElements: collectControlElements,
    ensureControlOverlays: ensureControlOverlays,
    createLegend: createLegend,
    syncVisibleControls: syncVisibleControls,
    install: install,
  });
});
