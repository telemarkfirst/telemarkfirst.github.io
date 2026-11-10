const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {JSDOM} = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../src/telemark/assistantContext.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
const loaded = {};
new Function('exports', outputText)(loaded);
const {captureSimulatorFiles, captureLessonSection, codeContextError, assistantHistory} = loaded;
let checks = 0;
{
  const {document} = new JSDOM('<iframe class="telemark-simulator"></iframe>').window;
  const doc = document.querySelector('iframe').contentDocument;
  doc.body.innerHTML = '<textarea id="code-editor">class Main {}</textarea>';
  assert.deepEqual(captureSimulatorFiles(document), [{name: 'Main.java', source: 'class Main {}'}]); checks++;
  const files = [{name: 'Main.java', source: 'class Main {\n motor.setPower(0);\n}'}, {name: 'Arm.java', source: 'class Arm {}'}];
  doc.querySelector('textarea').__telemarkProject = {files: () => files};
  const actual = captureSimulatorFiles(document);
  assert.deepEqual(actual, files);
  actual[0].source = 'changed'; assert.equal(files[0].source.includes('setPower'), true); checks++;
  Object.defineProperty(document.querySelector('iframe'), 'contentDocument', {get: () => {throw Error('cross-origin');}});
  assert.deepEqual(captureSimulatorFiles(document), []); checks++;
}
{
  const {document} = new JSDOM('<article class="theme-doc-markdown"><h1>Motor lesson</h1><p>Introduction</p><h2>Mapping</h2><p>Initialize the motor before use.</p><button>Hidden control</button><iframe></iframe><script>never send this()</script><h2>Other section</h2><p>Do not include this section.</p></article>').window;
  const headings = document.querySelectorAll('h2');
  headings[0].getBoundingClientRect = () => ({top: 100});
  headings[1].getBoundingClientRect = () => ({top: 1000});
  const text = captureLessonSection(document);
  assert.match(text, /Mapping.*Initialize the motor/);
  assert.doesNotMatch(text, /Other section|Hidden control|never send/); checks++;
  document.querySelector('article p').textContent = 'a'.repeat(4000);
  headings[0].getBoundingClientRect = () => ({top: 1000});
  assert.equal(captureLessonSection(document).length, 3000); checks++;
}
{
  const {document} = new JSDOM('<article class="theme-doc-markdown"><h1>Motor lesson</h1><h2>Mapping</h2><p>Map the motor in init.</p><h2>Next</h2><p>Other topic.</p></article>').window;
  for (const heading of document.querySelectorAll('h2')) heading.getBoundingClientRect = () => ({top: 1000});
  assert.match(captureLessonSection(document), /Map the motor in init/); checks++;
}
assert.match(codeContextError([{name: 'A.java', source: 'a'.repeat(16001)}]), /16,000/); checks++;
assert.match(codeContextError([{name: 'A.java', source: 'a'}, {name: 'A.java', source: 'b'}]), /unique/); checks++;
assert.equal(codeContextError([{name: 'A.java', source: 'a'.repeat(16000)}]), null); checks++;
assert.equal(assistantHistory([{role: 'you', text: 'Hint?'}, {role: 'ai', text: '', beyond: 'Consider the false branch.', complete: true}])[0].answer, 'Consider the false branch.'); checks++;
assert.equal(assistantHistory([{role: 'you', text: 'Hint?'}, {role: 'ai', text: '', beyond: 'Partial', complete: false}]).length, 0); checks++;
console.log(`Assistant code and lesson context tests passed (${checks} cases)`);
