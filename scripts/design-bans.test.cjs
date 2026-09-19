const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guards the design rules the UI review established.
 *
 * These are patterns that read as unconsidered rather than as choices: a
 * coloured stripe on one arbitrary edge, gradient-filled text, a grid of
 * interchangeable icon tiles. They creep back in because each one is the
 * fastest way to make an element look "designed", so they are checked rather
 * than remembered.
 */

const root = path.resolve(__dirname, '..');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const stylesheets = walk(path.join(root, 'src')).filter((f) => f.endsWith('.css'));
const components = walk(path.join(root, 'src')).filter((f) => f.endsWith('.tsx'));

const violations = [];

for (const file of stylesheets) {
  const text = fs.readFileSync(file, 'utf8');
  const where = path.relative(root, file);

  // A >1px coloured accent on one edge of a card, callout, or alert. Use a
  // full border with a background tint instead.
  for (const match of text.matchAll(/border-(left|right):\s*(\d+)px/g)) {
    if (Number(match[2]) > 1) {
      violations.push(`${where}: side-stripe border (${match[0]})`);
    }
  }
  if (/border-(left|right)-width:\s*[2-9]px/.test(text)) {
    violations.push(`${where}: side-stripe border via border-width`);
  }

  // Gradient-filled text is decorative and never carries meaning.
  if (/background-clip:\s*text|-webkit-background-clip:\s*text/.test(text)) {
    violations.push(`${where}: gradient text`);
  }
}

for (const file of components) {
  const text = fs.readFileSync(file, 'utf8');
  const where = path.relative(root, file);

  // The four-across metric bar and the icon-heading-text tile grid are the two
  // structures that make a page read as a template.
  if (/className=\{styles\.statsBar\}/.test(text)) {
    violations.push(`${where}: hero-metric bar`);
  }
  if (/className=\{styles\.featureIcon\}/.test(text)) {
    violations.push(`${where}: identical icon-card grid`);
  }
}

assert.deepEqual(violations, [], `Design rule violations:\n  ${violations.join('\n  ')}`);

// Em dashes are banned in prose across the site, not only in lesson content.
const prose = [
  ...walk(path.join(root, 'src')).filter((f) => f.endsWith('.tsx')),
  path.join(root, 'PRODUCT.md'),
  path.join(root, 'DESIGN.md'),
].filter((f) => fs.existsSync(f));

const emDashFiles = prose.filter((file) => fs.readFileSync(file, 'utf8').includes('—'));
assert.deepEqual(
  emDashFiles.map((f) => path.relative(root, f)),
  [],
  'em dashes found; use commas, colons, semicolons, or parentheses',
);

console.log(
  `Design rule checks passed across ${stylesheets.length} stylesheets and ${components.length} components`,
);
