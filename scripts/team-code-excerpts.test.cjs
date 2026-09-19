const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const approvedPins = [
  '247fccab99a8bb5de1c4b45ac6095567afa7c087',
  'fc8d96412ccd32ca1a450c3c9bb24fdcb0f7d749',
  '0680f02e5a8281264c16558c9a953aa15f0cd362',
  '8e2e23df19e9f797923e3904a21fcb981e542b9f',
];

function unitCorpus(unit) {
  const directory = path.join(root, `docs/unit-${String(unit).padStart(2, '0')}`);
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.mdx'))
    .map((name) => fs.readFileSync(path.join(directory, name), 'utf8'))
    .join('\n');
}

function attributedLessonFiles(unit) {
  const directory = path.join(root, `docs/unit-${String(unit).padStart(2, '0')}`);
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.mdx'))
    .filter((name) => approvedPins.some((pin) => (
      fs.readFileSync(path.join(directory, name), 'utf8').includes(pin)
    )));
}

const allLessons = [];
for (let unit = 2; unit <= 15; unit += 1) {
  const corpus = unitCorpus(unit);
  allLessons.push(corpus);
  assert.ok(
    approvedPins.some((pin) => corpus.includes(pin)),
    `Unit ${unit} needs a contextual excerpt linked to an approved pinned source`,
  );
  assert.ok(
    attributedLessonFiles(unit).length >= 2,
    `Unit ${unit} needs attributed professional examples in at least two lesson files`,
  );
}

const curriculum = allLessons.join('\n');
assert.doesNotMatch(curriculum, /ftcdontblink|KookyBotz\/CenterStage|Team 14481|Don't Blink/i);
assert.match(
  unitCorpus(14),
  /KookyBotz\/PowerPlaySleeveDetection\/blob\/247fccab99a8bb5de1c4b45ac6095567afa7c087\/SleeveDetection\.java/,
  'KookyBotz reuse must stay within the approved PowerPlay sleeve pipeline',
);

const byteForceLesson = unitCorpus(3);
assert.match(byteForceLesson, /Based on FTControl bylazar\.com\./);
assert.match(byteForceLesson, /noncommercial/i);
assert.match(byteForceLesson, /LICENSE\.md/);

const notices = fs.readFileSync(path.join(root, 'THIRD_PARTY_CODE_EXCERPTS.md'), 'utf8');
for (const pin of approvedPins) {
  assert.ok(notices.includes(pin), `third-party notices must record pinned revision ${pin}`);
}
assert.match(notices, /Copyright \(c\) 2022 KookyBotz/);
assert.match(notices, /Copyright \(c\) 2025 bylazar\.com/);
assert.match(notices, /Copyright \(c\) 2025 Titan Robotics Club/);
assert.match(notices, /Copyright \(c\) 2026 Lucas Bubner, Murray Bridge High School Student Robotics Club/);
assert.match(notices, /Commercial use of the Software is not permitted/);

console.log('Two approved team-code examples and license checks passed for every Unit 2-15');
