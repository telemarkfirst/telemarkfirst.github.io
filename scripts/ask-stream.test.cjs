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

  await check(async () => {
    let sent;
    global.fetch = async (_url, request) => {
      sent = JSON.parse(request.body);
      return {ok: true, body: bodyOf([sse([{event: 'done', data: {}}])])};
    };
    const page = {title: 'Gear ratios', url: 'https://telemarkfirst.github.io/mechanical/ratios'};
    const history = [{question: 'What is torque?', answer: 'Rotational force.'}];
    await askSharpAi('Why?', {idToken: 'signed-token', page, history}, {});
    assert.deepEqual(sent, {question: 'Why?', chat: true, idToken: 'signed-token', page, history});
  });

  await check(async () => {
    const controller = new AbortController();
    controller.abort();
    global.fetch = async () => { throw new DOMException('aborted', 'AbortError'); };
    let errors = 0;
    await askSharpAi('q', {idToken: 't', signal: controller.signal}, {onError: () => errors++});
    assert.equal(errors, 0);
  });

  for (const [status, detail, expected] of [
    [429, {scope: 'minute'}, /Wait a minute/],
    [429, {scope: 'day'}, /questions for today/],
    [403, {error: 'auth-failed'}, /session expired/],
    [403, {error: 'turnstile-failed'}, /sign-in connection is unavailable/],
    [503, {error: 'auth-unavailable'}, /Try again shortly/],
    [413, {maxChars: 500}, /under 500 characters/],
  ]) {
    await check(async () => {
      stub({ok: false, status, json: async () => detail});
      let message = '';
      await askSharpAi('q', {idToken: 't'}, {onError: (m) => { message = m; }});
      assert.match(message, expected);
    });
  }

  await check(async () => {
    const text = sse([{event: 'token', data: {t: 'complete'}}, {event: 'done', data: {}}]).replace(/\n/g, '\r\n');
    stub({ok: true, body: bodyOf([...text])});
    let answer = '';
    let done = 0;
    const errors = [];
    await askSharpAi('q', {idToken: 't'}, {
      onToken: (t) => { answer += t; }, onDone: () => done++, onError: (m) => errors.push(m),
    });
    assert.equal(answer, 'complete');
    assert.equal(done, 1);
    assert.deepEqual(errors, []);
  });

  await check(async () => {
    stub({ok: true, body: bodyOf([sse([{event: 'token', data: {t: 'cut off'}}])])});
    let error = '';
    let done = 0;
    await askSharpAi('q', {idToken: 't'}, {onError: (m) => { error = m; }, onDone: () => done++});
    assert.match(error, /stopped partway/);
    assert.equal(done, 1);
  });

  await check(async () => {
    stub({ok: true, body: bodyOf([sse([
      {event: 'beyond_start', data: {}}, {event: 'beyond', data: {t: 'reasoning'}},
      {event: 'degrade', data: {answerMd: 'Sources only'}}, {event: 'done', data: {}},
    ])])});
    const seen = [];
    await askSharpAi('q', {idToken: 't'}, {
      onBeyondStart: () => seen.push('start'), onBeyond: (t) => seen.push(t), onDegrade: (t) => seen.push(t),
    });
    assert.deepEqual(seen, ['start', 'reasoning', 'Sources only']);
  });

  await check(async () => {
    stub({ok: false, status: 502, json: async () => null});
    let error = '';
    await askSharpAi('q', {idToken: 't'}, {onError: (m) => { error = m; }});
    assert.match(error, /could not answer/);
  });

  await check(async () => {
    let sent;
    const learning = {mode: 'hint', files: [{name: 'Main.java', source: 'motor.setPower(0);'}], error: 'Stopped'};
    const tutor = {mode: 'hint', followUps: ['Show the solution.']};
    const claims = [{claim: 'Set power.', sources: [{n: 1, status: 'matched', passage: 'Set power.', version: 'SDK 12'}]}];
    global.fetch = async (_url, request) => {
      sent = JSON.parse(request.body);
      return {ok: true, body: bodyOf([sse([{event: 'meta', data: {citations: [{n: 1}], tutor}}, {event: 'evidence', data: {claims}}, {event: 'done', data: {}}])])};
    };
    let actualTutor, actualClaims;
    await askSharpAi('Why?', {idToken: 't', learning}, {onMeta: (_citations, plan) => {actualTutor = plan;}, onEvidence: (e) => {actualClaims = e;}});
    assert.deepEqual(sent.learning, learning);
    assert.deepEqual(actualTutor, tutor);
    assert.deepEqual(actualClaims, claims);
  });

  console.log(`Answer stream tests passed (${checks} cases)`);
})();
