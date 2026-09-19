const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
const mechanicalRoot = path.join(root, 'mechanical');

/**
 * Verifies that the mechanical track's data model and its MDX files agree.
 *
 * The data model in src/telemark/mechanical.ts drives every navigation
 * surface: the track landing page, unit overviews, the dashboard, and progress
 * tracking. A lesson listed there with no corresponding MDX file produces a
 * link to a 404 that no build step catches, because those links are generated
 * at runtime by React rather than written in markdown.
 */

const source = fs.readFileSync(
  path.join(root, 'src/telemark/mechanical.ts'),
  'utf8',
);

const seedBlock = source.split('const MODULE_SEEDS: ModuleSeed[] = [')[1];
assert.ok(seedBlock, 'MODULE_SEEDS array not found in engineering.ts');

const moduleChunks = seedBlock.split(/\n {2}\{\n {4}number: '/).slice(1);
assert.ok(moduleChunks.length > 0, 'no module seeds parsed');

const modules = moduleChunks.map((chunk) => {
  const number = chunk.slice(0, 2);
  const titleMatch = chunk.match(/\n {4}title: '(.*?)',\n/);
  assert.ok(titleMatch, `module ${number} has no title`);
  const lessonsBlock = chunk.split('lessons: [')[1];
  assert.ok(lessonsBlock, `module ${number} has no lessons block`);
  const lessons = [...lessonsBlock.matchAll(/\{slug: '([^']+)'/g)].map(
    (match) => match[1],
  );
  return {number, title: titleMatch[1], lessons};
});

assert.equal(modules.length, 14, 'expected 14 mechanical modules');

let lessonFileCount = 0;

for (const module of modules) {
  const directory = path.join(mechanicalRoot, `module-${module.number}`);
  assert.ok(
    fs.existsSync(directory),
    `missing directory for module-${module.number}`,
  );

  const files = fs.readdirSync(directory);
  const idFor = (file) =>
    fs.readFileSync(path.join(directory, file), 'utf8').match(/^id:\s*(\S+)/m)?.[1];
  const idsPresent = new Set(
    files.filter((file) => file.endsWith('.mdx')).map(idFor),
  );

  // Category metadata drives the sidebar grouping.
  const categoryPath = path.join(directory, '_category_.json');
  assert.ok(fs.existsSync(categoryPath), `module-${module.number} missing _category_.json`);
  const category = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));
  assert.equal(
    category.label,
    `Module ${Number.parseInt(module.number, 10)}: ${module.title}`,
    `module-${module.number} category label does not match the data model title`,
  );
  assert.equal(
    category.link.id,
    `module-${module.number}/overview`,
    `module-${module.number} category link should point at its overview`,
  );

  assert.ok(
    idsPresent.has('overview'),
    `module-${module.number} has no overview document`,
  );
  assert.ok(
    idsPresent.has('mastery-quiz'),
    `module-${module.number} has no mastery quiz`,
  );

  // Four is the standard module length. Module 05 is deliberately longer
  // because it covers the whole Onshape feature set rather than a summary,
  // so this is a floor and not an equality.
  assert.ok(
    module.lessons.length >= 4,
    `module-${module.number} should define at least 4 lessons, found ${module.lessons.length}`,
  );

  for (const slug of module.lessons) {
    assert.ok(
      idsPresent.has(slug),
      `module-${module.number} declares lesson "${slug}" with no matching MDX file`,
    );
  }

  // Every lesson body must record progress under the right track id, or the
  // dashboard and unit overview will never mark it complete.
  for (const file of files.filter((name) => name.endsWith('.mdx'))) {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');
    const id = idFor(file);
    if (id === 'overview') continue;

    lessonFileCount += 1;
    assert.match(
      text,
      new RegExp(`lessonId="module-${module.number}/${id}"`),
      `${file} does not mark completion for module-${module.number}/${id}`,
    );
    assert.doesNotMatch(text, /—/, `${file} contains an em dash`);
  }
}

assert.equal(lessonFileCount, 76, `expected 76 mechanical lessons, found ${lessonFileCount}`);

// Track-level pages the navbar and sidebar depend on.
const indexDoc = fs.readFileSync(path.join(mechanicalRoot, 'index.mdx'), 'utf8');
assert.match(indexDoc, /slug: \//, 'engineering index must own the /engineering route');
assert.match(indexDoc, /TrackOverview/, 'engineering index must render the track overview');

const config = fs.readFileSync(path.join(root, 'docusaurus.config.ts'), 'utf8');
assert.match(config, /routeBasePath: 'mechanical'/, 'engineering docs plugin not configured');
assert.match(config, /sidebarPath: '\.\/sidebarsMechanical\.ts'/, 'engineering sidebar not configured');
assert.match(
  config,
  /to: '\/mechanical\/module-00\/design-cycle'/,
  'navbar must start the engineering track at its first lesson',
);

// Access gating must treat engineering modules exactly like software units.
const accessPolicy = fs.readFileSync(path.join(root, 'src/telemark/accessPolicy.ts'), 'utf8');
assert.match(
  accessPolicy,
  /\(blocks-unit\|fll-unit\|unit\|module\)-/,
  'accessPolicy must recognize engineering module paths',
);

// ── Cross-track links ──────────────────────────────────────────────────────
// The two tracks describe one robot. These links are the only thing telling a
// student that the ratio they just chose is the number the code divides by, so
// they are treated as a feature rather than as decoration.

const mechanicalText = walk(mechanicalRoot)
  .filter((name) => name.endsWith('.mdx'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

const softwareText = walk(path.join(root, 'docs'))
  .filter((name) => name.endsWith('.mdx'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

const toSoftware = (mechanicalText.match(/\]\(\/docs\/unit-/g) || []).length;
const toEngineering = (softwareText.match(/\]\(\/mechanical\/module-/g) || []).length;

assert.ok(
  toSoftware >= 6,
  `expected at least 6 links from mechanical lessons into the software track, found ${toSoftware}`,
);
assert.ok(
  toEngineering >= 5,
  `expected at least 5 links from software lessons into the engineering track, found ${toEngineering}`,
);

console.log(
  `Mechanical track checks passed for ${modules.length} modules and ${lessonFileCount} lessons, `
  + `with ${toSoftware} links to software and ${toEngineering} back`,
);
