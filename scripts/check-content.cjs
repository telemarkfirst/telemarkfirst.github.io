const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

// Both tracks share the same prose rules.
const contentRoots = ['docs', 'mechanical', 'blocks']
  .map((name) => path.join(root, name))
  .filter((directory) => fs.existsSync(directory));

for (const file of contentRoots.flatMap(walk).filter((name) => name.endsWith('.mdx'))) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('—')) failures.push(`${path.relative(root, file)} contains an em dash`);
  if (text.includes('Open the simulator in fullscreen before you start')) {
    failures.push(`${path.relative(root, file)} contains the retired simulator boilerplate`);
  }
}

const checkedSource = [
  path.join(root, 'src/pages/index.tsx'),
  path.join(root, 'src/telemark/curriculum.ts'),
  path.join(root, 'src/telemark/mechanical.ts'),
  path.join(root, 'docusaurus.config.ts'),
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

for (const stale of [
  'Each unit builds on the last',
  'A structured FTC Java curriculum written by students for students',
  'Blocks to Bezier',
]) {
  if (checkedSource.includes(stale)) failures.push(`Stale copy remains: ${stale}`);
}

const simulatorFiles = walk(path.join(root, 'static/simulator'))
  .filter((name) => name.endsWith('.html'));
for (const file of simulatorFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('telemark-java.js')) {
    failures.push(`${path.relative(root, file)} does not load TelemarkJava`);
  }
}

const guideCount = walk(path.join(root, 'docs'))
  .filter((name) => name.endsWith('.mdx'))
  .filter((file) => fs.readFileSync(file, 'utf8').includes('<SimulatorRunGuide />'))
  .length;
if (guideCount !== 70) {
  failures.push(`Expected 70 lessons to use SimulatorRunGuide, found ${guideCount}`);
}

// The mechanical track uses calculators the way the software track uses
// simulators. Each calculator must be reachable from at least one lesson,
// otherwise it is dead code that nobody will notice has broken.
const mechanicalText = fs.existsSync(path.join(root, 'mechanical'))
  ? walk(path.join(root, 'mechanical'))
      .filter((name) => name.endsWith('.mdx'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')
  : '';

// The calculator list comes from the barrel export rather than from a
// directory listing, so shared components and the diagram module are not
// mistaken for calculators.
const calculatorIndex = path.join(root, 'src/components/mechanical/index.ts');
const calculators = fs.existsSync(calculatorIndex)
  ? [...fs.readFileSync(calculatorIndex, 'utf8').matchAll(/export \{default as (\w+)\}/g)].map(
      (match) => match[1],
    )
  : [];

for (const calculator of calculators) {
  if (!mechanicalText.includes(`<${calculator} />`)) {
    failures.push(`Calculator ${calculator} is not used by any mechanical lesson`);
  }
}

// Static lesson diagrams are held to the same rule.
const diagramsPath = path.join(root, 'src/components/mechanical/EngineeringDiagrams.tsx');
const diagrams = fs.existsSync(diagramsPath)
  ? [...fs.readFileSync(diagramsPath, 'utf8').matchAll(/export function (\w+)\(/g)].map((m) => m[1])
  : [];

for (const diagram of diagrams) {
  if (!mechanicalText.includes(`<${diagram} />`)) {
    failures.push(`Diagram ${diagram} is not used by any mechanical lesson`);
  }
}

// Interactive visuals are rendered by calculators rather than by MDX, so they
// are checked against the calculator sources instead.
const visualsDir = path.join(root, 'src/components/mechanical/visuals');
const calculatorText = fs.existsSync(path.join(root, 'src/components/mechanical'))
  ? fs
      .readdirSync(path.join(root, 'src/components/mechanical'))
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => fs.readFileSync(path.join(root, 'src/components/mechanical', name), 'utf8'))
      .join('\n')
  : '';

const visuals = fs.existsSync(visualsDir)
  ? fs
      .readdirSync(visualsDir)
      .filter((name) => name.endsWith('.tsx') && name !== 'Figure.tsx')
      .map((name) => path.basename(name, '.tsx'))
  : [];

for (const visual of visuals) {
  // A visual can belong to a calculator or directly to a lesson: the failure
  // drawings illustrate prose rather than a live calculation. What matters is
  // that nothing in this directory is orphaned.
  if (!calculatorText.includes(`<${visual}`) && !mechanicalText.includes(`<${visual}`)) {
    failures.push(`Visual ${visual} is rendered by no calculator or lesson`);
  }
}

// Every figure must carry a description for assistive technology, since the
// drawing itself carries the meaning.
for (const file of [...visuals.map((v) => path.join(visualsDir, `${v}.tsx`)), diagramsPath].filter((f) => fs.existsSync(f))) {
  const text = fs.readFileSync(file, 'utf8');
  const figureUses = (text.match(/<Figure/g) || []).length;
  const descriptions = (text.match(/description=/g) || []).length;
  if (figureUses !== descriptions) {
    failures.push(
      `${path.relative(root, file)} has ${figureUses} figures but ${descriptions} descriptions`,
    );
  }
}

// Every photo slot must carry alt text and a shot description, or it is
// neither accessible nor actionable.
// Terminated on a close tag at the start of a line, because a prop can now
// hold a self closing component and "the first />" is then inside the props.
const photoSlots = [...mechanicalText.matchAll(/<LessonPhoto\b([\s\S]*?)\n\/>/g)];
for (const [index, slot] of photoSlots.entries()) {
  const block = slot[1];
  for (const required of ['alt=', 'caption=', 'shot=']) {
    if (!block.includes(required)) {
      failures.push(`LessonPhoto slot ${index + 1} is missing ${required.replace('=', '')}`);
    }
  }
}

// Scored quizzes must exist for every module and must not be empty.
const quizPath = path.join(root, 'src/telemark/mechanicalQuizzes.ts');
if (fs.existsSync(quizPath)) {
  const quizSource = fs.readFileSync(quizPath, 'utf8');
  const quizModules = [...quizSource.matchAll(/'(module-\d{2})':/g)].map((m) => m[1]);
  if (quizModules.length !== 14) {
    failures.push(`Expected scored questions for 14 modules, found ${quizModules.length}`);
  }
  for (const moduleSlug of quizModules) {
    if (!mechanicalText.includes(`MASTERY_QUESTIONS['${moduleSlug}']`)) {
      failures.push(`${moduleSlug} has scored questions that no quiz page renders`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(
  `Content checks passed for ${simulatorFiles.length} simulator pages, ${calculators.length} calculators, `
  + `${visuals.length} interactive visuals, ${diagrams.length} lesson diagrams, `
  + `and ${photoSlots.length} photo slots`,
);
