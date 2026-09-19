const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const java = require('../static/simulator/telemark-java.js');
assert.doesNotMatch(fs.readFileSync('static/simulator/telemark-project.js','utf8'), /\b(?:global|window)\.(?:alert|confirm|prompt)\s*\(/, 'project controls do not use browser-native dialogs');
const context = {TelemarkJava: java, document: {currentScript: null}};
context.window = context;
vm.runInNewContext(fs.readFileSync('static/simulator/mastery_challenge.js', 'utf8'), context);
const files = [
`package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
@TeleOp(name="Test") public class Test extends OpMode {
  LinearSlide slide = new LinearSlide();
  public void init() { slide.init(hardwareMap); }
  public void loop() { slide.move(gamepad1.left_stick_y); }
}`,
`package org.firstinspires.ftc.teamcode;
import com.qualcomm.robotcore.hardware.*;
public class LinearSlide {
  DcMotor motor; DigitalChannel limit; AnalogInput pot;
  public void init(HardwareMap hw) {
    motor = hw.get(DcMotor.class, Config.MOTOR);
    limit = hw.get(DigitalChannel.class, Config.LIMIT);
    pot = hw.get(AnalogInput.class, Config.POT);
    limit.setMode(DigitalChannel.Mode.INPUT);
  }
  public void move(double power) {
    double voltage = pot.getVoltage();
    if (!limit.getState()) { motor.setPower(0); }
    else { motor.setPower(power); }
  }
}`,
`package org.firstinspires.ftc.teamcode;
public class Config {
  public static final String MOTOR = "mechanism";
  public static final String LIMIT = "mechanism_limit";
  public static final String POT = "mechanism_pot";
}`];
const source = files.join('\n');
const evaluate = code => Array.from(context.TelemarkMasteryChallenge.evaluate(7, code));
const projectFiles=files.map((source,i)=>({name:['Test.java','LinearSlide.java','Config.java'][i],source}));
const stage7Source = `
class Drivetrain { void init(HardwareMap hardwareMap) { hardwareMap.get(DcMotor.class, "leftFront"); } void drive() {} }
class Intake { void init(HardwareMap hardwareMap) { hardwareMap.get(DcMotor.class, "intake"); } }
class Transfer { void init(HardwareMap hardwareMap) { hardwareMap.get(DcMotor.class, "transfer"); } }
class Launcher { private DcMotor flywheel; void init(HardwareMap hardwareMap) { flywheel = hardwareMap.get(DcMotor.class, "launcher"); } }
class ArtifactSensors { private int storedArtifacts; void init(HardwareMap hardwareMap) { hardwareMap.get(DigitalChannel.class, "artifact_entry"); } boolean hasCapacity() { return storedArtifacts < 3; } }
class CompetitionTeleOp extends OpMode { Drivetrain drivetrain = new Drivetrain(); void init() { drivetrain.init(hardwareMap); } void loop() { if (gamepad1.right_bumper) drivetrain.drive(); } }
`;
assert.deepEqual(evaluate(stage7Source), Array(6).fill(true), 'all DECODE subsystems own their Unit 7 hardware mapping');
assert.equal(evaluate(stage7Source.replace('drivetrain.init(hardwareMap);', 'hardwareMap.get(DcMotor.class, "leftFront");'))[5], false, 'CompetitionTeleOp cannot map raw hardware');
assert.ok(!evaluate('/*' + stage7Source + '*/').every(Boolean), 'comments cannot satisfy project criteria');
console.log('Unit 7 cumulative subsystem checks passed.');

const {JSDOM} = require('jsdom');
function editorPage(saved, initialFiles) {
  const dom = new JSDOM('<div><div><textarea id="code-editor"></textarea></div></div>', {url: 'https://example.test/unit7', runScripts: 'outside-only'});
  const w = dom.window;
  w.TelemarkJava = java;
  w.eval(fs.readFileSync('static/simulator/telemark-editor.js', 'utf8'));
  w.eval(fs.readFileSync('static/simulator/telemark-project.js', 'utf8'));
  if (saved) for (const [key, value] of saved) w.localStorage.setItem(key, value);
  const editor = w.document.querySelector('textarea');
  editor.value = files[0];
  const project = w.TelemarkProject.attach(editor, () => {}, {initialFiles});
  return {w, editor, project};
}
const page = editorPage();
let syntheticInputs=0;
page.editor.addEventListener('input',()=>syntheticInputs++);
function click(label) {
  const button = [...page.w.document.querySelectorAll('button')].find(b => b.textContent === label);
  assert.ok(button, `button ${label} exists`);
  button.click();
}
assert.equal([...page.w.document.querySelectorAll('button')].some(button=>button.textContent==='Add file'),false,'file operations stay out of the permanent toolbar');
assert.ok([...page.w.document.querySelectorAll('button')].some(button=>button.textContent==='Export'),'export remains directly available');
click('+');
assert.equal(page.w.document.querySelector('.telemark-project-package-badge').textContent,'package org.firstinspires.ftc.teamcode;');
page.w.document.querySelector('dialog input').value = 'LinearSlide.java';
click('Create file');
assert.match(page.editor.value,/^package org\.firstinspires\.ftc\.teamcode;/,'new files always use the TeamCode package');
page.editor.value = files[1];
// Keyboard editing uses saveDraft without an input event.
page.w.TelemarkEditor.saveDraft(page.editor);
click('Test.java');
assert.equal(page.editor.value, files[0]);
const mainTab=[...page.w.document.querySelectorAll('.telemark-project-tab')].find(b=>b.textContent==='Test.java');
const helperTab=[...page.w.document.querySelectorAll('.telemark-project-tab')].find(b=>b.textContent==='LinearSlide.java');
for(let i=0;i<4;i++) { helperTab.click(); assert.equal(page.editor.value,files[1]); mainTab.click(); assert.equal(page.editor.value,files[0]); }
assert.equal(syntheticInputs,0,'file switches never masquerade as user edits');
assert.equal(mainTab.isConnected,true,'switching files does not rebuild the project toolbar');
assert.ok(page.project.source().includes(files[1]), 'inactive helper participates in compilation');
assert.equal(page.project.diagnosticLocation(files[0].split('\n').length + 2), 'LinearSlide.java:1');
assert.equal(java.compile(page.project.source(), java.createRuntime()).ok, false, 'the imported mechanism reports its missing Config file');
click('LinearSlide.java');
assert.equal(page.editor.value, files[1]);
const saved = Object.entries(page.w.localStorage);
page.w.document.querySelector('button[aria-label="Delete LinearSlide.java"]').click();
assert.match(page.w.document.querySelector('dialog').textContent,/Delete LinearSlide\.java/,'delete uses an in-page confirmation card');
click('Cancel');
assert.ok(page.project.source().includes('public class LinearSlide'),'cancel keeps the file');
page.w.document.querySelector('button[aria-label="Delete LinearSlide.java"]').click();
click('Delete file');
assert.ok(!page.project.source().includes('public class LinearSlide'), 'deleted helper is excluded');
const restored = editorPage(saved);
assert.equal(restored.editor.value, files[1]);
assert.ok(restored.project.source().includes(files[0]));
const restoredHelperTab=[...restored.w.document.querySelectorAll('.telemark-project-tab')].find(b=>b.textContent==='LinearSlide.java');
restoredHelperTab.dispatchEvent(new restored.w.KeyboardEvent('keydown',{key:'Delete',shiftKey:true,bubbles:true}));
assert.equal(restored.w.document.querySelector('dialog'),null,'Shift+Delete skips the confirmation dialog');
assert.ok(!restored.project.source().includes('public class LinearSlide'),'Shift+Delete immediately removes the focused file');
restored.project.reset(files[0]);
assert.ok(!restored.project.source().includes('public class LinearSlide'));
assert.equal(restored.w.document.querySelectorAll('.telemark-project-tab').length, 1);
const supplied = editorPage(null, [
  {name: 'Test.java', source: files[0]},
  {name: 'LinearSlide.java', source: files[1]},
]);
assert.deepEqual(
  [...supplied.w.document.querySelectorAll('.telemark-project-tab')].map(tab => tab.textContent),
  ['Test.java', 'LinearSlide.java'],
  'a lesson can reveal supplied helper files as tabs on first load',
);
const unit7Source = fs.readFileSync('static/simulator/unit7.html', 'utf8');
assert.match(unit7Source, /telemark-host-fullscreen #robot-canvas\{height:clamp/);
assert.match(unit7Source, /camera\.updateProjectionMatrix\(\);\s*renderer\.setSize\(w, h, false\)/);
assert.match(unit7Source, /telemark:simulator-fullscreen-state/);
page.w.close(); restored.w.close(); supplied.w.close();
console.log('Unit 7 multi-file editing and recovery tests passed.');
