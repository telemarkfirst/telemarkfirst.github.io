const assert = require('node:assert/strict');
const TelemarkEditor = require('../static/simulator/telemark-editor.js');

function makeEditor(value, selectionStart = value.length, selectionEnd = selectionStart) {
  const listeners = new Map();
  return {
    id: 'code-editor',
    value,
    selectionStart,
    selectionEnd,
    setRangeText(replacement, start, end) {
      this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    press(key, extra = {}) {
      const event = {
        key,
        currentTarget: this,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
        ...extra,
      };
      const listener = listeners.get('keydown');
      if (listener) listener(event);
      else TelemarkEditor.handleKeydown(event);
      return event;
    },
  };
}

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function testClosingDelimiterOvertype() {
  const editor = makeEditor('telemetry.update');
  editor.press('(');
  assert.equal(editor.value, 'telemetry.update()');
  assert.equal(editor.selectionStart, 'telemetry.update('.length);

  editor.press(')');
  assert.equal(editor.value, 'telemetry.update()');
  assert.equal(editor.selectionStart, editor.value.length);
}

function testPairingAndSelectionWrapping() {
  for (const [opening, closing] of Object.entries({
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
  })) {
    const empty = makeEditor('');
    empty.press(opening);
    assert.equal(empty.value, opening + closing);
    assert.equal(empty.selectionStart, 1);

    const selected = makeEditor('ready', 0, 5);
    selected.press(opening);
    assert.equal(selected.value, opening + 'ready' + closing);
    assert.deepEqual(
      [selected.selectionStart, selected.selectionEnd],
      [1, 6],
    );
  }
}

function testStructuredEnterIndentation() {
  for (const header of ['if (ready) ', 'else ', 'for (int i = 0; i < 3; i++) ', 'while (active) ']) {
    const editor = makeEditor(header);
    editor.press('{');
    editor.press('Enter');
    assert.equal(editor.value, header + '{\n    \n}');
    assert.equal(editor.selectionStart, (header + '{\n    ').length);
  }

  const unbraced = makeEditor('while (active)');
  unbraced.press('Enter');
  assert.equal(unbraced.value, 'while (active)\n    ');
}

function testPairedBackspaceAndBraceDedent() {
  const pair = makeEditor('()', 1);
  pair.press('Backspace');
  assert.equal(pair.value, '');
  assert.equal(pair.selectionStart, 0);

  const brace = makeEditor('        }', 8);
  brace.press('}');
  assert.equal(brace.value, '    }');
  assert.equal(brace.selectionStart, 5);
}

function testMultilineIndentAndOutdent() {
  const editor = makeEditor('    foo\n    bar', 4, 15);
  editor.press('Tab');
  assert.equal(editor.value, '        foo\n        bar');
  assert.deepEqual([editor.selectionStart, editor.selectionEnd], [8, 23]);

  editor.press('Tab', {shiftKey: true});
  assert.equal(editor.value, '    foo\n    bar');
  assert.deepEqual([editor.selectionStart, editor.selectionEnd], [4, 15]);

  const singleLine = makeEditor('    telemetry  .update()', 18);
  singleLine.press('Tab', {shiftKey: true});
  assert.equal(singleLine.value, 'telemetry  .update()');
  assert.equal(singleLine.selectionStart, 14);

  const unindented = makeEditor('telemetry  .update()', 12);
  unindented.press('Tab', {shiftKey: true});
  assert.equal(unindented.value, 'telemetry  .update()');
}

function testSingleChangeNotification() {
  const editor = makeEditor('if (ready) ');
  let changes = 0;
  TelemarkEditor.attach(editor, {
    onChange() {
      changes += 1;
    },
  });
  editor.press('{');
  assert.equal(changes, 1);
  editor.press('Enter');
  assert.equal(changes, 2);
}

function testDraftPersistenceByLesson() {
  const storage = makeStorage();
  const unitTwo = {
    storage,
    location: {pathname: '/simulator/unit2.html', search: '?lesson=challenge&code=starter-a'},
  };
  const unitThree = {
    storage,
    location: {pathname: '/simulator/unit3.html', search: '?lesson=challenge&code=starter-b'},
  };
  const edited = makeEditor('frontLeft.setPower(0.5);');
  assert.equal(TelemarkEditor.saveDraft(edited, unitTwo), true);

  const restored = makeEditor('starter');
  assert.equal(TelemarkEditor.restoreDraft(restored, unitTwo), true);
  assert.equal(restored.value, edited.value);

  const otherLesson = makeEditor('other starter');
  assert.equal(TelemarkEditor.restoreDraft(otherLesson, unitThree), false);
  assert.equal(otherLesson.value, 'other starter');
  assert.notEqual(
    TelemarkEditor.draftKey(edited, unitTwo),
    TelemarkEditor.draftKey(edited, unitThree),
  );
}

function testPairedEditsAreSaved() {
  const storage = makeStorage();
  const options = {storage, scope: 'unit-4-test', restore: false};
  const editor = makeEditor('telemetry.update');
  TelemarkEditor.attach(editor, options);
  editor.press('(');

  const freshEditor = makeEditor('starter');
  assert.equal(TelemarkEditor.restoreDraft(freshEditor, options), true);
  assert.equal(freshEditor.value, 'telemetry.update()');
}

function testContextAwareCompletions() {
  const telemetry = TelemarkEditor.getCompletions('telemetry.ad', 'telemetry.ad'.length);
  assert.deepEqual(telemetry.map((item) => item.label), ['addData']);
  assert.equal(telemetry[0].replaceStart, 'telemetry.'.length);

  const hardware = TelemarkEditor.getCompletions('hardwareMap.', 'hardwareMap.'.length);
  assert.deepEqual(hardware.map((item) => item.label), ['get', 'tryGet']);

  const timerSource = 'ElapsedTime liftTimer = new ElapsedTime();\nliftTimer.sec';
  const timer = TelemarkEditor.getCompletions(timerSource, timerSource.length);
  assert.deepEqual(timer.map((item) => item.label), ['seconds']);

  const global = TelemarkEditor.getCompletions('wh', 2);
  assert.deepEqual(global.map((item) => item.label), ['while']);
}

function testApplyCompletion() {
  const value = 'telemetry.up';
  const editor = makeEditor(value);
  const [candidate] = TelemarkEditor.getCompletions(value, value.length);
  assert.equal(TelemarkEditor.applyCompletion(editor, candidate), true);
  assert.equal(editor.value, 'telemetry.update()');
  assert.equal(editor.selectionStart, editor.value.length);
}

function testTypedVariablesAndMethods() {
  for (const [type, name, prefix, expected] of [
    ['DcMotor', 'armLift', 'setP', 'setPower'],
    ['DcMotorEx', 'flywheel', 'setV', 'setVelocity'],
    ['DcMotorEx', 'flywheel', 'setVelocityP', 'setVelocityPIDFCoefficients'],
    ['Servo', 'claw', 'setP', 'setPosition'],
    ['ElapsedTime', 'timer', 'sec', 'seconds'],
  ]) {
    const source = `${type} ${name};\n${name}.${prefix}`;
    assert.ok(TelemarkEditor.getCompletions(source, source.length).some(item => item.label === expected));
  }
  const source = 'DcMotor left, right;\ndouble targetHeight = 0;\ntar';
  assert.ok(TelemarkEditor.getCompletions(source, source.length).some(item => item.label === 'targetHeight'));
  const right = 'DcMotor left, right;\nright.setP';
  const [candidate] = TelemarkEditor.getCompletions(right, right.length);
  assert.equal(candidate.label, 'setPower');
  const editor = makeEditor(right);
  TelemarkEditor.applyCompletion(editor, candidate);
  assert.equal(editor.value[editor.selectionStart - 1], '(');
  for (const comment of ['// lift.setP', '/* lift.setP', '"lift.setP']) {
    const text = 'DcMotor lift;\n' + comment;
    assert.deepEqual(TelemarkEditor.getCompletions(text, text.length), []);
  }
}

testClosingDelimiterOvertype();
testPairingAndSelectionWrapping();
testStructuredEnterIndentation();
testPairedBackspaceAndBraceDedent();
testMultilineIndentAndOutdent();
testSingleChangeNotification();
testDraftPersistenceByLesson();
testPairedEditsAreSaved();
testContextAwareCompletions();
testApplyCompletion();
testTypedVariablesAndMethods();
for (const word of ['public', 'private', 'protected', 'static', 'void', 'init', 'loop', 'runOpMode']) {
  const source = word.slice(0, 2);
  const candidate = TelemarkEditor.getCompletions(source, source.length).find(item => item.label === word);
  assert.ok(candidate, `completion for ${word}`);
  const editor = makeEditor(source);
  TelemarkEditor.applyCompletion(editor, candidate);
  assert.equal(editor.value, word + (['init', 'loop', 'runOpMode'].includes(word) ? '()' : ''));
}
console.log('TelemarkEditor tests passed');
