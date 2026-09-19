const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/telemark/profile.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});
const loaded = {exports: {}};
function stubRequire(id) {
  if (id === 'firebase/firestore') return {
    doc: () => ({}), getDoc: () => {}, serverTimestamp: () => ({}), setDoc: () => {},
  };
  if (id === './firebase') return {db: {}};
  return require(id);
}
new Function('exports', 'require', 'module', outputText)(loaded.exports, stubRequire, loaded);
const {normalizeLearnerProfile, profileDestination} = loaded.exports;

const make = (selectedTracks, softwareLevel, extra = {}) => normalizeLearnerProfile({
  version: 1,
  selectedTracks,
  ...(softwareLevel ? {softwareLevel} : {}),
  onboardingComplete: true,
  ...extra,
});

assert.equal(make([], undefined), null);
assert.equal(make(['software'], undefined), null);
assert.equal(make(['unknown'], undefined), null);
assert.equal(make(['mechanical'], undefined).blocksPlacement, undefined);
assert.equal(profileDestination(make(['mechanical'], undefined)), '/mechanical');

for (const [level, placement, destination] of [
  ['complete_beginner', 'required', '/blocks'],
  ['block_experience', 'auto_completed', '/docs'],
  ['text_experience', 'auto_completed', '/docs'],
]) {
  const software = make(['software'], level);
  assert.equal(software.blocksPlacement, placement);
  assert.equal(profileDestination(software), destination);
  const both = make(['mechanical', 'software', 'software'], level);
  assert.deepEqual(both.selectedTracks, ['mechanical', 'software']);
  assert.equal(profileDestination(both), destination);
}

assert.equal(make(['software'], 'complete_beginner', {postBlocksChoice: 'python'}).postBlocksChoice, 'python');
assert.equal(make(['software'], 'complete_beginner', {postBlocksChoice: 'java'}).postBlocksChoice, 'java');
assert.equal(make(['software'], 'complete_beginner', {postBlocksChoice: 'fll'}).postBlocksChoice, 'fll');
assert.equal(make(['software'], 'complete_beginner', {postBlocksChoice: 'invalid'}).postBlocksChoice, undefined);
assert.equal(profileDestination(make(['software'], 'block_experience', {postBlocksChoice: 'python'})), '/blocks/python-resources');
assert.equal(profileDestination(make(['software'], 'block_experience', {postBlocksChoice: 'java'})), '/docs');

const personalizationSource = fs.readFileSync(path.join(root, 'src/pages/personalize.tsx'), 'utf8');
assert.match(personalizationSource, /softwareLevel === 'block_experience' && !blockExperienceChoice/);
assert.match(personalizationSource, /Optional Python bridge/);
assert.match(personalizationSource, /Recommended if unsure/);
assert.match(personalizationSource, /Go directly to FTC Java/);

const authSource = fs.readFileSync(path.join(root, 'src/telemark/googleAuth.ts'), 'utf8');
assert.ok(authSource.indexOf('!result.user.emailVerified') < authSource.indexOf('syncLocalProgressWithUser(result.user)'));
assert.match(authSource, /await signOut\(auth\)/);

const gateSource = fs.readFileSync(path.join(root, 'src/components/PersonalizationGate.tsx'), 'utf8');
assert.match(
  gateSource,
  /withoutTrailingSlash\(location\.pathname\) === withoutTrailingSlash\(basePath\('\/'\)\)/,
  'the homepage waits for a learner to choose a track before starting personalization',
);
assert.match(gateSource, /isCurriculumRoute\(location\.pathname, basePath\('\/'\)\)/);
const curriculumRoutes = gateSource.match(/const CURRICULUM_ROUTES = \[([^\]]+)\]/)?.[1] || '';
for (const route of ['/docs', '/blocks', '/mechanical', '/simulator', '/dashboard']) {
  assert.ok(curriculumRoutes.includes(`'${route}'`), `${route} starts curriculum personalization`);
}
assert.ok(!curriculumRoutes.includes('changelog'), 'the changelog never starts curriculum personalization');
const loginSource = fs.readFileSync(path.join(root, 'src/pages/login.tsx'), 'utf8');
assert.match(loginSource, /profileStatus === 'absent' \? '\/' : '\/dashboard'/, 'sign-in alone does not start personalization');
assert.doesNotMatch(gateSource, /useTelemarkAccount|accountStatus|setupError/);
assert.doesNotMatch(gateSource, /<aside|Continue to public lessons|Sign out/);

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
assert.match(rules, /request\.auth\.uid == userId/);
assert.match(rules, /request\.auth\.token\.email_verified == true/);
assert.match(rules, /match \/users\/\{userId\}\/telemark\/\{documentId\}/);

console.log('Profile normalization, routing, verification, and Firestore rule checks passed');
