const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/telemark/progressStore.ts'),
  'utf8',
);
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});
const progressStore = {exports: {}};
new Function('exports', 'require', 'module', outputText)(
  progressStore.exports,
  require,
  progressStore,
);

const {
  addAutomaticCompletions,
  clearAutomaticCompletions,
  completeLessonsManually,
  mergeProgress,
  normalizeProgress,
  parseProgressExport,
  serializeProgress,
} = progressStore.exports;

assert.deepEqual(
  normalizeProgress({
    completedLessons: ['unit-01/a', 'unit-01/a', 12],
    skippedLessons: ['unit-01/b'],
    reviewingUnits: ['unit-01', 'unit-01'],
    lastLesson: 'unit-01/b',
  }),
  {
    completedLessons: ['unit-01/a', 'unit-01/b'],
    skippedLessons: ['unit-01/b'],
    autoCompletedLessons: [],
    reviewingUnits: ['unit-01'],
    lastLesson: 'unit-01/b',
  },
);

const merged = mergeProgress(
  {completedLessons: ['unit-01/a'], lastLesson: 'unit-01/a'},
  {completedLessons: ['module-02/b'], skippedLessons: ['unit-03/c'], lastLesson: 'module-02/b'},
);
assert.deepEqual(merged.completedLessons, ['unit-01/a', 'module-02/b', 'unit-03/c']);
assert.deepEqual(merged.skippedLessons, ['unit-03/c']);
assert.deepEqual(merged.autoCompletedLessons, []);
assert.equal(merged.lastLesson, 'module-02/b');

const exported = serializeProgress(merged);
assert.match(exported, /"format": "telemark-progress"/);
assert.match(exported, /"version": 2/);
assert.deepEqual(parseProgressExport(exported), merged);
assert.deepEqual(parseProgressExport(JSON.stringify(merged)), merged);
const versionOne = JSON.stringify({
  format: 'telemark-progress',
  version: 1,
  exportedAt: '2025-01-01T00:00:00.000Z',
  progress: {completedLessons: ['unit-00/a']},
});
assert.deepEqual(parseProgressExport(versionOne).completedLessons, ['unit-00/a']);

const placed = addAutomaticCompletions(
  {completedLessons: ['blocks-unit-00/manual']},
  ['blocks-unit-00/manual', 'blocks-unit-00/placed'],
);
assert.deepEqual(placed.completedLessons, ['blocks-unit-00/manual', 'blocks-unit-00/placed']);
assert.deepEqual(placed.autoCompletedLessons, ['blocks-unit-00/placed']);

const manual = completeLessonsManually(placed, ['blocks-unit-00/placed']);
assert.deepEqual(manual.autoCompletedLessons, []);
assert.deepEqual(manual.completedLessons, ['blocks-unit-00/manual', 'blocks-unit-00/placed']);

const changedToBeginner = clearAutomaticCompletions(placed, [
  'blocks-unit-00/manual',
  'blocks-unit-00/placed',
]);
assert.deepEqual(changedToBeginner.completedLessons, ['blocks-unit-00/manual']);
assert.deepEqual(changedToBeginner.autoCompletedLessons, []);

const cloudAutoAndLocalManual = mergeProgress(
  addAutomaticCompletions({}, ['blocks-unit-00/placed']),
  {completedLessons: ['blocks-unit-00/placed']},
);
assert.deepEqual(cloudAutoAndLocalManual.autoCompletedLessons, []);
assert.deepEqual(cloudAutoAndLocalManual.completedLessons, ['blocks-unit-00/placed']);
assert.throws(() => parseProgressExport('{bad json'), /not valid JSON/);
assert.throws(() => parseProgressExport('{"format":"something-else"}'), /unsupported format/);

console.log('Progress normalization, merge, export, and import checks passed');
