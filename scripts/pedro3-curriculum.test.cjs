const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const lessonFiles = [
  'docs/unit-15/15.2-pedro-pathing.mdx',
  'docs/unit-15/15.3-bezier-curves.mdx',
  'docs/unit-15/15.4-limelight-fusion.mdx',
  'docs/unit-15/15.5-full-autonomous.mdx',
  'docs/unit-15/15.6-mastery-coding-challenge.mdx',
];
const lessons = lessonFiles.map(read).join('\n');

for (const legacy of [
  /com\.pedropathing\.localization\.Pose/,
  /com\.pedropathing\.pathgen/,
  /follower\.setStartingPose/,
  /follower\.getPose/,
  /follower\.followPath(?:Chain)?/,
]) {
  assert.doesNotMatch(lessons, legacy, `Unit 15 lessons must not teach legacy Pedro API: ${legacy}`);
}

for (const current of [
  /Constants\.create\(hardwareMap\)/,
  /PoseFactory\.degrees\(\)/,
  /com\.pedropathing\.math\.Pose/,
  /com\.pedropathing\.paths\.Path/,
  /follower\.setPose\(/,
  /follower\.pose\(\)\.x\(\)/,
  /Scheduler\.execute\(\)/,
  /waitMs\(/,
]) {
  assert.match(lessons, current, `Unit 15 must cover current Pedro 3/Ivy API: ${current}`);
}

const intro = read('docs/unit-15/15.2-pedro-pathing.mdx');
assert.match(intro, /\*\*No\.\*\* Pedro can follow a path directly/, 'Lesson 15.2 must explain that Ivy is optional');
assert.match(intro, /command framework instead of a hand-written state machine/, 'Lesson 15.2 must explain the recommended control-flow choice');
assert.match(intro, /com\.pedropathing\.ivy:pedro:1\.1\.1/, 'Lesson 15.2 must show the current Ivy dependency');

const pathsSimulator = read('static/simulator/unit15.3.html');
assert.match(pathsSimulator, /src="https:\/\/visualizer\.pedropathing\.com\/"/, 'Unit 15.3 must embed the live official visualizer');
assert.match(pathsSimulator, /path\(line\(\.\.\.\), curve\(\.\.\.\)\)/, 'Unit 15.3 must teach the Pedro 3 Paths API');

const ivySimulator = read('static/simulator/unit15.5.html');
for (const api of [/Constants\.create/, /return sequential\(/, /follow\(follower, scoringPath\)/, /waitMs\(500\)/, /Scheduler\.execute\(\)/]) {
  assert.match(ivySimulator, api, `Unit 15.5 simulator must exercise ${api}`);
}
assert.match(read('static/simulator/navigator.html'), /Pedro 3 \+ Ivy/, 'Simulator navigation must use current lesson terminology');

console.log('Pedro 3 curriculum and simulator API checks passed.');
