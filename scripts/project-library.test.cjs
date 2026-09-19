const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const java = require('../static/simulator/telemark-java.js');
const lessonFiles = [{name:'Saved.java',source:'public class Saved extends OpMode {void init(){}void loop(){}}'},
  {name:'Mechanism.java',source:'package robot.mechanisms; public class Mechanism {public int value(){return 4;}}'}];
const dom = new JSDOM('<div><div><textarea id="code-editor"></textarea></div></div>', {url:'https://telemark.test/simulator/unit7.html', runScripts:'outside-only'});
const w = dom.window;
w.TelemarkJava = java;
w.eval(fs.readFileSync('static/simulator/telemark-editor.js','utf8'));
w.eval(fs.readFileSync('static/simulator/telemark-project.js','utf8'));
const editor=w.document.querySelector('textarea');
editor.value='public class Current extends OpMode {void init(){}void loop(){}}';
w.localStorage.setItem('telemark:progress:v1', JSON.stringify({completedLessons:['done','skipped','placed'],skippedLessons:['skipped'],autoCompletedLessons:['placed']}));
w.localStorage.setItem('telemark:java-library:v1', JSON.stringify(Object.fromEntries(['done','skipped','placed','unfinished'].map(id=>[id,{lesson:{id,title:id},files:lessonFiles}]))));
const project=w.TelemarkProject.attach(editor,()=>{});
const picker=()=>w.document.querySelector('select[aria-label="Code from a completed lesson"]');
const click=(label)=>{const button=[...w.document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,`button ${label} exists`);button.click();};
click('+');
assert.deepEqual([...picker().options].map(o=>o.value),['','done'],'guests see saved code only for genuinely completed lessons');
click('Cancel');
function context(origin, source) {
  w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{type:'telemark:project-lesson',lesson:{id:'current',title:'Current lesson'},completed:['done']}}));
}
context('https://wrong.test',w);
assert.equal(JSON.parse(w.localStorage.getItem('telemark:java-library:v1')).current,undefined,'untrusted messages cannot label saved projects');
context(w.location.origin,w);
const stableTab=w.document.querySelector('.telemark-project-tab');
context(w.location.origin,w);
assert.equal(stableTab.isConnected,true,'repeated lesson context does not rebuild the file toolbar');
w.dispatchEvent(new w.StorageEvent('storage',{key:'telemark:java-library:v1'}));
assert.equal(stableTab.isConnected,true,'saving the code library does not rebuild the file toolbar');
editor.value += '\n// My work'; w.TelemarkEditor.saveDraft(editor);
assert.match(JSON.parse(w.localStorage.getItem('telemark:java-library:v1')).current.files[0].source,/My work/,'lesson code saves without an account');
click('+'); picker().value='done'; picker().dispatchEvent(new w.Event('change'));
const dialog=w.document.querySelector('dialog');
assert.ok(dialog);
assert.deepEqual([...dialog.querySelectorAll('input')].map(i=>i.checked),[false,true],'import defaults to reusable helper files');
[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Import selected').click();
assert.equal(project.files().length,2);
assert.equal(w.document.querySelector('dialog'),null);
assert.match(project.files()[0].source,/My work/,'import keeps current work');
project.importFiles([{name:'Mechanism.java',source:'public class Mechanism {public int value(){return 99;}}'}]);
assert.equal(project.files().length,2,'same-named imports replace instead of duplicating a file');
assert.match(project.files().find(file=>file.name==='Mechanism.java').source,/return 99/,'an imported file can override existing code');
assert.throws(()=>project.importFiles([{name:'../../Escape.java',source:'class Escape{}'}]),/40 Java files/);

const mergeDom = new JSDOM('<div><div><textarea id="merge-editor"></textarea></div></div>', {url:'https://telemark.test/simulator/unit13.project.html?lesson=lift', runScripts:'outside-only'});
const mergeWindow = mergeDom.window;
mergeWindow.TelemarkJava = java;
mergeWindow.eval(fs.readFileSync('static/simulator/telemark-editor.js','utf8'));
mergeWindow.eval(fs.readFileSync('static/simulator/telemark-project.js','utf8'));
const mergeEditor = mergeWindow.document.querySelector('textarea');
mergeEditor.value = 'public class Intake { /* supplied */ }';
const cumulativeKey = 'telemark:test-cumulative-project';
mergeWindow.localStorage.setItem(cumulativeKey, JSON.stringify({
  files: [{name:'Intake.java',source:'public class Intake { /* learner draft */ }'}],
  active: 0,
  entry: '',
}));
const mergedProject = mergeWindow.TelemarkProject.attach(mergeEditor, null, {
  key: cumulativeKey,
  addMissingInitialFiles: true,
  initialFiles: [
    {name:'Intake.java',source:'public class Intake { /* supplied */ }'},
    {name:'Lift.java',source:'public class Lift {}'},
  ],
});
assert.equal(mergedProject.files().length, 2, 'a later cumulative stage adds only missing helper tabs');
assert.match(mergedProject.files()[0].source, /learner draft/, 'new helper tabs never overwrite a saved learner file');
assert.equal(mergedProject.files()[1].name, 'Lift.java');
mergeDom.window.close();

(async()=>{
  const upload=w.document.querySelector('input[type="file"]');
  Object.defineProperty(upload,'files',{configurable:true,value:[{name:'Names.java',size:100,text:async()=> 'package robot.config; public class Names {public static final String MOTOR="lift";}'}]});
  upload.dispatchEvent(new w.Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
  const localDialog=w.document.querySelector('dialog');
  assert.ok(localDialog.textContent.includes('Names.java'));
  [...localDialog.querySelectorAll('button')].find(b=>b.textContent==='Import selected').click();
  assert.equal(project.files().length,3,'local Java files can be selected and imported');
  editor.value += '\n// Latest unswitched edit';
  let exportedJson='';
  w.Blob=class Blob { constructor(parts){ exportedJson=parts.join(''); } };
  w.URL.createObjectURL=()=> 'blob:telemark-project';
  w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  click('Export');
  const exported=JSON.parse(exportedJson);
  assert.match(exported.files.find(file=>file.name==='Names.java').source,/Latest unswitched edit/,'export synchronizes the current editor before creating the backup');
  assert.match(editor.value,/Latest unswitched edit/,'export leaves the edited code visible and unchanged');
  assert.equal(w.document.querySelectorAll('.telemark-project-tab-rename').length,3,'every file tab has an obvious rename control');
  assert.ok([...w.document.querySelectorAll('.telemark-project-tab-shell')].every(tab=>tab.draggable),'file tabs can be dragged like browser tabs');
  assert.equal(project.moveFile(2,0),true);
  assert.deepEqual(Array.from(project.files(),file=>file.name),['Names.java','Current.java','Mechanism.java'],'tab reorder changes the project file order');
  assert.deepEqual(JSON.parse(w.localStorage.getItem(project.key)).files.map(file=>file.name),['Names.java','Current.java','Mechanism.java'],'tab order persists in browser storage');
  w.document.querySelector('.telemark-project-tab[aria-pressed="true"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true}));
  assert.deepEqual(Array.from(project.files(),file=>file.name),['Current.java','Names.java','Mechanism.java'],'Alt+Arrow reorders the focused tab without a mouse');
  project.moveFile(1,2);
  assert.deepEqual(Array.from(project.files(),file=>file.name),['Current.java','Mechanism.java','Names.java']);
  // Malformed exports report an error and leave the project intact.
  Object.defineProperty(upload,'files',{configurable:true,value:[{name:'bad.json',size:20,text:async()=>'{"format":"wrong"}'}]});
  upload.dispatchEvent(new w.Event('change'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(project.files().length,3);
  assert.match(w.document.querySelector('[role="status"]').textContent,/Telemark Java project/);
  project.reset('public class Different extends OpMode {void init(){}void loop(){}}');
  assert.equal(project.files()[0].name,'Different.java','reset derives the new public class filename');
  assert.equal(java.compile(project.source()).ok,true);
  editor.value=editor.value.replace('class Different','class Renamed');
  w.TelemarkEditor.saveDraft(editor);
  w.document.querySelector('.telemark-project-tab-rename').click();
  const renameDialog=w.document.querySelector('dialog');
  renameDialog.querySelector('input').value='Renamed.java';
  [...renameDialog.querySelectorAll('button')].find(b=>b.textContent==='Rename').click();
  assert.equal(project.files()[0].name,'Renamed.java');
  assert.equal(java.compile(project.source()).ok,true,'renaming the path keeps the class and source intact');
  dom.window.close();
  console.log('Guest lesson library and local import tests passed.');
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
