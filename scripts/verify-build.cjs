const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const buildRoot = path.resolve(__dirname, '../build');

function findRoute(route) {
  const clean = route.replace(/^\/+|\/+$/g, '');
  const candidates = [
    path.join(buildRoot, `${clean}.html`),
    path.join(buildRoot, clean, 'index.html'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(found, `Missing built route /${clean}`);
  return fs.readFileSync(found, 'utf8');
}

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const homepage = fs.readFileSync(path.join(buildRoot, 'index.html'), 'utf8');
assert.match(homepage, /Learn FTC/, 'Homepage must render the primary heading');
assert.match(homepage, /Learn through experience with integrated lessons featuring software and mechanical simulators\./);
assert.match(homepage, /Begin Software/);
assert.match(homepage, /Begin Mechanical/);
assert.match(homepage, /telemark-hero(?:-light)?\.mp4/, 'Homepage must retain the hero video');
assert.doesNotMatch(homepage, /Student-built FTC software and mechanical curriculum/);
assert.doesNotMatch(homepage, /Learn to program an FTC robot/);
assert.doesNotMatch(homepage, /software lessons|Units and modules|Calculators and checks|Version 1\.10/);
assert.doesNotMatch(homepage, /Built by FTC Team 30450/);
assert.match(homepage, /telemark-build-commit/);

findRoute('/curriculum');
findRoute('/simulator');
findRoute('/search');
findRoute('/blocks');
findRoute('/blocks/blocks-unit-00');
findRoute('/blocks/blocks-unit-00/workspace-and-run-controls');
findRoute('/blocks/blocks-unit-05/delivery-controller-challenge');
findRoute('/blocks/next-step');
findRoute('/blocks/python-resources');
findRoute('/blocks/fll');
findRoute('/blocks/fll/unit-00');
findRoute('/blocks/fll/unit-00/what-is-fll-challenge');
findRoute('/blocks/fll/unit-01/retrieve-deliver-challenge');
findRoute('/blocks/fll/unit-02/mission-run-capstone');
findRoute('/docs/unit-00');
findRoute('/docs/unit-00/classes-and-objects');
findRoute('/docs/unit-01/prerequisites');
findRoute('/docs/unit-06/opmode-active');

findRoute('/docs/unit-10/get-current-position');
const builtJavaScript = walk(path.join(buildRoot, 'assets/js'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
assert.match(
  builtJavaScript,
  /still cannot see wheel slip, backlash, loose couplers, or a mechanism that stalls/,
);

// ── Cross-track and internal link audit ────────────────────────────────────
// Docusaurus's onBrokenLinks check did not catch a doc whose `id` frontmatter
// silently moved its route away from the path other lessons linked to, so the
// built routes are compared against every internal link written in source.

const repoRoot = path.resolve(__dirname, '..');

const builtRoutes = new Set();
for (const file of walk(buildRoot).filter((name) => name.endsWith('.html'))) {
  const relative = path.relative(buildRoot, file).replaceAll(path.sep, '/');
  builtRoutes.add(`/${relative.slice(0, -'.html'.length)}`);
  if (relative.endsWith('index.html')) {
    builtRoutes.add(`/${relative.slice(0, -'index.html'.length).replace(/\/$/, '')}`);
  }
}

const sourceDirs = ['mechanical', 'docs', 'blocks']
  .map((name) => path.join(repoRoot, name))
  .filter((directory) => fs.existsSync(directory));

const brokenLinks = [];
let linksChecked = 0;

for (const file of sourceDirs.flatMap(walk).filter((name) => name.endsWith('.mdx'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\]\((\/(?:mechanical|docs|blocks)[^)#\s]*)\)/g)) {
    linksChecked += 1;
    const route = match[1].replace(/\/+$/, '');
    if (!builtRoutes.has(route)) {
      brokenLinks.push(`${path.relative(repoRoot, file)} -> ${route}`);
    }
  }
}

assert.equal(
  brokenLinks.length,
  0,
  `Broken internal links:\n  ${brokenLinks.join('\n  ')}`,
);
assert.ok(linksChecked >= 20, `expected at least 20 internal links, found ${linksChecked}`);

const buildMeta = JSON.parse(
  fs.readFileSync(path.join(buildRoot, 'build-meta.json'), 'utf8'),
);
assert.match(buildMeta.commit, /^[0-9a-f]{7,40}$/i);
assert.ok(buildMeta.builtAt);

console.log(
  `Build verification passed for commit ${buildMeta.commit.slice(0, 12)}, `
  + `${linksChecked} internal links resolved`,
);
