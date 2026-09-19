const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.agents',
  '.codex',
  '.docusaurus',
  '.git',
  'build',
  'lib',
  'node_modules',
  'redirect-build',
]);

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const text = (...characters) => String.fromCharCode(...characters);
const teamName = text(83, 104, 97, 114, 112, 32, 70, 97, 99, 101, 32, 82, 111, 98, 111, 116, 105, 99, 115);
const schoolName = text(69, 72, 83, 32, 82, 111, 98, 111, 116, 105, 99, 115);
const schoolAcronym = text(69, 72, 83);
const oldHost = text(115, 104, 97, 114, 112, 102, 97, 99, 101, 114, 111, 98, 111, 116, 105, 99, 115, 46, 103, 105, 116, 104, 117, 98, 46, 105, 111);
const oldEmail = text(115, 104, 97, 114, 112, 102, 97, 99, 101, 114, 111, 98, 111, 116, 105, 99, 115, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109);
const oldRobotName = text(75, 71, 45, 83, 70, 82);
const teamAttributionFiles = new Set([
  'robot-cad-sources/README.md',
  'scripts/cad-assets.test.cjs',
  'scripts/rig-decode-mechanisms.cjs',
  'static/simulator/mastery_challenge.js',
  'static/simulator/models/30450-decode-robot-telemark.glb',
]);
const forbiddenFilename = new RegExp([
  schoolAcronym,
  oldRobotName.replace('-', '\\-'),
  oldHost.split('.')[0],
].join('|'), 'i');

const violations = [];
for (const file of walk(repoRoot)) {
  const relative = path.relative(repoRoot, file).replaceAll(path.sep, '/');
  const source = fs.readFileSync(file).toString('latin1');
  for (const marker of [schoolName, oldHost, oldEmail, oldRobotName]) {
    if (source.toLowerCase().includes(marker.toLowerCase())) {
      violations.push(`${relative}: contains removed identity marker ${JSON.stringify(marker)}`);
    }
  }
  if (source.toLowerCase().includes(teamName.toLowerCase()) && !teamAttributionFiles.has(relative)) {
    violations.push(`${relative}: team name appears outside the CAD attribution allowlist`);
  }
  if (forbiddenFilename.test(path.basename(relative))) {
    violations.push(`${relative}: filename retains a removed identity marker`);
  }
}

assert.deepEqual(violations, [], violations.join('\n'));

const challenge = fs.readFileSync(path.join(repoRoot, 'static/simulator/mastery_challenge.js'), 'utf8');
assert.match(challenge, /Team 30450 .* CAD .* explicit team permission .* modified from the original/i);
assert.match(challenge, /https:\/\/ftc-events\.firstinspires\.org\/2025\/team\/30450/);

assert.ok(fs.existsSync(path.join(repoRoot, 'static/img/sharp-ai.svg')), 'Sharp AI icon must remain');
assert.match(
  fs.readFileSync(path.join(repoRoot, 'src/telemark/askSharpAi.ts'), 'utf8'),
  /Sharp AI/,
  'Sharp AI client must remain',
);

console.log('Brand detachment audit passed; Sharp AI and explicit CAD credit are preserved');
