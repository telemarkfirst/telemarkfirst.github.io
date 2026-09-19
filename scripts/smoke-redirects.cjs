const assert = require('node:assert/strict');

const legacyUrl = process.env.TELEMARK_DEPLOY_URL?.replace(/\/$/, '');
assert.ok(legacyUrl, 'TELEMARK_DEPLOY_URL is required for the deployed redirect smoke test');

const cases = [
  ['/', 'https://telemarkfirst.github.io/'],
  ['/docs/unit-10/get-current-position', 'https://telemarkfirst.github.io/docs/unit-10/get-current-position'],
  ['/mechanical/module-00/design-cycle', 'https://telemarkfirst.github.io/mechanical/module-00/design-cycle'],
];

async function main() {
  for (const [route, target] of cases) {
    const response = await fetch(`${legacyUrl}${route}`, {cache: 'no-store', redirect: 'manual'});
    assert.equal(response.status, 200, `${route} must serve a redirect document`);
    const html = await response.text();
    assert.match(html, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  console.log('Deployed redirect smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
