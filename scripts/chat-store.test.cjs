const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Tests for the saved conversation store.
 *
 * It holds a student's own questions, so the failure modes worth guarding are
 * losing them, keeping them forever, and letting a corrupt entry take the
 * panel down with it.
 */

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/telemark/chatStore.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});

function freshStore() {
  const backing = new Map();
  global.localStorage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, v),
  };
  const module = {};
  new Function('exports', 'require', 'module', outputText)(module, require, {exports: module});
  return {store: module, backing};
}

let checks = 0;
const check = (fn) => { fn(); checks += 1; };

const chat = (id, question, when) => ({
  id, title: 'Lesson 4.1', path: '/x', updatedAt: when,
  messages: [{role: 'you', text: question}, {role: 'ai', text: 'answer'}],
});

check(() => {
  const {store} = freshStore();
  assert.deepEqual(store.listChats(), []);
  store.saveChat(chat('a', 'why 3.2', 100));
  assert.equal(store.listChats().length, 1);
  assert.equal(store.loadChat('a').messages.length, 2);
  assert.equal(store.loadChat('nope'), null);
});

check(() => {
  // Newest first: a student looking for "the one from yesterday" scans from
  // the top.
  const {store} = freshStore();
  store.saveChat(chat('old', 'first', 100));
  store.saveChat(chat('new', 'second', 900));
  assert.deepEqual(store.listChats().map((c) => c.id), ['new', 'old']);
});

check(() => {
  // Saving the same conversation again replaces it rather than duplicating.
  const {store} = freshStore();
  store.saveChat(chat('a', 'why 3.2', 100));
  store.saveChat(chat('a', 'why 3.2', 200));
  assert.equal(store.listChats().length, 1);
  assert.equal(store.listChats()[0].updatedAt, 200);
});

check(() => {
  const {store} = freshStore();
  store.saveChat(chat('a', 'q', 1));
  store.deleteChat('a');
  assert.deepEqual(store.listChats(), []);
});

check(() => {
  // Bounded, oldest dropped, so a year of use cannot fill the quota.
  const {store} = freshStore();
  for (let i = 0; i < 30; i += 1) store.saveChat(chat(`c${i}`, `q${i}`, i));
  const kept = store.listChats();
  assert.equal(kept.length, 20);
  assert.equal(kept[0].id, 'c29', 'newest must survive');
  assert.ok(!kept.some((c) => c.id === 'c0'), 'oldest must be dropped');
});

check(() => {
  // A conversation with nothing in it is not worth listing.
  const {store} = freshStore();
  store.saveChat({id: 'empty', title: 't', path: '/x', updatedAt: 1, messages: []});
  assert.deepEqual(store.listChats(), []);
});

check(() => {
  // Corrupt storage must degrade to empty rather than throwing into a render.
  const {store, backing} = freshStore();
  backing.set('telemark:chats', 'not json at all');
  assert.deepEqual(store.listChats(), []);
  backing.set('telemark:chats', '{"not":"an array"}');
  assert.deepEqual(store.listChats(), []);
});

check(() => {
  const {store} = freshStore();
  assert.equal(store.chatLabel(chat('a', 'why is it 3.2', 1)), 'why is it 3.2');
  assert.notEqual(store.newChatId(), store.newChatId());
});

console.log(`Chat store tests passed (${checks} cases)`);
