const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/telemark/changelog.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
});
const mod = {};
new Function('exports', 'require', 'module', outputText)(mod, require, {exports: mod});

const {CHANGELOG, LATEST_RELEASE, formatChangeDate} = mod;

assert.equal(CHANGELOG.length, 11, 'versions 1.0 through 1.10 are present');
assert.deepEqual(
  CHANGELOG.map((entry) => entry.version),
  ['1.10', '1.9', '1.8', '1.7', '1.6', '1.5', '1.4', '1.3', '1.2', '1.1', '1.0'],
  'versions count down from the current release',
);
assert.equal(LATEST_RELEASE, CHANGELOG[0]);
assert.equal(LATEST_RELEASE.version, '1.10');
assert.equal(LATEST_RELEASE.date, '2026-09-13');

const dates = CHANGELOG.map((entry) => entry.date);
assert.deepEqual([...dates].sort().reverse(), dates, 'release dates run newest first');
dates.forEach((date) => {
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/, `${date} is an ISO date`);
  assert.ok(!Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()), `${date} is real`);
});

CHANGELOG.forEach((entry) => {
  assert.ok(entry.title.length > 4, `version ${entry.version} has a title`);
  assert.ok(entry.body.length > 20, `version ${entry.version} has a summary`);
  assert.ok(entry.additions.length > 0, `version ${entry.version} lists additions`);
  assert.ok(entry.additions.every((addition) => addition.length > 15));
  assert.ok(
    ['curriculum', 'simulator', 'tools', 'site'].includes(entry.kind),
    `version ${entry.version} has a known kind`,
  );
  if (entry.href) assert.ok(entry.href.startsWith('/'), `${entry.title} links within the site`);
});

const releaseCopy = CHANGELOG
  .flatMap((entry) => [entry.title, entry.body, ...entry.additions])
  .join(' ');
assert.doesNotMatch(
  releaseCopy,
  /\b(?:bug|fix|fixed|repair|repaired|regression)\b/i,
  'the changelog reports additions only',
);

assert.deepEqual(
  [...CHANGELOG].reverse().slice(0, 3).map((entry) => entry.title),
  ['Mechanical curriculum', 'Sharp AI in every lesson', 'An interactive gallery'],
  'the first three releases follow deployed history',
);

assert.equal(LATEST_RELEASE.title, 'Test the full DECODE robot');
assert.ok(LATEST_RELEASE.body.includes('DECODE field'));
assert.ok(LATEST_RELEASE.additions.some((item) => item.includes('intake stages')));
assert.ok(LATEST_RELEASE.additions.some((item) => item.includes('trigger servo')));
assert.ok(LATEST_RELEASE.additions.some((item) => item.includes('reorder their tabs')));
assert.ok(LATEST_RELEASE.additions.some((item) => item.includes('negative Y')));
assert.equal(LATEST_RELEASE.actionLabel, 'Open the DECODE challenge');

assert.equal(formatChangeDate('2026-09-13'), 'September 13, 2026');
assert.equal(formatChangeDate('not-a-date'), 'not-a-date');

assert.ok(LATEST_RELEASE.image, 'the current release has an image');
assert.ok(
  fs.existsSync(path.join(root, 'static', LATEST_RELEASE.image)),
  'the current release light image exists',
);
assert.equal(LATEST_RELEASE.darkImage, undefined, 'one transparent image serves both themes');
assert.equal(LATEST_RELEASE.image, '/img/releases/1.10(transparent).png');

const cardSource = fs.readFileSync(path.join(root, 'src/components/ui/WhatsNew.tsx'), 'utf8');
const cardCss = fs.readFileSync(path.join(root, 'src/components/ui/WhatsNew.module.css'), 'utf8');
assert.match(cardSource, /telemark\.whatsNew\.dismissedVersion/);
assert.notEqual('1.9', LATEST_RELEASE.version, 'a 1.9 dismissal does not hide the 1.10 release');
assert.match(cardSource, /readDismissedVersion\(\) !== LATEST_RELEASE\.version/);
assert.match(cardSource, /useState\(false\)/, 'the announcement never flashes before dismissal is checked');
assert.doesNotMatch(cardSource, /useLayoutEffect/);
assert.ok(
  cardSource.indexOf('readDismissedVersion() === LATEST_RELEASE.version') < cardSource.indexOf('new Image()'),
  'dismissal is checked before release artwork starts loading',
);
assert.match(cardSource, /image\.onload\s*=\s*\(\)\s*=>[\s\S]*setIsOpen\(true\)/, 'the modal waits until its themed artwork is ready');
assert.equal(
  (cardSource.match(/localStorage\.setItem/g) || []).length,
  1,
  'only the close action stores a dismissal',
);
assert.doesNotMatch(cardSource, /beforeunload|pagehide|visibilitychange/);
assert.doesNotMatch(cardSource, /telemark\.lastSeenChange/);
assert.match(cardSource, /aria-label=.*Dismiss Telemark version/s);
assert.match(cardSource, />×<\/span>/);
assert.match(cardSource, /role="dialog"/);
assert.match(cardSource, /aria-modal="true"/);
assert.doesNotMatch(cardSource, /useColorMode|colorMode|darkImageSrc/);
assert.match(cardSource, /LATEST_RELEASE\.image \?\? '\/img\/releases\/1\.10\(transparent\)\.png'/);
assert.match(cardCss, /position:\s*fixed/);
assert.match(cardCss, /place-items:\s*center/);
assert.match(cardCss, /grid-template-columns:\s*minmax\(0, 1\.08fr\)/);
assert.match(cardCss, /background:\s*rgba\(0, 0, 0, 0\.76\)/);
assert.match(cardCss, /object-fit:\s*contain/, 'release artwork remains fully visible');
assert.doesNotMatch(cardCss, /object-fit:\s*cover/, 'release artwork is never cropped');

const changelogPage = fs.readFileSync(path.join(root, 'src/pages/changelog.tsx'), 'utf8');
assert.equal((changelogPage.match(/<h1/g) || []).length, 1);
assert.match(changelogPage, />Changelog<\/h1>/);
assert.doesNotMatch(changelogPage, /What Telemark added|Only additions are listed/);

console.log('Changelog and release-card tests passed');
