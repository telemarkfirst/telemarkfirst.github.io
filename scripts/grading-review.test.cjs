const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const javaSource = fs.readFileSync('static/simulator/telemark-java.js', 'utf8');
const baseSource = fs.readFileSync('static/simulator/simulator_base.js', 'utf8');
const storageKey = 'telemark:grading-overrides:v1';

function createPage(saved) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="sim-header-title"></div><div id="sim-header-sub"></div>
    <div id="sim-challenge-title-text"></div><div id="sim-challenge-desc"></div>
    <div id="sim-requirements-list"></div>
    <button id="sim-grading-review-button" type="button">Review grading</button>
    <div id="sim-success-banner"></div>
    <textarea id="sim-code-editor"></textarea>
  </body></html>`, {url: 'https://telemark.test/simulator/unit4.mastery.html', runScripts: 'outside-only'});
  const window = dom.window;
  Object.defineProperty(window.document, 'readyState', {value: 'loading', configurable: true});
  if (saved) window.localStorage.setItem(storageKey, saved);
  window.eval(javaSource);
  window.eval(baseSource);
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.document.getElementById('sim-code-editor').value = 'public class Main extends OpMode { public void loop() {} }';
  return {dom, window};
}

function configure(page, onComplete) {
  page.window.setChallenge({
    title: 'Stable grading',
    scenario: 'Review automatic results.',
    projectKey: 'telemark:decode-project:v1',
    lessonId: 'unit-04/mastery-coding-challenge',
    requirements: [
      {id: 'drive-normalized', label: 'Normalize drive power'},
      {id: 'drive-delegated', label: 'Delegate drive control'},
    ],
    onComplete,
  });
}

let completions = 0;
const first = createPage();
configure(first, () => { completions += 1; });
first.window.setChallengeCompilation(true, 'Project compiles.');
first.window.setRequirement(0, true, 'AST check passed.');
first.window.setRequirement(1, false, 'Behavior fixture failed.');
assert.equal(first.window.getRequirementState(0).automatic, true);
assert.equal(first.window.getRequirementState(0).effective, true);
assert.equal(first.window.getRequirementState(1).effective, false);

first.window.setRequirementOverride(1, 'done');
assert.equal(first.window.getRequirementState(1).manual, 'done');
assert.equal(first.window.getRequirementState(1).effective, true, 'manual Done counts after a successful compile');
assert.equal(completions, 1, 'an effective manual pass uses the normal completion callback');
assert.ok(first.window.document.getElementById('sim-success-banner').classList.contains('visible'));

first.window.setRequirementOverride(0, 'not-done');
assert.equal(first.window.getRequirementState(0).effective, false, 'manual Not done blocks an automatic pass');
assert.ok(first.window.document.querySelector('#sim-req-0 .sim-check').classList.contains('fail'));
assert.equal(first.window.document.querySelector('#sim-req-0').textContent.includes('Manual'), false, 'the main checklist has no override badge');

first.window.document.getElementById('sim-grading-review-button').click();
const dialog = first.window.document.getElementById('sim-grading-dialog');
assert.ok(dialog.hasAttribute('open'));
assert.equal(dialog.querySelectorAll('input[type="radio"]').length, 6);
assert.match(dialog.textContent, /Auto/);
assert.match(dialog.textContent, /Done/);
assert.match(dialog.textContent, /Not done/);
const saved = first.window.localStorage.getItem(storageKey);
first.dom.window.close();

const reloaded = createPage(saved);
configure(reloaded);
reloaded.window.setRequirement(0, true);
reloaded.window.setRequirement(1, false);
assert.equal(reloaded.window.getRequirementState(0).manual, 'not-done');
assert.equal(reloaded.window.getRequirementState(1).manual, 'done');
assert.equal(reloaded.window.getRequirementState(1).effective, true, 'persisted Done is compile-gated after reload');

reloaded.window.document.getElementById('sim-code-editor').value = 'public class Main extends OpMode { public void loop( {';
reloaded.window.setChallengeCompilation(false, 'Main.java: malformed method');
reloaded.window.setRequirementOverride(0, 'done');
assert.equal(reloaded.window.getRequirementState(0).effective, false, 'invalid Java cannot be overridden');
assert.equal(reloaded.window.getRequirementState(1).effective, false, 'compile errors gate every criterion');
assert.ok(!reloaded.window.document.getElementById('sim-success-banner').classList.contains('visible'));

reloaded.window.resetRequirementOverrides();
assert.equal(reloaded.window.getRequirementState(0).manual, 'auto');
assert.equal(reloaded.window.getRequirementState(1).manual, 'auto');
assert.deepEqual(JSON.parse(reloaded.window.localStorage.getItem(storageKey) || '{}'), {});

reloaded.window.setChallenge('Legacy challenge', 'Legacy strings still work.', ['First check']);
reloaded.window.setRequirement(0, true);
assert.equal(reloaded.window.getRequirementState(0).effective, true);
assert.match(reloaded.window.getRequirementState(0).id, /^legacy-0-/);
reloaded.dom.window.close();

console.log('Stable grading descriptors and manual review checks passed.');
