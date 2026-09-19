const assert = require('node:assert/strict');
const editor = require('../static/simulator/telemark-editor.js');

/**
 * Tests for the additions to the editor's completion: case sensitivity,
 * annotations, and the student's own classes and methods.
 *
 * The engine itself is Alex's; these cover the three things the captain's list
 * asked for, and are kept apart from telemark-editor.test.cjs so a failure
 * says which of the two is broken.
 */
const at = (source, cursor) =>
  editor.getCompletions(source, cursor === undefined ? source.length : cursor, {force: true})
    .map((item) => item.label);

// ── Case sensitivity ────────────────────────────────────────────────────────
// Matching used to lowercase both sides, so `dcmotor` offered `DcMotor`, a name
// the compiler will not accept.
const decl = 'DcMotor leftFront;\n';
assert.ok(at(decl + 'DcM').includes('DcMotor'), 'DcM offers DcMotor');
assert.ok(!at(decl + 'dcm').includes('DcMotor'), 'dcm does not');
assert.ok(!at(decl + 'DCMOTOR').includes('DcMotor'), 'shouting does not');
assert.ok(at(decl + 'left').includes('leftFront'), 'a lowercase name still matches lowercase');
assert.ok(!at(decl + 'Left').includes('leftFront'), 'and not from the wrong case');

// Members are case sensitive too.
const motorSource = 'DcMotor arm;\narm.setP';
assert.ok(at(motorSource).some((label) => label.startsWith('setP')));
assert.deepEqual(at('DcMotor arm;\narm.SETP'), [], 'a shouted member matches nothing');

// ── Annotations ─────────────────────────────────────────────────────────────
assert.ok(at('@Ov').includes('@Override'), '@Ov offers @Override');
assert.ok(at('@Tele').includes('@TeleOp'));
assert.ok(at('@Auto').includes('@Autonomous'));
assert.ok(at('@').length > 0, 'a bare @ offers the set');
assert.ok(!at('@ov').includes('@Override'), 'annotations are case sensitive as well');

// The @ has to be inside the replaced range, or accepting a completion on a
// typed "@Ov" leaves "@@Override" behind.
const annotation = editor.getCompletions('@Ov', 3, {force: true})[0];
assert.equal(annotation.replaceStart, 0, 'the range starts at the @');
assert.equal(annotation.replaceEnd, 3);

// ── The student's own classes and methods ───────────────────────────────────
const own = [
  'public class Intake {',
  '  private DcMotor spinner;',
  '  public void collect(double power) {',
  '    spinner.setPower(power);',
  '  }',
  '  public boolean isFull() { return true; }',
  '}',
  'Intake intake;',
].join('\n');

assert.ok(at(own + '\nInt').includes('Intake'), 'their class completes');
assert.ok(at(own + '\ncoll').includes('collect'), 'their method completes');
assert.ok(at(own + '\nisF').includes('isFull'));
assert.ok(at(own + '\nintake.').includes('collect'), 'and after a dot on their own object');
assert.ok(at(own + '\nintake.').includes('isFull'));

// A call is not a declaration: the opening brace is what separates them.
const callOnly = 'public void loop() {\n  doThing(1);\n}\ndoT';
assert.ok(!at(callOnly).includes('doThing'), 'a call is not offered as a method');
assert.ok(at('public void loop() {\n}\nloo').includes('loop'), 'a declaration is');

// Control flow is not read as one of their methods, though `if (x) {` has the
// same shape. `if` is still offered, as the snippet it already was, so the
// check is on what it is offered as rather than on whether it appears.
const ifItems = editor
  .getCompletions('public void loop() {\n  if (x) { }\n}\nif', 38, {force: true})
  .filter((item) => item.label === 'if');
assert.ok(!ifItems.some((item) => /your .* method/.test(item.detail || '')));

// What was already there still works, so none of this broke Alex's engine.
assert.ok(at('telemetry.ad').includes('addData'));
assert.ok(at('hardwareMap.').length > 0);

// Accepting one of their methods leaves the caret where the next keystroke
// belongs: inside the brackets when it takes something, after them when it
// does not. This follows the convention the built-in completions already use.
const withArgs = editor
  .getCompletions(own + '\ncoll', (own + '\ncoll').length, {force: true})
  .find((item) => item.label === 'collect');
assert.equal(withArgs.insertText, 'collect()');
assert.equal(withArgs.cursorOffset, 'collect'.length + 1, 'caret sits inside the brackets');

const noArgs = editor
  .getCompletions(own + '\nisF', (own + '\nisF').length, {force: true})
  .find((item) => item.label === 'isFull');
assert.equal(noArgs.cursorOffset, 'isFull'.length + 2, 'caret sits after them');

console.log('Completion case and annotation tests passed (%d cases)', 25);
