const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guards the design token system.
 *
 * Before this existed the site had 237 distinct colour literals from 641 uses,
 * 77 border-radius values, and 67 font sizes, because every stylesheet reached
 * for a slightly different shade of the same intent. Tokens fix that once; this
 * test is what stops it drifting back.
 */

const root = path.resolve(__dirname, '..');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const stylesheets = walk(path.join(root, 'src')).filter((file) => file.endsWith('.css'));
assert.ok(stylesheets.length > 15, 'expected the full set of stylesheets');

const globalCss = fs.readFileSync(path.join(root, 'src/css/custom.css'), 'utf8');

// ── The token set must exist ────────────────────────────────────────────────

const REQUIRED_TOKENS = [
  '--tm-bg', '--tm-surface-1', '--tm-surface-2', '--tm-surface-3', '--tm-surface-4',
  '--tm-text-strong', '--tm-text', '--tm-text-soft', '--tm-text-muted', '--tm-text-faint',
  '--tm-accent', '--tm-accent-bright', '--tm-blue', '--tm-blue-soft',
  '--tm-success', '--tm-warn', '--tm-danger',
  '--tm-border', '--tm-border-strong', '--tm-border-quiet', '--tm-border-hair',
  '--tm-font-display', '--tm-font-body', '--tm-font-label', '--tm-font-mono',
  '--tm-fs-2xs', '--tm-fs-xs', '--tm-fs-sm', '--tm-fs-base', '--tm-fs-md',
  '--tm-fs-lg', '--tm-fs-xl', '--tm-fs-2xl', '--tm-fs-3xl',
  '--tm-sp-1', '--tm-sp-2', '--tm-sp-3', '--tm-sp-4', '--tm-sp-5', '--tm-sp-6',
  '--tm-r-sm', '--tm-r-md', '--tm-r-lg', '--tm-r-pill', '--tm-r-hand',
  '--tm-dur', '--tm-ease',
];

for (const token of REQUIRED_TOKENS) {
  assert.ok(
    new RegExp(`\\s${token}:`).test(globalCss),
    `design token ${token} is not defined in custom.css`,
  );
}

// Reduced motion must collapse the duration tokens, so any transition built
// from them stops without each component opting in separately.
assert.match(
  globalCss,
  /prefers-reduced-motion[\s\S]{0,220}--tm-dur/,
  'reduced motion must neutralise the duration tokens',
);

// ── Component stylesheets must prefer tokens over literals ──────────────────

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

let literalUses = 0;
let tokenUses = 0;
const offenders = [];

for (const file of stylesheets) {
  let text = fs.readFileSync(file, 'utf8');
  // The token block is where literals are supposed to live.
  if (path.basename(file) === 'custom.css') {
    text = text.split('/* ---- NAVBAR ---- */').slice(1).join('');
  }
  const literals = (text.match(COLOUR) || []).filter(
    // Pure black and white alphas are legitimate for shadows and scrims.
    (value) => !/^rgba\(0,\s*0,\s*0/.test(value) && !/^rgba\(255,\s*255,\s*255/.test(value),
  );
  const tokens = (text.match(/var\(--tm-/g) || []).length;
  literalUses += literals.length;
  tokenUses += tokens;
  if (literals.length > 30) {
    offenders.push(`${path.relative(root, file)} (${literals.length} literals)`);
  }
}

assert.ok(
  tokenUses > literalUses,
  `stylesheets use ${literalUses} colour literals against ${tokenUses} tokens; tokens must dominate`,
);
assert.ok(
  literalUses < 200,
  `colour literals have grown to ${literalUses}; fold the new ones onto tokens`,
);
assert.deepEqual(offenders, [], `stylesheets leaning on literals: ${offenders.join(', ')}`);

// ── Scales must stay small ──────────────────────────────────────────────────

const allCss = stylesheets
  .map((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return path.basename(file) === 'custom.css'
      ? text.split('/* ---- NAVBAR ---- */').slice(1).join('')
      : text;
  })
  .join('\n');

const radii = new Set(
  [...allCss.matchAll(/border-radius:\s*([^;]+)/g)].map((m) => m[1].trim()),
);
const sizes = new Set(
  [...allCss.matchAll(/font-size:\s*([^;]+)/g)].map((m) => m[1].trim()),
);

assert.ok(radii.size <= 24, `border-radius has drifted to ${radii.size} distinct values`);
assert.ok(sizes.size <= 32, `font-size has drifted to ${sizes.size} distinct values`);

// ── A custom property cannot be negated directly ────────────────────────────
// `left: -var(--x)` parses as invalid and silently does nothing, which is very
// easy to miss because the page still renders.

for (const file of stylesheets) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(
    !/[:\s]-var\(/.test(text),
    `${path.relative(root, file)} negates a custom property directly; use calc(-1 * var(...))`,
  );
}

// ── Every token referenced must actually be defined ─────────────────────────

// A var() naming a token that does not exist resolves to nothing and the
// property is simply dropped, so an invented name fails silently and looks
// fine until someone views the page. Counting uses, as the checks above do,
// cannot catch that: a wrong name is still a token-shaped use.

const definedTokens = new Set(
  [...globalCss.matchAll(/^\s*(--tm-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
);

const undefinedUses = [];
for (const file of stylesheets) {
  const css = fs.readFileSync(file, 'utf8');
  for (const match of css.matchAll(/var\(\s*(--tm-[a-z0-9-]+)/g)) {
    if (!definedTokens.has(match[1])) {
      undefinedUses.push(`${path.relative(root, file)} uses ${match[1]}`);
    }
  }
}
assert.deepEqual(
  undefinedUses,
  [],
  `stylesheets reference tokens that are never defined:\n  ${undefinedUses.join('\n  ')}`,
);

console.log(
  `Design token checks passed: ${REQUIRED_TOKENS.length} tokens defined, `
  + `${tokenUses} token uses against ${literalUses} literals, `
  + `${radii.size} radius and ${sizes.size} font-size values`,
);
