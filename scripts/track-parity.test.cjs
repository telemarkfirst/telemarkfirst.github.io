const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/**
 * Keeps the two tracks consistent with each other.
 *
 * The software and mechanical tracks teach different subjects, so their
 * lesson content differs by design. What must not differ is the furniture: a
 * student moving between them should meet the same landing page and navigation.
 * Assessment follows the work: blank-file coding challenges for software and
 * scored design quizzes for mechanical.
 */

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function loadTs(relative, exportName) {
  const source = read(relative);
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  });
  const module = {};
  new Function('exports', 'require', 'module', outputText)(module, require, {exports: module});
  return module[exportName];
}

// ── Both landings render the same component ─────────────────────────────────

// Both landings are docs index pages, so each opens with its own sidebar and
// the same shell. /curriculum survives only as a redirect for old links.
const softwareLanding = read('docs/index.mdx');
const mechanicalLanding = read('mechanical/index.mdx');
const legacyAlias = read('src/pages/curriculum.tsx');

assert.match(legacyAlias, /Redirect/, '/curriculum must redirect rather than duplicate the landing');
assert.match(legacyAlias, /\/docs/, '/curriculum must redirect to the software landing');

assert.match(softwareLanding, /TrackOverview/, 'software landing must use the shared TrackOverview');
assert.match(mechanicalLanding, /TrackOverview/, 'engineering landing must use the shared TrackOverview');
assert.match(softwareLanding, /trackId="software"/);
assert.match(mechanicalLanding, /trackId="mechanical"/);

// Each landing must point at the other, so the tracks are discoverable from
// one another rather than only from the navbar.
assert.match(softwareLanding, /companionTrackId="mechanical"/);
assert.match(mechanicalLanding, /companionTrackId="software"/);

// The old bespoke software grid must not come back.
// Both landings must be docs indexes, which is what gives them the same shell.
for (const [name, source] of [['software', softwareLanding], ['mechanical', mechanicalLanding]]) {
  assert.match(source, /^slug: \/$/m, `${name} landing must own its track root as a docs index`);
  assert.match(source, /hide_table_of_contents: true/, `${name} landing should not show a table of contents`);
}

// ── Every page uses the shared shell ────────────────────────────────────────
// The homepage used to hand roll its own navbar, which meant it had different
// chrome from every other page and the command palette was unreachable there.

const pagesDir = path.join(root, 'src/pages');
for (const file of fs.readdirSync(pagesDir).filter((name) => name.endsWith('.tsx'))) {
  const text = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  assert.ok(
    text.includes('Layout') || text.includes('Redirect'),
    `${file} does not render inside the shared Layout`,
  );
  assert.ok(
    !/<nav\s+className=\{styles\.navbar\}/.test(text),
    `${file} is hand rolling a navbar instead of using the theme's`,
  );
}

// ── Both tracks offer the same track-level pages ────────────────────────────

const REQUIRED_PAGES = ['getting-started', 'learning-paths'];
for (const page of REQUIRED_PAGES) {
  assert.ok(
    fs.existsSync(path.join(root, 'docs', `${page}.mdx`)),
    `software track is missing ${page}.mdx`,
  );
  assert.ok(
    fs.existsSync(path.join(root, 'mechanical', `${page}.mdx`)),
    `mechanical track is missing ${page}.mdx`,
  );
}

// ── Every mastery quiz in both tracks is scored ─────────────────────────────

function quizFiles(directory, pattern) {
  const base = path.join(root, directory);
  return fs
    .readdirSync(base)
    .filter((name) => pattern.test(name))
    .flatMap((unit) => {
      const unitDir = path.join(base, unit);
      if (!fs.statSync(unitDir).isDirectory()) return [];
      return fs
        .readdirSync(unitDir)
        .filter((file) => file.includes('mastery-quiz'))
        .map((file) => path.join(unitDir, file));
    });
}

const softwareQuizzes = quizFiles('docs', /^unit-\d{2}$/);
const mechanicalQuizzes = quizFiles('mechanical', /^module-\d{2}$/);
const softwareChallenges = fs
  .readdirSync(path.join(root, 'docs'))
  .filter((name) => /^unit-\d{2}$/.test(name))
  .flatMap((unit) => fs
    .readdirSync(path.join(root, 'docs', unit))
    .filter((file) => file.includes('mastery-coding-challenge'))
    .map((file) => path.join(root, 'docs', unit, file)));

assert.equal(softwareQuizzes.length, 0, 'software mastery quizzes should be removed');
assert.equal(softwareChallenges.length, 14, 'expected one comprehensive coding challenge in Units 2-15');
assert.equal(mechanicalQuizzes.length, 14, 'expected 14 mechanical quizzes');

for (const file of mechanicalQuizzes) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(
    text,
    /<ScoredQuiz/,
    `${path.relative(root, file)} has no scored section`,
  );
}

for (const file of softwareChallenges) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /<MasterySimulator/, `${path.relative(root, file)} has no coding simulator`);
  assert.doesNotMatch(text, /mastery-quiz/, `${path.relative(root, file)} still routes through a quiz`);
}

// ── Question banks are complete and well formed ─────────────────────────────

const banks = [
  {name: 'mechanical', questions: loadTs('src/telemark/mechanicalQuizzes.ts', 'MASTERY_QUESTIONS'), expected: 14},
];

let totalQuestions = 0;
for (const bank of banks) {
  const keys = Object.keys(bank.questions);
  assert.equal(keys.length, bank.expected, `${bank.name} bank covers ${keys.length} units, expected ${bank.expected}`);

  for (const key of keys) {
    const questions = bank.questions[key];
    assert.ok(questions.length >= 5, `${bank.name} ${key} has only ${questions.length} questions`);
    questions.forEach((question, index) => {
      const where = `${bank.name} ${key} question ${index + 1}`;
      assert.ok(
        Number.isInteger(question.answer)
          && question.answer >= 0
          && question.answer < question.options.length,
        `${where} has an answer index outside its options`,
      );
      assert.equal(
        new Set(question.options).size,
        question.options.length,
        `${where} has duplicate options`,
      );
      assert.ok(question.explain.length > 30, `${where} has no real explanation`);
      totalQuestions += 1;
    });
  }
}

// ── Shared components, not per-track copies ─────────────────────────────────

for (const [file, component] of [
  ['src/components/UnitOverview.tsx', 'UnitOverview'],
  ['src/components/TrackOverview.tsx', 'TrackOverview'],
  ['src/components/mechanical/ScoredQuiz.tsx', 'ScoredQuiz'],
]) {
  assert.ok(fs.existsSync(path.join(root, file)), `${component} is missing`);
}

console.log(
  `Track parity checks passed: both landings share TrackOverview, `
  + `${softwareChallenges.length} software coding challenges, ${mechanicalQuizzes.length} mechanical quizzes, `
  + `${totalQuestions} questions validated`,
);
