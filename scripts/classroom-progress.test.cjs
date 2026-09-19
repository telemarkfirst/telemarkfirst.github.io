const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function transpile(relativePath) {
  return ts.transpileModule(
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
  ).outputText;
}

const curriculum = requireFromTs('src/telemark/curriculum.ts');
const mechanical = requireFromTs('src/telemark/mechanical.ts');
const blocks = requireFromTs('src/telemark/blocksCurriculum.ts');

function requireFromTs(relativePath) {
  const module = {exports: {}};
  const localRequire = (request) => {
    if (request === './curriculum') return curriculum;
    throw new Error(`Unexpected dependency ${request} from ${relativePath}`);
  };
  new Function('exports', 'require', 'module', transpile(relativePath))(
    module.exports,
    localRequire,
    module,
  );
  return module.exports;
}

const classroomModule = {exports: {}};
new Function('exports', 'require', 'module', transpile('src/telemark/classroomProgress.ts'))(
  classroomModule.exports,
  (request) => {
    if (request === './blocksCurriculum') return blocks;
    if (request === './curriculum') return curriculum;
    if (request === './mechanical') return mechanical;
    if (request === './progressStore') return {};
    throw new Error(`Unexpected dependency ${request}`);
  },
  classroomModule,
);

const {summarizeClassroomProgress} = classroomModule.exports;
const softwareLesson = curriculum.CURRICULUM_LESSONS[0].id;
const blocksLesson = blocks.BLOCKS_LESSONS[0].id;
const mechanicalLesson = mechanical.MECHANICAL_LESSONS[0].id;

assert.deepEqual(
  summarizeClassroomProgress({
    completedLessons: [softwareLesson, blocksLesson, mechanicalLesson, 'unknown/lesson'],
    skippedLessons: [blocksLesson],
    autoCompletedLessons: [softwareLesson],
    reviewingUnits: [],
    lastLesson: softwareLesson,
  }, 'software'),
  {
    completed: 0,
    skipped: 1,
    placement: 1,
    handled: 2,
    total: curriculum.CURRICULUM_LESSONS.length + blocks.BLOCKS_LESSONS.length,
    percentage: Math.round(2 / (
      curriculum.CURRICULUM_LESSONS.length + blocks.BLOCKS_LESSONS.length
    ) * 100),
  },
);

const overall = summarizeClassroomProgress({
  completedLessons: [softwareLesson, mechanicalLesson],
  skippedLessons: [],
  autoCompletedLessons: [],
  reviewingUnits: [],
  lastLesson: null,
});
assert.equal(overall.handled, 2);
assert.equal(
  overall.total,
  curriculum.CURRICULUM_LESSONS.length
    + blocks.BLOCKS_LESSONS.length
    + mechanical.MECHANICAL_LESSONS.length,
);
assert.deepEqual(summarizeClassroomProgress(undefined, 'mechanical'), {
  completed: 0,
  skipped: 0,
  placement: 0,
  handled: 0,
  total: mechanical.MECHANICAL_LESSONS.length,
  percentage: 0,
});

console.log('Classroom progress summaries passed');
