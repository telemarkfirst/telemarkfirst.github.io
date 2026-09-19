const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function loadTs(relative) {
  const {outputText} = ts.transpileModule(read(relative), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  });
  const exports = {};
  new Function('exports', 'require', 'module', outputText)(exports, require, {exports});
  return exports;
}

const curriculum = loadTs('src/telemark/curriculum.ts');
const mechanical = loadTs('src/telemark/mechanical.ts');
const coaches = loadTs('src/telemark/coachAssessments.ts');

const units = [...curriculum.CURRICULUM_UNITS, ...mechanical.MECHANICAL_UNITS];
const lessons = [...curriculum.CURRICULUM_LESSONS, ...mechanical.MECHANICAL_LESSONS];
const advancedUnits = units.filter((unit) => unit.tier === 'Advanced');
const assessments = coaches.getCoachAssessments(units, lessons);

assert.equal(
  assessments.length,
  advancedUnits.length,
  'the coach library must cover every Advanced unit in both main tracks',
);
assert.deepEqual(
  new Set(assessments.map((assessment) => assessment.unitSlug)),
  new Set(advancedUnits.map((unit) => unit.slug)),
  'coach briefs and Advanced curriculum units must stay aligned',
);
assert.equal(
  new Set(assessments.map((assessment) => assessment.unitSlug)).size,
  assessments.length,
  'each Advanced unit needs exactly one coach brief',
);

for (const assessment of assessments) {
  const expectedPrefix = assessment.track === 'software' ? '/docs/' : '/mechanical/';
  const expectedSuffix = assessment.track === 'software'
    ? '/mastery-coding-challenge'
    : '/mastery-quiz';

  assert.ok(assessment.masteryLesson.path.startsWith(expectedPrefix));
  assert.ok(assessment.masteryLesson.path.endsWith(expectedSuffix));
  assert.equal(assessment.evidence.length, 3, `${assessment.unitSlug} needs three evidence items`);
  assert.equal(
    assessment.reviewCriteria.length,
    3,
    `${assessment.unitSlug} needs three review criteria`,
  );
  assert.ok(assessment.extension.length > 120, `${assessment.unitSlug} needs a practical extension`);
  assert.ok(assessment.format.length > 10, `${assessment.unitSlug} needs a test format`);
  assert.ok(assessment.timebox.length > 5, `${assessment.unitSlug} needs a timebox`);

  const [, routeRoot, unitSlug, lessonId] = assessment.masteryLesson.path.split('/');
  const contentDirectory = path.join(root, routeRoot, unitSlug);
  const contentFile = fs.readdirSync(contentDirectory)
    .filter((name) => name.endsWith('.mdx'))
    .find((name) => new RegExp(`^id:\\s*["']?${lessonId}["']?\\s*$`, 'm')
      .test(fs.readFileSync(path.join(contentDirectory, name), 'utf8')));
  assert.ok(
    contentFile,
    `${assessment.unitSlug} links to a mastery lesson that is not present on disk`,
  );
}

const page = read('src/pages/coaches.tsx');
const config = read('docusaurus.config.ts');
const dashboard = read('src/components/classroom/ClassroomDashboard.tsx');
assert.match(page, /getCoachAssessments/, 'the Coaches page must resolve the shared assessment data');
assert.match(page, /Open student test/, 'each brief must expose the actual student assessment');
assert.match(page, /Collect this evidence/, 'each brief must tell coaches what to collect');
assert.match(page, /Review for/, 'each brief must include a review guide');
assert.match(config, /\*\*\/coaches\.\{js,jsx,ts,tsx,md,mdx\}/, 'the unfinished Coaches route must be excluded from the site build');
assert.doesNotMatch(config, /to: '\/coaches'/, 'Coaches must not be in site navigation');
assert.doesNotMatch(dashboard, /to="\/coaches"/, 'the dashboard must not expose the unfinished Coaches route');

console.log(
  `Coach assessment checks passed for ${assessments.length} Advanced units `
  + `(${assessments.filter((item) => item.track === 'software').length} software, `
  + `${assessments.filter((item) => item.track === 'mechanical').length} mechanical)`,
);
