const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

/**
 * Smoke tests that every engineering component renders.
 *
 * The math is covered by mechanical-math.test.cjs. This catches the other
 * class of breakage: a renamed prop, a bad import, a component that throws on
 * its default inputs. Docusaurus would surface those at build time, but only
 * for components a lesson actually renders, and only as a build failure with
 * no indication of which component is at fault.
 *
 * Node cannot import TSX or CSS modules directly, so the require pipeline is
 * extended: .css resolves to a proxy that returns its own key as a class name,
 * and .ts/.tsx are transpiled in memory with the React JSX transform.
 */

const root = path.resolve(__dirname, '..');

function walk(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

// CSS modules become a proxy so `styles.foo` yields the string 'foo'.
// It must report itself as an ES module and answer `default` with itself,
// otherwise TypeScript's import interop unwraps it into a bare string and every
// className silently becomes undefined.
const cssProxy = new Proxy(
  {},
  {
    get(_target, key) {
      if (key === '__esModule') return true;
      if (key === 'default') return cssProxy;
      return typeof key === 'string' ? key : undefined;
    },
  },
);
require.extensions['.css'] = (module) => {
  module.exports = cssProxy;
};

// Transpile TypeScript and TSX on demand.
function compile(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
}
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

// Resolve the '@site/...' alias Docusaurus provides, and stub the Docusaurus
// and Firebase modules these components import but do not exercise here.
const STUBS = {
  '@docusaurus/Link': {default: ({children, to}) => React.createElement('a', {href: to}, children)},
  '@docusaurus/router': {useHistory: () => ({push: () => {}})},
  '@site/src/telemark/googleAuth': {signInWithGoogle: async () => {}},
  '@site/src/telemark/useAuth': {useAuth: () => ({user: {uid: 'test'}, loading: false})},
  '@site/src/telemark/useProgress': {
    useProgress: () => ({
      isComplete: () => false,
      markComplete: async () => {},
      unmarkComplete: async () => {},
    }),
  },
  '@site/src/telemark/analytics': {trackEvent: () => {}},
};

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  if (STUBS[request]) return request;
  if (request.startsWith('@site/')) {
    return originalResolve.call(this, path.join(root, request.slice('@site/'.length)), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};

const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (STUBS[request]) return STUBS[request];
  return originalLoad.call(this, request, ...rest);
};

let rendered = 0;
function renders(label, element) {
  let markup;
  assert.doesNotThrow(() => {
    markup = renderToStaticMarkup(element);
  }, `${label} threw while rendering`);
  assert.ok(markup && markup.length > 40, `${label} rendered nothing meaningful`);
  rendered += 1;
  return markup;
}

// ── Calculators ─────────────────────────────────────────────────────────────
// Each is rendered on its default state, which is the state a student first
// sees on the lesson page.

const calculators = require(path.join(root, 'src/components/mechanical/index.ts'));
const calculatorNames = Object.keys(calculators);
assert.ok(
  calculatorNames.length >= 13,
  `expected at least 13 exported tools, found ${calculatorNames.length}`,
);

for (const name of calculatorNames) {
  const markup = renders(name, React.createElement(calculators[name]));
  // Every tool must show output, not just its inputs. Calculators render a
  // result block, a table, or a record list; the simulator renders a live
  // telemetry panel. A tool whose output depends on a file the student
  // supplies has nothing to compute yet, so it must instead render an empty
  // state that says what to drop in.
  assert.ok(
    markup.includes('resultValue')
      || markup.includes('table')
      || markup.includes('record')
      || markup.includes('telemetry')
      || markup.includes('drop'),
    `${name} rendered no result, table, record list, telemetry, or empty state`,
  );
}

// ── Interactive visuals ─────────────────────────────────────────────────────
// Rendered through their calculators above, so here they are checked for the
// accessibility contract instead: an aria-label and role on every figure.

for (const name of calculatorNames) {
  const markup = renderToStaticMarkup(React.createElement(calculators[name]));
  const svgCount = (markup.match(/<svg/g) || []).length;
  const labelled = (markup.match(/role="img"/g) || []).length;
  assert.equal(
    svgCount,
    labelled,
    `${name} has ${svgCount} svg elements but ${labelled} with role="img"`,
  );
}

// ── Lesson diagrams ─────────────────────────────────────────────────────────

const diagrams = require(path.join(root, 'src/components/mechanical/EngineeringDiagrams.tsx'));
const diagramNames = Object.keys(diagrams).filter((key) => key.endsWith('Diagram'));
assert.ok(diagramNames.length >= 8, `expected at least 8 diagrams, found ${diagramNames.length}`);

for (const name of diagramNames) {
  const markup = renders(name, React.createElement(diagrams[name]));
  assert.match(markup, /aria-label="/, `${name} is missing an aria-label`);
  assert.match(markup, /<figcaption/, `${name} is missing a caption`);
}

const designCycleMarkup = renderToStaticMarkup(React.createElement(diagrams.DesignCycleDiagram));
assert.match(
  designCycleMarkup,
  /fill="var\(--tm-surface-1\)"/,
  'DesignCycleDiagram stage labels need a theme-aware background',
);
assert.match(
  designCycleMarkup,
  /stroke="var\(--tm-accent\)"/,
  'DesignCycleDiagram needs a theme-aware outline',
);

// ── Quizzes and exercises ───────────────────────────────────────────────────

const {MASTERY_QUESTIONS} = require(path.join(root, 'src/telemark/mechanicalQuizzes.ts'));
const ScoredQuiz = require(path.join(root, 'src/components/mechanical/ScoredQuiz.tsx')).default;

const moduleKeys = Object.keys(MASTERY_QUESTIONS);
assert.equal(moduleKeys.length, 14, 'expected scored questions for all 14 modules');

for (const key of moduleKeys) {
  const questions = MASTERY_QUESTIONS[key];
  assert.ok(questions.length >= 5, `${key} has only ${questions.length} scored questions`);

  questions.forEach((question, index) => {
    const where = `${key} question ${index + 1}`;
    assert.ok(question.prompt.length > 20, `${where} has a suspiciously short prompt`);
    assert.ok(question.options.length >= 3, `${where} needs at least 3 options`);
    assert.ok(
      Number.isInteger(question.answer)
        && question.answer >= 0
        && question.answer < question.options.length,
      `${where} has an answer index outside its options`,
    );
    assert.ok(question.explain.length > 30, `${where} has no real explanation`);
    assert.equal(
      new Set(question.options).size,
      question.options.length,
      `${where} has duplicate options`,
    );
  });

  const markup = renders(
    `ScoredQuiz ${key}`,
    React.createElement(ScoredQuiz, {lessonId: `${key}/mastery-quiz`, questions}),
  );
  // The correct answer must not be identifiable before grading.
  assert.ok(!markup.includes('correct'), `${key} leaks the answer before grading`);
}

// ── Interactivity and animation ─────────────────────────────────────────────
// Animation here is explanatory rather than decorative, which makes it
// optional by definition. These checks guard the contract that every animated
// component yields to prefers-reduced-motion and that nothing is lost when it
// does: the value is still adjustable by hand.

const animation = require(path.join(root, 'src/components/mechanical/useAnimation.ts'));
assert.equal(typeof animation.usePrefersReducedMotion, 'function', 'reduced motion hook missing');
assert.equal(typeof animation.useSweep, 'function', 'sweep hook missing');

const componentDir = path.join(root, 'src/components/mechanical');
const animatedComponents = fs
  .readdirSync(componentDir)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({name, text: fs.readFileSync(path.join(componentDir, name), 'utf8')}))
  .filter((file) => file.text.includes('useSweep') || file.text.includes('usePrefersReducedMotion'));

assert.ok(
  animatedComponents.length >= 4,
  `expected at least 4 animated components, found ${animatedComponents.length}`,
);

for (const file of animatedComponents) {
  // Everything that animates must honour reduced motion, either through the
  // sweep hook (which handles it internally and exposes `disabled`) or an
  // explicit check.
  assert.ok(
    file.text.includes('disabled={sweep.disabled}')
      || file.text.includes('usePrefersReducedMotion'),
    `${file.name} animates without honouring reduced motion`,
  );

  // Motion the student drives needs a control to start and stop it. Ambient
  // motion, such as the slow pulse around the design cycle, does not: it has
  // no state to control and stops entirely under reduced motion.
  if (file.text.includes('useSweep')) {
    assert.ok(
      file.text.includes('PlayControl'),
      `${file.name} drives a sweep with no play control`,
    );
  }
}

const sweepDriven = animatedComponents.filter((file) => file.text.includes('useSweep'));
assert.ok(sweepDriven.length >= 3, `expected at least 3 sweep-driven components, found ${sweepDriven.length}`);

// SMIL is not affected by CSS animation-play-state, so any declarative SVG
// animation must be conditionally rendered rather than paused with CSS.
const smilFiles = [
  ...fs.readdirSync(componentDir).map((n) => path.join(componentDir, n)),
  ...fs.readdirSync(path.join(componentDir, 'visuals')).map((n) => path.join(componentDir, 'visuals', n)),
].filter((file) => file.endsWith('.tsx'));

for (const file of smilFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('<animateMotion')) {
    assert.ok(
      text.includes('!reducedMotion') || text.includes('reducedMotion &&'),
      `${path.basename(file)} uses animateMotion without a reduced-motion guard`,
    );
  }
  if (text.includes('<animateTransform')) {
    assert.ok(
      text.includes('spinning &&') || text.includes('!reducedMotion'),
      `${path.basename(file)} uses animateTransform without a guard`,
    );
  }
}

// The play control must render disabled with an explanation, not disappear.
const PlayControl = require(path.join(componentDir, 'PlayControl.tsx')).default;
const disabledMarkup = renderToStaticMarkup(
  React.createElement(PlayControl, {
    playing: false,
    disabled: true,
    onToggle: () => {},
    label: 'Sweep',
  }),
);
assert.match(disabledMarkup, /disabled/, 'PlayControl must render disabled, not hidden');
assert.match(disabledMarkup, /reduced motion/, 'PlayControl must explain why it is disabled');
rendered += 1;

// Sliders and presets: the interactive controls the lessons rely on.
const withSliders = calculatorNames.filter((name) => {
  const markup = renderToStaticMarkup(React.createElement(calculators[name]));
  return markup.includes('type="range"');
});
assert.ok(withSliders.length >= 2, `expected sliders on at least 2 calculators, found ${withSliders.length}`);

for (const name of withSliders) {
  const markup = renderToStaticMarkup(React.createElement(calculators[name]));
  // A slider alone is imprecise, so an exact number entry must accompany it.
  assert.match(
    markup,
    /aria-label="[^"]*exact value"/,
    `${name} has a slider with no exact number entry`,
  );
}

const withPresets = calculatorNames.filter((name) =>
  renderToStaticMarkup(React.createElement(calculators[name])).includes('Scenarios'),
);
assert.ok(withPresets.length >= 3, `expected presets on at least 3 calculators, found ${withPresets.length}`);

// ── Site interactivity ──────────────────────────────────────────────────────

const uiDir = path.join(root, 'src/components/ui');
assert.equal(fs.existsSync(path.join(uiDir, 'useReveal.ts')), false, 'removed scroll reveals must not return');

const rootSource = fs.readFileSync(path.join(root, 'src/theme/Root.tsx'), 'utf8');
assert.doesNotMatch(rootSource, /ReadingProgress/, 'lesson pages must not render a scroll progress bar');
assert.equal(
  fs.existsSync(path.join(uiDir, 'ReadingProgress.tsx')),
  false,
  'the removed scroll progress component must not return',
);

const CadExercise = require(path.join(root, 'src/components/mechanical/CadExercise.tsx')).default;
renders(
  'CadExercise',
  React.createElement(CadExercise, {
    number: '1.1',
    title: 'Test exercise',
    difficulty: 'Starter',
    minutes: 20,
    brief: 'A brief that is long enough to be meaningful.',
    requirements: ['One requirement'],
    acceptance: ['One acceptance check'],
    trap: 'The thing this is really testing.',
  }),
);

// ── Workbench and lesson framing ────────────────────────────────────────────
// The catalogue drives both the workbench rail and the lesson embeds, so a
// tool cannot appear in one and be missing from the other.

const {TOOL_CATALOG, TOOL_GROUPS} = require(
  path.join(componentDir, 'toolCatalog.tsx'),
);

assert.equal(
  TOOL_CATALOG.length,
  calculatorNames.length,
  `catalogue lists ${TOOL_CATALOG.length} tools but ${calculatorNames.length} calculators are exported`,
);
assert.ok(TOOL_GROUPS.length >= 3, 'tools should be grouped for the rail');

const seenIds = new Set();
for (const tool of TOOL_CATALOG) {
  assert.ok(!seenIds.has(tool.id), `duplicate tool id ${tool.id}`);
  seenIds.add(tool.id);
  assert.ok(tool.keywords.length > 10, `${tool.id} has no search keywords`);
  // Every tool must send the student back to the teaching that explains it.
  // Usually that is a module lesson; the CAD checker's home is the practice
  // page, which is track material for the same reason.
  assert.match(
    tool.lesson.path,
    /^\/mechanical\/(module-|cad-practice)/,
    `${tool.id} does not link to track teaching`,
  );
  const markup = renderToStaticMarkup(tool.render());
  assert.ok(markup.length > 200, `${tool.id} rendered nothing`);
  rendered += 1;
}

// Every lesson embed must carry the framing, and point at a real catalogue id.
const lessonFiles = walk(path.join(root, 'mechanical')).filter((f) => f.endsWith('.mdx'));
let framed = 0;
for (const file of lessonFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/<LessonTool\b([\s\S]*?)>/g)) {
    framed += 1;
    const block = match[1];
    for (const required of ['toolId=', 'bring=', 'change=', 'read=']) {
      assert.ok(block.includes(required), `${path.basename(file)} LessonTool missing ${required}`);
    }
    const id = block.match(/toolId="([^"]+)"/)?.[1];
    assert.ok(seenIds.has(id), `${path.basename(file)} references unknown tool "${id}"`);
  }
}
assert.ok(framed >= 12, `expected at least 12 framed lesson tools, found ${framed}`);

console.log(
  `Mechanical render tests passed: ${rendered} components rendered, `
  + `${TOOL_CATALOG.length} tools catalogued and ${framed} framed in lessons, `
  + `${animatedComponents.length} animated with reduced-motion guards, `
  + `${withSliders.length} with sliders, ${withPresets.length} with presets, `
  + `${calculatorNames.length} calculators, ${diagramNames.length} diagrams, `
  + `${moduleKeys.length} quizzes covering ${Object.values(MASTERY_QUESTIONS).flat().length} questions`,
);
