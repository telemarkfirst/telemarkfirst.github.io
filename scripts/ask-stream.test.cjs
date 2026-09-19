const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Tests for the answer stream reader.
 *
 * The failures worth guarding are the ones that leave the panel stuck: a
 * rejected read escaping the function so the caller's cleanup never runs, and
 * done firing twice or not at all.
 */

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/telemark/askSharpAi.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});
const loaded = {};
new Function('exports', 'require', 'module', outputText)(loaded, require, {exports: loaded});
const {askSharpAi} = loaded;

function sse(frames) {
  return frames.map((f) => `event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`).join('');
}

/** A body that yields the given chunks, or rejects partway if told to. */
function bodyOf(chunks, {failAfter = null} = {}) {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (failAfter !== null && i === failAfter) {
          throw new DOMException('aborted', 'AbortError');
        }
        if (i >= chunks.length) return {done: true, value: undefined};
        const value = new TextEncoder().encode(chunks[i]);
        i += 1;
        return {done: false, value};
      },
    }),
  };
}

function stub(response) {
  global.fetch = async () => response;
}

let checks = 0;
const check = async (fn) => { await fn(); checks += 1; };

(async () => {
  await check(async () => {
    const text = sse([
      {event: 'meta', data: {citations: [{n: 1}]}},
      {event: 'token', data: {t: 'Hello '}},
      {event: 'token', data: {t: 'world'}},
      {event: 'done', data: {}},
    ]);
    stub({ok: true, body: bodyOf([text])});
    let out = '';
    let dones = 0;
    await askSharpAi('q', {idToken: 't'}, {
      onToken: (t) => { out += t; },
      onDone: () => { dones += 1; },
    });
    assert.equal(out, 'Hello world');
    assert.equal(dones, 1, 'done must fire exactly once');
  });

  await check(async () => {
    // A frame split across two reads must still parse.
    const text = sse([{event: 'token', data: {t: 'split ok'}}]);
    const cut = Math.floor(text.length / 2);
    stub({ok: true, body: bodyOf([text.slice(0, cut), text.slice(cut)])});
    let out = '';
    await askSharpAi('q', {idToken: 't'}, {onToken: (t) => { out += t; }});
    assert.equal(out, 'split ok');
  });

  await check(async () => {
    // An abort must not escape, and must not be reported to the student as an
    // error: they aborted it by asking something else.
    stub({ok: true, body: bodyOf([sse([{event: 'token', data: {t: 'partial'}}])], {failAfter: 1})});
    const controller = new AbortController();
    controller.abort();
    let errored = null;
    let dones = 0;
    await askSharpAi('q', {idToken: 't', signal: controller.signal}, {
      onError: (m) => { errored = m; },
      onDone: () => { dones += 1; },
    });
    assert.equal(errored, null, 'an abort is not an error to show');
    assert.equal(dones, 1, 'the caller still needs its completion');
  });

  await check(async () => {
    // A connection that drops mid answer IS worth reporting, and still must
    // not escape.
    stub({ok: true, body: {getReader: () => ({read: async () => { throw new Error('network'); }})}});
    let errored = null;
    let dones = 0;
    await askSharpAi('q', {idToken: 't'}, {
      onError: (m) => { errored = m; },
      onDone: () => { dones += 1; },
    });
    assert.match(errored ?? '', /stopped partway/);
    assert.equal(dones, 1);
  });

  await check(async () => {
    // Rate limiting has to say so plainly rather than looking like a failure.
    stub({ok: false, status: 429, json: async () => ({error: 'rate'})});
    let errored = null;
    await askSharpAi('q', {idToken: 't'}, {onError: (m) => { errored = m; }});
    assert.match(errored ?? '', /questions for today/);
  });

  await check(async () => {
    // Malformed data in one frame must not stop the rest of the stream.
    const text = 'event: token\ndata: {broken\n\n' + sse([{event: 'token', data: {t: 'still here'}}]);
    stub({ok: true, body: bodyOf([text])});
    let out = '';
    await askSharpAi('q', {idToken: 't'}, {onToken: (t) => { out += t; }});
    assert.equal(out, 'still here');
  });

  console.log(`Answer stream tests passed (${checks} cases)`);
})();
