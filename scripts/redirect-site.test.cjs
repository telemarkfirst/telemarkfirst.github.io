const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  legacyBasePath,
  outputRoot,
  routeForHtml,
  sourceRoot,
  targetOrigin,
  walk,
} = require('./build-redirect-site.cjs');

function read(relativeFile) {
  return fs.readFileSync(path.join(outputRoot, relativeFile), 'utf8');
}

function runInlineScript(html, pathname, search = '', hash = '') {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'redirect page must include an inline redirect script');
  const replacements = [];
  const head = {appendChild() {}};
  vm.runInNewContext(script, {
    document: {createElement: () => ({}), head},
    window: {
      location: {
        pathname,
        search,
        hash,
        replace: (value) => replacements.push(value),
      },
    },
  });
  assert.equal(replacements.length, 1, 'redirect script must replace history exactly once');
  return replacements[0];
}

const sourceHtml = walk(sourceRoot).filter((file) => file.endsWith('.html'));
const redirectHtml = walk(outputRoot).filter((file) => file.endsWith('.html'));
assert.equal(redirectHtml.length, sourceHtml.length, 'every built HTML entry point needs a redirect page');

const cases = [
  ['index.html', '/'],
  ['docs/unit-10/get-current-position.html', '/docs/unit-10/get-current-position'],
  ['mechanical/module-00/design-cycle.html', '/mechanical/module-00/design-cycle'],
  ['blocks/blocks-unit-00/workspace-and-run-controls.html', '/blocks/blocks-unit-00/workspace-and-run-controls'],
  ['simulator/unit10.1.html', '/simulator/unit10.1.html'],
];

for (const [relativeFile, route] of cases) {
  assert.equal(routeForHtml(relativeFile), route);
  const html = read(relativeFile);
  const target = `${targetOrigin}${route}`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.equal(
    runInlineScript(html, `${legacyBasePath}${route}`, '?lesson=10', '#encoder'),
    `${target}?lesson=10#encoder`,
  );
  assert.match(html, /Continue to the new page/);
}

const notFound = read('404.html');
assert.equal(
  runInlineScript(notFound, `${legacyBasePath}/docs/a-missing-page`, '?from=old', '#section'),
  `${targetOrigin}/docs/a-missing-page?from=old#section`,
);
assert.equal(
  runInlineScript(notFound, `${legacyBasePath}`, '', ''),
  `${targetOrigin}/`,
);
console.log(`Redirect verification passed for ${redirectHtml.length} routes`);
