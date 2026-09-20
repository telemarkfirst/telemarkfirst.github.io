/**
 * TelemarkEditor
 *
 * Shared Java editing behavior for the browser simulators. The helper keeps
 * the lightweight textarea editors consistent without requiring a server-side
 * editor or build step.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TelemarkEditor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_INDENT = "    ";
  const PAIRS = {"(": ")", "[": "]", "{": "}", '"': '"', "'": "'"};
  const CLOSERS = new Set(Object.values(PAIRS));
  const DRAFT_PREFIX = "telemark.editor.v1:";
  const DRAFT_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  const GLOBAL_COMPLETIONS = [
    {label: "@Autonomous", insertText: '@Autonomous(name="Name")', detail: "Register an Autonomous OpMode"},
    {label: "@TeleOp", insertText: '@TeleOp(name="Name")', detail: "Register a TeleOp OpMode"},
    {label: "ElapsedTime", insertText: "ElapsedTime timer = new ElapsedTime();", detail: "Create a non-blocking SDK timer"},
    {label: "for", insertText: "for (int i = 0; i < count; i++) {\n    \n}", cursorOffset: 9, detail: "Counted loop"},
    {label: "if", insertText: "if (condition) {\n    \n}", cursorOffset: 4, detail: "Conditional block"},
    {label: "while", insertText: "while (opModeIsActive()) {\n    \n}", cursorOffset: 7, detail: "Active OpMode loop"},
  ];
  GLOBAL_COMPLETIONS.push.apply(GLOBAL_COMPLETIONS,
    ('public private protected static final abstract void boolean byte short int long float double char ' +
      'class interface enum extends implements import package new return else switch case default break continue ' +
      'do try catch finally throw throws this super null true false synchronized volatile').split(' ').map(function (keyword) {
      return {label: keyword, insertText: keyword, detail: 'Java keyword'};
    }));
  GLOBAL_COMPLETIONS.push.apply(GLOBAL_COMPLETIONS, methods([
    'init()', 'init_loop()', 'start()', 'loop()', 'stop()', 'runOpMode()',
  ]).map(function (item) {
    item.detail = 'OpMode lifecycle method · ' + item.insertText;
    return item;
  }));
  const MEMBER_COMPLETIONS = {
    hardwareMap: [
      {label: "get", insertText: 'get(DcMotor.class, "name")', detail: "Required configured device"},
      {label: "tryGet", insertText: 'tryGet(DcMotor.class, "name")', detail: "Optional device; may return null"},
    ],
    telemetry: [
      {label: "addData", insertText: 'addData("Caption", value)', detail: "Add a telemetry item"},
      {label: "update", insertText: "update()", detail: "Send queued telemetry"},
      {label: "clear", insertText: "clear()", detail: "Clear telemetry items"},
    ],
    gamepad1: gamepadCompletions(),
    gamepad2: gamepadCompletions(),
    limelight: [
      {label: "getLatestResult", insertText: "getLatestResult()", detail: "Read the latest vision result"},
      {label: "pipelineSwitch", insertText: "pipelineSwitch(0)", detail: "Select a Limelight pipeline"},
      {label: "start", insertText: "start()", detail: "Begin polling"},
      {label: "stop", insertText: "stop()", detail: "Stop polling"},
      {label: "updateRobotOrientation", insertText: "updateRobotOrientation(yawDegrees)", detail: "Send robot yaw for MegaTag2"},
    ],
    result: [
      {label: "isValid", insertText: "isValid()", detail: "Check target validity"},
      {label: "getBotpose", insertText: "getBotpose()", detail: "Robot field pose"},
      {label: "getBotpose_MT2", insertText: "getBotpose_MT2()", detail: "MegaTag2 robot field pose"},
      {label: "getStaleness", insertText: "getStaleness()", detail: "Result age in milliseconds"},
      {label: "getBotposeTagCount", insertText: "getBotposeTagCount()", detail: "Tags used for pose estimate"},
      {label: "getBotposeAvgDist", insertText: "getBotposeAvgDist()", detail: "Average target distance"},
    ],
    follower: [
      {label: "update", insertText: "update()", detail: "Advance localization and following"},
      {label: "pose", insertText: "pose()", detail: "Current Pedro 3 pose estimate"},
      {label: "setPose", insertText: "setPose(new Pose(x, y, heading))", detail: "Apply a corrected pose"},
      {label: "follow", insertText: "follow(path)", detail: "Start following a Pedro 3 Path"},
      {label: "mode", insertText: "mode()", detail: "Current follower mode"},
      {label: "following", insertText: "following()", detail: "Path currently being followed"},
      {label: "atParametricEnd", insertText: "atParametricEnd()", detail: "Whether the path reached its parametric end"},
      {label: "isBusy", insertText: "isBusy()", detail: "Check whether a path is active"},
    ],
    imu: [
      {label: "getRobotYawPitchRollAngles", insertText: "getRobotYawPitchRollAngles()", detail: "Read robot orientation"},
      {label: "resetYaw", insertText: "resetYaw()", detail: "Zero the yaw angle"},
    ],
  };
  const TIMER_COMPLETIONS = [
    {label: "reset", insertText: "reset()", detail: "Restart the timer at zero"},
    {label: "seconds", insertText: "seconds()", detail: "Elapsed seconds"},
    {label: "milliseconds", insertText: "milliseconds()", detail: "Elapsed milliseconds"},
    {label: "time", insertText: "time()", detail: "Elapsed seconds"},
  ];

  function methods(specs) {
    return specs.map(function (spec) {
      const label = spec.split('(')[0];
      return {label: label, insertText: spec, detail: spec,
        cursorOffset: spec.endsWith('()') ? spec.length : spec.indexOf('(') + 1};
    });
  }
  const MOTOR_COMPLETIONS = methods(['setPower(0.0)', 'getPower()', 'setDirection(DcMotorSimple.Direction.REVERSE)',
    'getDirection()', 'setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE)', 'getZeroPowerBehavior()',
    'setMode(DcMotor.RunMode.RUN_WITHOUT_ENCODER)', 'getMode()', 'setTargetPosition(0)',
    'getTargetPosition()', 'getCurrentPosition()', 'isBusy()']);
  const TYPE_COMPLETIONS = {
    DcMotor: MOTOR_COMPLETIONS,
    DcMotorEx: MOTOR_COMPLETIONS.concat(methods([
      'setVelocity(0.0)',
      'getVelocity()',
      'setVelocityPIDFCoefficients(10.0, 0.0, 0.0, 0.004)',
      'setTargetPositionTolerance(10)',
      'isOverCurrent()',
    ])),
    Servo: methods(['setPosition(0.0)', 'getPosition()', 'scaleRange(0.0, 1.0)', 'setDirection(Servo.Direction.REVERSE)', 'getDirection()']),
    CRServo: methods(['setPower(0.0)', 'getPower()', 'setDirection(DcMotorSimple.Direction.REVERSE)', 'getDirection()']),
    DigitalChannel: methods(['getState()', 'setMode(DigitalChannel.Mode.INPUT)', 'getMode()', 'setState(true)']),
    TouchSensor: methods(['isPressed()', 'getValue()']),
    AnalogInput: methods(['getVoltage()', 'getMaxVoltage()']),
    DistanceSensor: methods(['getDistance(DistanceUnit.CM)']),
    ColorSensor: methods(['red()', 'green()', 'blue()', 'alpha()', 'argb()', 'enableLed(true)']),
    ElapsedTime: TIMER_COMPLETIONS,
    IMU: MEMBER_COMPLETIONS.imu.concat(methods(['initialize(parameters)'])),
    Limelight3A: MEMBER_COMPLETIONS.limelight,
    LLResult: MEMBER_COMPLETIONS.result,
    Follower: MEMBER_COMPLETIONS.follower,
    Telemetry: MEMBER_COMPLETIONS.telemetry,
    HardwareMap: MEMBER_COMPLETIONS.hardwareMap,
    Gamepad: gamepadCompletions(),
  };
  GLOBAL_COMPLETIONS.push.apply(GLOBAL_COMPLETIONS, methods([
    'opModeIsActive()', 'isStopRequested()', 'waitForStart()', 'getRuntime()', 'resetRuntime()',
  ]));

  /**
   * Annotations. The @ is typed first, so these carry it in the label and the
   * context hands back a range that includes it.
   */
  /**
   * The SDK type names.
   *
   * These were not offered at all: typing `DcM` completed nothing, so every
   * hardware class had to be recalled and spelled from memory, which is the
   * thing a student gets wrong most often and the compiler complains about
   * last. Declaring one is usually the first line of a mapping, so the
   * completion carries the type on its own and leaves the name to them.
   */
  // Distinct from TYPE_COMPLETIONS above, which holds the members of a type.
  // These are the type names themselves, offered when declaring something.
  const SDK_TYPE_NAMES = [
    ["DcMotor", "A motor, in the usual case"],
    ["DcMotorEx", "A motor, with velocity and current"],
    ["DcMotorSimple", "Direction only, shared by motors and CR servos"],
    ["Servo", "A servo held at a position"],
    ["CRServo", "A continuous rotation servo, driven by power"],
    ["TouchSensor", "A limit or touch switch"],
    ["DigitalChannel", "A digital input or output"],
    ["AnalogInput", "An analog input"],
    ["ColorSensor", "Colour, as red, green, blue"],
    ["DistanceSensor", "Distance, in the unit you ask for"],
    ["IMU", "The hub's orientation sensor"],
    ["ElapsedTime", "A timer you reset and read"],
    ["HardwareMap", "The configured devices on the robot"],
    ["Telemetry", "The lines shown on the Driver Station"],
    ["Gamepad", "One driver's controller"],
    ["OpMode", "The class a TeleOp usually extends"],
    ["LinearOpMode", "The class an autonomous usually extends"],
    ["RevHubOrientationOnRobot", "How the hub is mounted, for the IMU"],
    ["YawPitchRollAngles", "The angles the IMU reports"],
    ["Limelight3A", "The Limelight camera"],
    ["LLResult", "One reading from the Limelight"],
    ["Follower", "Pedro Pathing's path follower"],
    ["Pose", "A position and heading on the field"],
    ["Math", "Java's maths library"],
    ["String", "Text"],
  ].map(function (entry) {
    return {label: entry[0], insertText: entry[0], detail: entry[1]};
  });

  const ANNOTATION_COMPLETIONS = [
    {label: "@Override", insertText: "@Override", detail: "Replaces a method from the class you extend"},
    {label: "@TeleOp", insertText: '@TeleOp(name = "Name", group = "Group")', detail: "Registers a driver-controlled OpMode"},
    {label: "@Autonomous", insertText: '@Autonomous(name = "Name", group = "Group")', detail: "Registers an autonomous OpMode"},
    {label: "@Disabled", insertText: "@Disabled", detail: "Keeps an OpMode off the Driver Station list"},
    {label: "@Deprecated", insertText: "@Deprecated", detail: "Marks something as replaced"},
    {label: "@SuppressWarnings", insertText: '@SuppressWarnings("unchecked")', detail: "Silences one compiler warning"},
  ];

  /**
   * Methods the student has written, read out of the buffer.
   *
   * This is what makes a class they wrote themselves complete. Requiring the
   * opening brace is what separates a declaration from a call, and the
   * control-flow words are excluded because `if (x) {` matches the same shape.
   *
   * It stays a scan rather than a parse on purpose: the buffer is usually
   * mid-edit and unbalanced, and something that gave up at the first syntax
   * error would go quiet exactly when the help is wanted.
   */
  function ownMethods(source) {
    const clean = String(source || "").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, " ");
    const pattern = /(?:^|[;{}\s])(?:public|private|protected|static|final|abstract|synchronized|\s)*([A-Za-z_$][\w$]*(?:\s*<[^>]*>)?(?:\s*\[\s*\])?)\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
    const skip = /^(if|for|while|switch|catch|synchronized|return|new)$/;
    const found = new Map();
    let match;
    while ((match = pattern.exec(clean))) {
      if (skip.test(match[2])) continue;
      // Same convention the built-in method completions use: a method that
      // takes something leaves the caret between the brackets, one that takes
      // nothing leaves it after them, so the next keystroke is the right one.
      const takesArguments = match[3].trim().length > 0;
      found.set(match[2], {
        label: match[2],
        insertText: match[2] + "()",
        cursorOffset: match[2].length + (takesArguments ? 1 : 2),
        detail: "your " + match[1].trim() + " method",
      });
    }
    return Array.from(found.values());
  }

  /** Classes, interfaces and enums the student has declared. */
  function ownClasses(source) {
    const clean = String(source || "").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, " ");
    const pattern = /\b(?:class|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
    const found = new Map();
    let match;
    while ((match = pattern.exec(clean))) {
      found.set(match[1], {label: match[1], insertText: match[1], detail: "your class"});
    }
    return Array.from(found.values());
  }

  function declarations(source) {
    const clean = String(source).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      function (text) { return text.replace(/[^\n]/g, ' '); });
    const found = new Map();
    const pattern = /\b([A-Za-z_$][\w$]*)(?:\s*<[^;{}=]+>)?\s*(?:\[\s*\])?\s+([A-Za-z_$][\w$]*)\s*(?=[=;,):])/g;
    let match;
    while ((match = pattern.exec(clean))) {
      if (/^(return|new|throw|package|import|else|case)$/.test(match[1])) continue;
      found.set(match[2], match[1]);
      // Also support fields such as "DcMotor left, right;".
      let rest = clean.slice(pattern.lastIndex);
      let next;
      while ((next = rest.match(/^\s*,\s*([A-Za-z_$][\w$]*)\s*(?=[,;=])/))) {
        found.set(next[1], match[1]);
        rest = rest.slice(next[0].length);
      }
    }
    return found;
  }

  function gamepadCompletions() {
    return [
      "a", "b", "x", "y", "dpad_up", "dpad_down", "dpad_left", "dpad_right",
      "left_bumper", "right_bumper", "left_trigger", "right_trigger",
      "left_stick_x", "left_stick_y", "right_stick_x", "right_stick_y",
    ].map(function (label) {
      return {label: label, insertText: label, detail: "Gamepad input"};
    });
  }

  function runtimeRoot() {
    return typeof globalThis !== "undefined" ? globalThis : {};
  }

  function hashString(value) {
    let hash = 2166136261;
    const source = String(value || "");
    for (let index = 0; index < source.length; index++) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function pageDraftScope(options) {
    options = options || {};
    if (options.scope) return String(options.scope);
    const host = runtimeRoot();
    const location = options.location || host.location || {};
    const path = location.pathname || "simulator";
    const search = String(location.search || "");
    const variants = [];

    if (typeof URLSearchParams === "function") {
      const params = new URLSearchParams(search);
      ["lesson", "challenge", "step", "unit"].forEach(function (name) {
        if (params.has(name)) variants.push(name + "=" + params.get(name));
      });
      if (params.has("code")) variants.push("code=" + hashString(params.get("code")));
    } else if (search) {
      variants.push("query=" + hashString(search));
    }
    if (location.hash) variants.push("hash=" + hashString(location.hash));
    return path + (variants.length ? "::" + variants.join("&") : "");
  }

  function draftKey(editor, options) {
    options = options || {};
    if (options.key) return String(options.key);
    const identity = editor && (editor.id || editor.name) || "code-editor";
    return DRAFT_PREFIX + hashString(pageDraftScope(options)) + ":" + identity;
  }

  function draftStorage(options) {
    options = options || {};
    if (options.storage) return options.storage;
    try {
      return runtimeRoot().localStorage || null;
    } catch (_error) {
      return null;
    }
  }

  function saveDraft(editor, options) {
    if (editor && editor.__telemarkProject) { editor.__telemarkProject.save(); return true; }
    if (!editor || typeof editor.value !== "string") return false;
    const storage = draftStorage(options);
    if (!storage) return false;
    try {
      storage.setItem(draftKey(editor, options), JSON.stringify({
        value: editor.value,
        savedAt: Date.now(),
      }));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function restoreDraft(editor, options) {
    if (editor && editor.__telemarkProject) return true;
    if (!editor || typeof editor.value !== "string") return false;
    const storage = draftStorage(options);
    if (!storage) return false;
    const key = draftKey(editor, options);
    try {
      const draft = JSON.parse(storage.getItem(key) || "null");
      if (!draft || typeof draft.value !== "string") return false;
      if (!Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > DRAFT_MAX_AGE) {
        storage.removeItem(key);
        return false;
      }
      if (editor.value === draft.value) return true;
      editor.value = draft.value;
      if (typeof editor.dispatchEvent === "function") {
        const EventType = runtimeRoot().Event;
        if (typeof EventType === "function") {
          editor.dispatchEvent(new EventType("input", {bubbles: true}));
          editor.dispatchEvent(new EventType("telemark:draft-restored"));
        }
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  function clearDiagnostics(documentOverride) {
    const doc = documentOverride || runtimeRoot().document;
    if (!doc || typeof doc.querySelectorAll !== "function") return;

    doc.querySelectorAll(
      ".sim-telemetry-error,.telemetry-error,.sim-hint.error,.hint.error,.hint-error"
    ).forEach(function (element) {
      if (element && typeof element.remove === "function") element.remove();
    });
    doc.querySelectorAll(".scene-hint.error").forEach(function (element) {
      element.classList.remove("visible", "error");
      element.textContent = "";
    });

    // A few early lessons rendered compiler failures directly into the
    // telemetry panel instead of assigning an error class. Only clear panels
    // whose whole contents describe a compiler/runtime failure; student
    // telemetry remains untouched.
    ["sim-telemetry-log", "telemetry-log"].forEach(function (id) {
      const panel = typeof doc.getElementById === "function" ? doc.getElementById(id) : null;
      if (!panel || panel.querySelector(".sim-telemetry-error,.telemetry-error")) return;
      const text = String(panel.textContent || "").trim();
      if (/^(?:ERROR:\s*)?(?:(?:Java|init\(\)|init_loop\(\)|loop\(\)|runOpMode\(\)|Setup|simulator)\s+)?(?:compile(?:\/runtime)?|runtime) error\b/i.test(text)) {
        panel.innerHTML = "";
      }
    });
  }

  function scheduleDraftRestore(editor, options) {
    const host = runtimeRoot();
    const restore = function () {
      const defer = typeof host.setTimeout === "function" ? host.setTimeout : function (fn) { fn(); };
      defer(function () { restoreDraft(editor, options); }, 0);
    };
    if (host.document && host.document.readyState !== "complete"
        && typeof host.addEventListener === "function") {
      host.addEventListener("load", restore, {once: true});
    } else {
      restore();
    }
  }

  function bindPersistence(editor, options) {
    if (!editor) return function () {};
    if (editor.__telemarkPersistenceDetach) return editor.__telemarkPersistenceDetach;
    options = options || {};
    const listener = function () {
      clearDiagnostics();
      saveDraft(editor, options);
    };
    editor.addEventListener("input", listener);
    editor.__telemarkPersistenceDetach = function () {
      editor.removeEventListener("input", listener);
      delete editor.__telemarkPersistenceDetach;
    };
    if (options.restore !== false) scheduleDraftRestore(editor, options);
    return editor.__telemarkPersistenceDetach;
  }

  function lineStartAt(text, position) {
    return text.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
  }

  function leadingWhitespace(text) {
    return (text.match(/^\s*/) || [""])[0];
  }

  function replaceRange(editor, start, end, replacement, selectionStart, selectionEnd) {
    if (typeof editor.setRangeText === "function") {
      editor.setRangeText(replacement, start, end, "preserve");
    } else {
      editor.value = editor.value.slice(0, start) + replacement + editor.value.slice(end);
    }
    editor.selectionStart = selectionStart;
    editor.selectionEnd = selectionEnd == null ? selectionStart : selectionEnd;
  }

  function completionContext(value, cursor) {
    const source = String(value || "");
    const position = Math.max(0, Math.min(source.length, Number(cursor) || 0));
    const before = source.slice(0, position);
    const member = before.match(/([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)?$/);
    if (member) {
      return {
        receiver: member[1],
        prefix: member[2] || "",
        replaceStart: position - (member[2] || "").length,
        replaceEnd: position,
      };
    }
    // An annotation is matched before a bare word, and the @ is part of what
    // gets replaced: without it, accepting @Override on a typed @Ov leaves @@Override.
    const annotation = before.match(/@([A-Za-z_$][\w$]*)?$/);
    if (annotation) {
      const typed = "@" + (annotation[1] || "");
      return {
        receiver: null,
        annotation: true,
        prefix: typed,
        replaceStart: position - typed.length,
        replaceEnd: position,
      };
    }
    const global = before.match(/(?:^|[^\w$])([A-Za-z_$][\w$]*)$/);
    const prefix = global ? global[1] : "";
    return {
      receiver: null,
      prefix: prefix,
      replaceStart: position - prefix.length,
      replaceEnd: position,
    };
  }

  function elapsedTimeVariables(source) {
    const names = new Set();
    const pattern = /\bElapsedTime\s+([A-Za-z_$][\w$]*)/g;
    let match;
    while ((match = pattern.exec(String(source || "")))) names.add(match[1]);
    return names;
  }

  function getCompletions(value, cursor, options) {
    options = options || {};
    const context = completionContext(value, cursor);
    // Do not offer code while typing comments or string literals.
    const before = String(value).slice(0, cursor);
    const tokens = before.match(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*(?:"|$)|'(?:\\.|[^'\\])*(?:'|$)/g) || [];
    const last = tokens[tokens.length - 1];
    if (last && before.endsWith(last) && (last.startsWith('//') ||
      (last.startsWith('/*') && !last.endsWith('*/')) ||
      (last.startsWith('"') && (last.length === 1 || !last.endsWith('"'))) ||
      (last.startsWith("'") && (last.length === 1 || !last.endsWith("'"))))) return [];
    const variables = declarations(value);
    let pool;
    if (context.annotation) {
      // A single @ is enough to be worth offering: there are few of them and
      // the @ itself is a clear statement of intent.
      pool = ANNOTATION_COMPLETIONS;
      const typedAnnotation = context.prefix;
      return pool
        .filter(function (item) { return item.label.indexOf(typedAnnotation) === 0; })
        .map(function (item) {
          return Object.assign({}, item, {
            replaceStart: context.replaceStart,
            replaceEnd: context.replaceEnd,
          });
        });
    }
    if (context.receiver) {
      pool = TYPE_COMPLETIONS[variables.get(context.receiver)] || MEMBER_COMPLETIONS[context.receiver];
      if (!pool && elapsedTimeVariables(value).has(context.receiver)) pool = TIMER_COMPLETIONS;
      // The receiver may be one of the student's own objects, or `this`. Their
      // own methods are the only sensible thing to offer there, and without
      // this a custom class completed nothing at all after the dot.
      if (!pool) pool = ownMethods(value);
    } else {
      pool = GLOBAL_COMPLETIONS.concat(SDK_TYPE_NAMES, ownMethods(value), ownClasses(value), Array.from(variables, function (entry) {
        return {label: entry[0], insertText: entry[0], detail: entry[1] + ' variable'};
      }), ['hardwareMap', 'telemetry', 'gamepad1', 'gamepad2'].map(function (name) {
        return {label: name, insertText: name, detail: 'OpMode field'};
      }));
      if (!options.force && context.prefix.length < 2) return [];
    }
    if (!pool) return [];
    // Case sensitive, because Java is. Matching case-insensitively meant
    // `dcmotor` offered `DcMotor`, which the compiler will not accept: the
    // student is taught the name is spelled however they felt like typing it,
    // and finds out otherwise from an error much later.
    const prefix = context.prefix;
    return pool.filter(function (item, index) { return pool.findIndex(function (other) { return other.label === item.label; }) === index; })
      .filter(function (item) { return !prefix || item.label.indexOf(prefix) === 0; })
      .map(function (item) {
        return Object.assign({}, item, {
          replaceStart: context.replaceStart,
          replaceEnd: context.replaceEnd,
        });
      });
  }

  function closeCompletions(editor) {
    const state = editor && editor.__telemarkCompletion;
    if (!state) return;
    if (state.menu && typeof state.menu.remove === "function") state.menu.remove();
    delete editor.__telemarkCompletion;
    if (typeof editor.removeAttribute === "function") editor.removeAttribute("aria-activedescendant");
  }

  function positionCompletionMenu(menu, editor) {
    const doc = editor.ownerDocument || runtimeRoot().document;
    const view = doc && doc.defaultView || runtimeRoot();
    const style = view && typeof view.getComputedStyle === "function"
      ? view.getComputedStyle(editor)
      : null;
    if (!style || !editor.getBoundingClientRect) return;
    const rect = editor.getBoundingClientRect();
    const mirror = doc.createElement('div');
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth',
      'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'tabSize',
      'textIndent', 'textTransform'].forEach(function (key) { mirror.style[key] = style[key]; });
    Object.assign(mirror.style, {position: 'fixed', visibility: 'hidden', left: '0', top: '0',
      width: rect.width + 'px', borderStyle: 'solid',
      whiteSpace: editor.wrap === 'off' ? 'pre' : 'pre-wrap', overflowWrap: 'break-word'});
    mirror.textContent = editor.value.slice(0, editor.selectionStart);
    const caret = doc.createElement('span');
    caret.textContent = editor.value.slice(editor.selectionStart) || '\u200b';
    mirror.appendChild(caret);
    doc.body.appendChild(mirror);
    // A multiline span's bounding box starts at its leftmost line, not the caret.
    const marker = caret.getClientRects()[0] || caret.getBoundingClientRect();
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const x = rect.left + marker.left - editor.scrollLeft;
    const y = rect.top + marker.top - editor.scrollTop;
    mirror.remove();
    const viewport = view.visualViewport;
    const left = viewport ? viewport.offsetLeft : 0;
    const top = viewport ? viewport.offsetTop : 0;
    const width = viewport ? viewport.width : view.innerWidth;
    const height = viewport ? viewport.height : view.innerHeight;
    const below = top + height - (y + lineHeight) - 8;
    const above = y - top - 8;
    const flip = below < 180 && above > below;
    menu.style.width = Math.min(380, width - 16) + 'px';
    menu.style.maxHeight = Math.max(40, Math.min(290, flip ? above : below)) + 'px';
    const box = menu.getBoundingClientRect();
    menu.style.left = Math.max(left + 8, Math.min(x, left + width - box.width - 8)) + 'px';
    menu.style.top = Math.max(top + 8, Math.min(flip ? y - box.height : y + lineHeight,
      top + height - box.height - 8)) + 'px';
    menu.style.visibility = y < rect.top || y > rect.bottom ? 'hidden' : 'visible';
  }

  function renderCompletions(editor) {
    const state = editor.__telemarkCompletion;
    if (!state || !state.menu) return;
    const doc = editor.ownerDocument || runtimeRoot().document;
    state.menu.innerHTML = "";
    state.candidates.forEach(function (candidate, index) {
      const option = doc.createElement("button");
      option.type = "button";
      option.className = "telemark-completion-option" + (index === state.index ? " active" : "");
      option.id = state.id + "-" + index;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", index === state.index ? "true" : "false");
      const label = doc.createElement("span");
      label.className = "telemark-completion-label";
      label.textContent = candidate.label;
      const detail = doc.createElement("span");
      detail.className = "telemark-completion-detail";
      detail.textContent = candidate.detail || "";
      option.appendChild(label);
      option.appendChild(detail);
      option.addEventListener("mousedown", function (event) {
        event.preventDefault();
        applyCompletion(editor, candidate);
      });
      state.menu.appendChild(option);
    });
    const footer = doc.createElement("div");
    footer.className = "telemark-completion-footer";
    footer.textContent = "↑↓ choose  •  Tab or Enter insert  •  Ctrl+Space open";
    state.menu.appendChild(footer);
    if (typeof editor.setAttribute === "function") {
      editor.setAttribute("aria-activedescendant", state.id + "-" + state.index);
    }
    positionCompletionMenu(state.menu, editor);
    const active = state.menu.querySelector('[aria-selected="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({block: 'nearest'});
  }

  function showCompletions(editor, force) {
    const candidates = getCompletions(editor.value, editor.selectionStart, {force: force});
    if (!candidates.length) {
      closeCompletions(editor);
      return false;
    }
    const doc = editor.ownerDocument || runtimeRoot().document;
    if (!doc || typeof doc.createElement !== "function") return false;
    closeCompletions(editor);
    const host = doc.body;
    const menu = doc.createElement("div");
    const id = "telemark-completions-" + Math.random().toString(36).slice(2);
    menu.className = "telemark-completion-menu";
    menu.id = id;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Java code completions");
    host.appendChild(menu);
    editor.__telemarkCompletion = {menu: menu, candidates: candidates, index: 0, id: id};
    if (typeof editor.setAttribute === "function") {
      editor.setAttribute("aria-autocomplete", "list");
      editor.setAttribute("aria-controls", id);
    }
    renderCompletions(editor);
    return true;
  }

  function dispatchEditorInput(editor) {
    if (typeof editor.dispatchEvent !== "function") return;
    const EventType = runtimeRoot().Event;
    if (typeof EventType === "function") editor.dispatchEvent(new EventType("input", {bubbles: true}));
  }

  function applyCompletion(editor, candidate) {
    if (!editor || !candidate) return false;
    const text = candidate.insertText || candidate.label;
    const cursor = candidate.replaceStart + (
      candidate.cursorOffset == null ? text.length : candidate.cursorOffset
    );
    editor.__telemarkApplyingCompletion = true;
    replaceRange(editor, candidate.replaceStart, candidate.replaceEnd, text, cursor);
    closeCompletions(editor);
    dispatchEditorInput(editor);
    delete editor.__telemarkApplyingCompletion;
    if (typeof editor.focus === "function") editor.focus();
    return true;
  }

  function prevent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function editLines(editor, start, end, indent, remove) {
    const text = editor.value;
    const blockStart = lineStartAt(text, start);
    let blockEnd = end;
    if (end > start && text[end - 1] === "\n") blockEnd -= 1;
    const block = text.slice(blockStart, blockEnd);
    const lines = block.split("\n");
    const changes = [];
    let sourceOffset = 0;

    const transformed = lines.map(function (line) {
      if (!remove) {
        changes.push({position: sourceOffset, removed: 0, inserted: indent.length});
        sourceOffset += line.length + 1;
        return indent + line;
      }

      let count = 0;
      if (line[0] === "\t") count = 1;
      else {
        while (count < indent.length && line[count] === " ") count += 1;
      }
      if (count) changes.push({position: sourceOffset, removed: count, inserted: 0});
      sourceOffset += line.length + 1;
      return line.slice(count);
    }).join("\n");

    function mapPosition(position) {
      const relative = position - blockStart;
      let delta = 0;
      for (const change of changes) {
        if (change.position > relative) continue;
        if (change.removed) {
          delta -= Math.min(change.removed, Math.max(0, relative - change.position));
        } else {
          delta += change.inserted;
        }
      }
      return blockStart + relative + delta;
    }

    const replacementEnd = blockEnd;
    const newStart = mapPosition(start);
    const newEnd = mapPosition(end);
    replaceRange(editor, blockStart, replacementEnd, transformed, newStart, newEnd);
  }

  function handleTab(editor, event, indent) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    prevent(event);

    if (start !== end || editor.value.slice(start, end).includes("\n")) {
      editLines(editor, start, end, indent, event.shiftKey);
      return true;
    }

    if (!event.shiftKey) {
      replaceRange(editor, start, end, indent, start + indent.length);
      return true;
    }

    const lineStart = lineStartAt(editor.value, start);
    const line = editor.value.slice(lineStart).split("\n", 1)[0];
    let removeCount = 0;
    if (line[0] === "\t") removeCount = 1;
    else {
      while (removeCount < indent.length && line[removeCount] === " ") removeCount += 1;
    }
    if (removeCount) {
      replaceRange(
        editor,
        lineStart,
        lineStart + removeCount,
        "",
        Math.max(lineStart, start - removeCount),
      );
    }
    return true;
  }

  function shouldIndentUnbracedControl(line) {
    const trimmed = line.trim();
    return /^(?:(?:if|for|while|switch|catch|synchronized)\s*\(.*\)|else(?:\s+if\s*\(.*\))?|do|try|finally)$/.test(trimmed)
      || /^(?:case\b.*|default)\s*:$/.test(trimmed);
  }

  function handleEnter(editor, event, indentUnit) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    const lineBefore = before.slice(lineStartAt(before, before.length));
    const lineAfter = after.split("\n", 1)[0];
    const indent = leadingWhitespace(lineBefore);
    const opensBlock = lineBefore.trimEnd().endsWith("{");
    const closesBlock = lineAfter.trimStart().startsWith("}");
    let insertion;
    let cursorOffset;

    prevent(event);
    if (opensBlock && closesBlock) {
      const innerIndent = indent + indentUnit;
      insertion = "\n" + innerIndent + "\n" + indent;
      cursorOffset = 1 + innerIndent.length;
    } else {
      const extra = opensBlock || shouldIndentUnbracedControl(lineBefore) ? indentUnit : "";
      insertion = "\n" + indent + extra;
      cursorOffset = insertion.length;
    }

    replaceRange(editor, start, end, insertion, start + cursorOffset);
    return true;
  }

  function handleKeydown(event, options) {
    options = options || {};
    const editor = event.currentTarget || event.target;
    if (!editor || typeof editor.value !== "string" || event.isComposing) return false;
    if ((event.ctrlKey || event.metaKey || event.altKey) && event.key !== "Tab") return false;

    const indent = options.indent || DEFAULT_INDENT;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const key = event.key;

    if (key === "Tab") return handleTab(editor, event, indent);
    if (key === "Enter") return handleEnter(editor, event, indent);

    if (key === "Backspace" && start === end && start > 0) {
      const opening = editor.value[start - 1];
      if (PAIRS[opening] === editor.value[start]) {
        prevent(event);
        replaceRange(editor, start - 1, start + 1, "", start - 1);
        return true;
      }
    }

    // A manually typed closing brace on an indented blank line belongs one
    // level out, aligned with the statement that opened the block.
    if (key === "}" && start === end) {
      const lineStart = lineStartAt(editor.value, start);
      const linePrefix = editor.value.slice(lineStart, start);
      if (/^\s+$/.test(linePrefix)) {
        const removeCount = linePrefix.endsWith("\t")
          ? 1
          : Math.min(indent.length, (linePrefix.match(/ +$/) || [""])[0].length);
        if (removeCount) {
          prevent(event);
          if (editor.value[start] === "}") {
            replaceRange(editor, start - removeCount, start, "", start - removeCount + 1);
          } else {
            replaceRange(editor, start - removeCount, start, "}", start - removeCount + 1);
          }
          return true;
        }
      }
    }

    // Overtype an automatically inserted closer instead of duplicating it.
    if (CLOSERS.has(key) && start === end && editor.value[start] === key) {
      prevent(event);
      editor.selectionStart = editor.selectionEnd = start + 1;
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(PAIRS, key)) {
      if ((key === '"' || key === "'") && editor.value[start - 1] === "\\") return false;
      prevent(event);
      const selected = editor.value.slice(start, end);
      replaceRange(
        editor,
        start,
        end,
        key + selected + PAIRS[key],
        start + 1,
        start + 1 + selected.length,
      );
      return true;
    }

    return false;
  }

  function attach(editor, options) {
    if (!editor) return function () {};
    if (editor.__telemarkEditorDetach) return editor.__telemarkEditorDetach;
    options = options || {};

    const listener = function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === " ") {
        prevent(event);
        showCompletions(editor, true);
        return;
      }
      const completion = editor.__telemarkCompletion;
      if (completion) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
          closeCompletions(editor);
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          prevent(event);
          const direction = event.key === "ArrowDown" ? 1 : -1;
          completion.index = (completion.index + direction + completion.candidates.length)
            % completion.candidates.length;
          renderCompletions(editor);
          return;
        }
        if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
          prevent(event);
          applyCompletion(editor, completion.candidates[completion.index]);
          if (typeof options.onChange === "function") options.onChange(editor);
          return;
        }
        if (event.key === "Escape") {
          prevent(event);
          closeCompletions(editor);
          return;
        }
      }
      const handled = handleKeydown(event, options);
      if (handled) {
        clearDiagnostics();
        saveDraft(editor, options);
        if (typeof options.onChange === "function") options.onChange(editor);
      }
    };
    const completionInput = function () {
      if (!editor.__telemarkApplyingCompletion) showCompletions(editor, false);
    };
    const completionBlur = function () {
      const defer = runtimeRoot().setTimeout || function (fn) { fn(); };
      defer(function () { closeCompletions(editor); }, 120);
    };
    editor.addEventListener("keydown", listener);
    editor.addEventListener("input", completionInput);
    editor.addEventListener("blur", completionBlur);
    const reposition = function () {
      if (editor.__telemarkCompletion) positionCompletionMenu(editor.__telemarkCompletion.menu, editor);
    };
    const view = editor.ownerDocument && editor.ownerDocument.defaultView;
    if (view) {
      view.addEventListener('scroll', reposition, true);
      view.addEventListener('resize', reposition);
    }
    const selectionChanged = function () { closeCompletions(editor); };
    editor.addEventListener('click', selectionChanged);
    bindPersistence(editor, options);
    editor.__telemarkEditorDetach = function () {
      editor.removeEventListener("keydown", listener);
      editor.removeEventListener("input", completionInput);
      editor.removeEventListener("blur", completionBlur);
      editor.removeEventListener('click', selectionChanged);
      if (view) {
        view.removeEventListener('scroll', reposition, true);
        view.removeEventListener('resize', reposition);
      }
      closeCompletions(editor);
      delete editor.__telemarkEditorDetach;
    };
    return editor.__telemarkEditorDetach;
  }

  function autoBindEditors() {
    const host = runtimeRoot();
    const doc = host.document;
    if (!doc || typeof doc.querySelectorAll !== "function") return;
    const bind = function (root) {
      if (root && typeof root.matches === "function" && root.matches("textarea")) {
        bindPersistence(root, {restore: root.id !== "sim-code-editor"});
      }
      if (!root || typeof root.querySelectorAll !== "function") return;
      root.querySelectorAll("textarea").forEach(function (editor) {
        bindPersistence(editor, {restore: editor.id !== "sim-code-editor"});
      });
    };
    bind(doc);
    if (typeof host.MutationObserver === "function") {
      const observer = new host.MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes || [], bind);
        });
      });
      const target = doc.documentElement || doc.body;
      if (target) observer.observe(target, {childList: true, subtree: true});
    }
  }

  const host = runtimeRoot();
  if (host.document) {
    if (host.document.readyState === "loading" && typeof host.document.addEventListener === "function") {
      host.document.addEventListener("DOMContentLoaded", autoBindEditors, {once: true});
    } else {
      autoBindEditors();
    }
  }

  return Object.freeze({
    version: "1.2.0",
    applyCompletion: applyCompletion,
    attach: attach,
    bindPersistence: bindPersistence,
    clearDiagnostics: clearDiagnostics,
    draftKey: draftKey,
    getCompletions: getCompletions,
    handleKeydown: handleKeydown,
    restoreDraft: restoreDraft,
    saveDraft: saveDraft,
  });
});
