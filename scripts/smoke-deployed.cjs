const assert = require('node:assert/strict');

const baseUrl = (process.env.TELEMARK_DEPLOY_URL
  || 'https://telemarkfirst.github.io').replace(/\/$/, '');
const expectedCommit = process.env.TELEMARK_BUILD_COMMIT || process.env.GITHUB_SHA;
const retryDelayMs = Number.parseInt(
  process.env.TELEMARK_SMOKE_RETRY_DELAY_MS || '15000',
  10,
);

async function fetchWithRetry(route, attempts = 8, validate) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const separator = route.includes('?') ? '&' : '?';
      const cacheKey = `${expectedCommit || Date.now()}-${attempt}`;
      const response = await fetch(
        `${baseUrl}${route}${separator}telemark_smoke=${cacheKey}`,
        {cache: 'no-store'},
      );
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (validate) await validate(response.clone());
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  throw lastError;
}

async function main() {
  const meta = await fetchWithRetry(
    '/build-meta.json',
    12,
    async (response) => {
      const deployedMeta = await response.json();
      if (expectedCommit && deployedMeta.commit !== expectedCommit) {
        throw new Error(
          `Deployment still serves ${deployedMeta.commit}; expected ${expectedCommit}`,
        );
      }
    },
  ).then((response) => response.json());

  const homepage = await fetchWithRetry('/').then((response) => response.text());
  assert.match(homepage, /Learn FTC/, 'homepage missing the primary heading');
  assert.match(homepage, /Learn through experience with integrated lessons featuring software and mechanical simulators\./);
  assert.match(homepage, /Begin Software/);
  assert.match(homepage, /Begin Mechanical/);
  assert.match(homepage, /telemark-hero(?:-light)?\.mp4/, 'homepage missing the hero video');
  assert.doesNotMatch(homepage, /Student-built FTC software and mechanical curriculum/);
  assert.doesNotMatch(homepage, /Learn to program an FTC robot/);
  assert.doesNotMatch(homepage, /software lessons|Units and modules|Calculators and checks|Version 1\.10/);
  assert.doesNotMatch(homepage, /Built by FTC Team 30450/);

  for (const route of [
    '/curriculum',
    '/simulator',
    '/search',
    '/docs/unit-00',
    '/docs/unit-00/classes-and-objects',
    '/docs/unit-01/prerequisites',
    '/docs/unit-06/opmode-active',
  ]) {
    await fetchWithRetry(route);
  }

  await fetchWithRetry('/docs/unit-10/get-current-position');

  console.log(`Deployment smoke test passed for ${meta.commit.slice(0, 12)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
