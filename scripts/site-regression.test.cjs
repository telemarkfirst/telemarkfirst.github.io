const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function loadTs(relative, exportName) {
  const {outputText} = ts.transpileModule(
    fs.readFileSync(path.join(root, relative), 'utf8'),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
  );
  const module = {};
  new Function('exports', 'require', 'module', outputText)(module, require, {exports: module});
  return module[exportName];
}
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const accessPolicy = read('src/telemark/accessPolicy.ts');
const navigator = read('static/simulator/navigator.html');
const docItem = read('src/theme/DocItem/index.tsx');
const rootTheme = read('src/theme/Root.tsx');
const navbarItem = read('src/theme/NavbarItem/DefaultNavbarItem/index.tsx');
const homepage = read('src/pages/index.tsx');
const homepageCss = read('src/pages/index.module.css');
const searchPlugin = read('plugins/telemark-search/index.js');
const deployedSmoke = read('scripts/smoke-deployed.cjs');
const config = read('docusaurus.config.ts');
const customCss = read('src/css/custom.css');
const mechanicalData = read('src/telemark/mechanical.ts');
const tracks = read('src/telemark/tracks.ts');
const trackOverview = read('src/components/TrackOverview.tsx');
const trackOverviewCss = read('src/components/TrackOverview.module.css');
const unitOverview = read('src/components/UnitOverview.tsx');
const unitOverviewCss = read('src/components/UnitOverview.module.css');
const useProgress = read('src/telemark/useProgress.ts');
const progressStore = read('src/telemark/progressStore.ts');
const progressCloud = read('src/telemark/progressCloud.ts');
const dashboard = read('src/pages/dashboard.tsx');
const dashboardCss = read('src/pages/dashboard.module.css');
const loginCss = read('src/pages/login.module.css');
const markCompleteCss = read('src/components/HomepageFeatures/MarkComplete.module.css');
const simulatorFrame = read('src/components/SimulatorFrame.tsx');
assert.match(simulatorFrame, /event\.key === PROGRESS_STORAGE_KEY/, 'simulator frames must ignore code-library storage changes');
assert.match(simulatorFrame, /telemark:simulator-fullscreen-state/, 'simulators must receive host fullscreen state');
assert.match(customCss, /simulator-fullscreen-shell:fullscreen \.simulator-wrapper\s*\{[\s\S]*height:\s*calc\(100vh - 4rem\)/);
assert.match(customCss, /simulator-fullscreen-shell:fullscreen \.telemark-simulator\s*\{[\s\S]*height:\s*100%[\s\S]*max-height:\s*none/);
const authenticatedNavigator = read('src/components/AuthenticatedSimulatorNavigator.tsx');
const askPanel = read('src/components/ui/AskPanel.tsx');
const adminPage = read('src/pages/admin.tsx');
const masterySimulator = read('src/components/MasterySimulator.tsx');
const masteryChallengeRuntime = read('static/simulator/mastery_challenge.js');
const masteryMotionRuntime = read('static/simulator/mastery_motion.js');
const curriculum = read('src/telemark/curriculum.ts');

assert.match(
  customCss,
  /\.footer--dark\s*\{[\s\S]*--ifm-footer-title-color:\s*var\(--tm-text-strong\)/,
  'the footer title must follow the active Telemark theme',
);
assert.match(
  customCss,
  /\.footer--dark\s*\{[\s\S]*--ifm-footer-link-color:\s*var\(--tm-text-soft\)/,
  'footer links must remain legible in light mode',
);

const heroVideo = homepage.match(/<video\b[\s\S]*?<\/video>/)?.[0] ?? '';
assert.ok(
  fs.existsSync(path.join(root, 'static/video/telemark-hero.mp4')),
  'homepage hero video must live in the static video directory',
);
assert.ok(
  fs.existsSync(path.join(root, 'static/video/telemark-hero-light.mp4')),
  'homepage light-mode hero video must live in the static video directory',
);
assert.match(heroVideo, /\bautoPlay\b/, 'the hero preview starts automatically');
assert.match(heroVideo, /\bmuted\b/, 'homepage hero video must default to muted');
assert.match(heroVideo, /\bloop\b/, 'the hero preview loops automatically');
assert.match(heroVideo, /\bplaysInline\b/, 'homepage hero video must play inline on mobile');
assert.match(heroVideo, /preload="auto"/, 'the autoplaying hero video must begin loading immediately');
assert.doesNotMatch(heroVideo, /\scontrols(?:=|\s|>)/, 'the hero preview hides native playback controls');
assert.match(homepage, /useBaseUrl\('\/video\/telemark-hero\.mp4'\)/);
assert.match(homepage, /useBaseUrl\('\/video\/telemark-hero-light\.mp4'\)/);
assert.match(homepage, /colorMode === 'light' \? lightSrc : darkSrc/);
assert.match(heroVideo, /ref=\{videoRef\}/, 'the theme switch must retain one video element');
assert.match(heroVideo, /src=\{initialSrcRef\.current\}/, 'React must not replace the video before its timestamp is captured');
assert.match(homepage, /playbackTimeRef\.current = currentPosition/, 'theme changes must snapshot the current timestamp');
assert.match(homepage, /video\.addEventListener\('seeked', finishSwitch/, 'theme changes must restore the timestamp before resuming');
assert.match(homepage, /video\.addEventListener\('canplay', restorePlayback/, 'playback resumes only after the replacement video is ready');
assert.match(homepage, /snapshot\.wasPlaying[\s\S]*video\.play\(\)/, 'a playing reel must keep playing after a theme change');
assert.match(homepage, /\|\| video\.autoplay/, 'initial theme resolution must preserve intended autoplay');
assert.match(heroVideo, /poster=\{poster\}/, 'the paused reel has a theme-aware poster');
assert.doesNotMatch(homepage, /CountUp|SpotlightCard|<Masonry|<WhatsNew/, 'the homepage avoids decorative animations and automatic overlays');
assert.ok(homepage.includes('<HeroSection'), 'the homepage must retain its primary hero');
for (const section of ['StatsBar', 'CurriculumSection', 'SimulatorSection', 'ToolsSection', 'ShowcaseSection', 'CtaSection']) {
  assert.ok(!homepage.includes(`<${section}`), `${section} must be removed from the reduced homepage`);
}
assert.match(homepage, /Learn through experience with integrated lessons featuring software and mechanical simulators\./);
assert.doesNotMatch(homepage, /Student-built FTC software and mechanical curriculum|Learn to program an FTC robot/);

for (let unit = 2; unit <= 15; unit += 1) {
  const simulatorComponent = read(`src/components/Unit${unit}Simulator.tsx`);
  assert.match(
    simulatorComponent,
    /<SimulatorFrame\b/,
    `Unit ${unit} must use the shared fullscreen simulator frame`,
  );
  const masteryLesson = read(
    fs.readdirSync(path.join(root, `docs/unit-${String(unit).padStart(2, '0')}`))
      .map((name) => `docs/unit-${String(unit).padStart(2, '0')}/${name}`)
      .find((name) => name.endsWith('mastery-coding-challenge.mdx')),
  );
  assert.match(masteryLesson, new RegExp(`<MasterySimulator unit=\\{${unit}\\}(?: project)? />`));
  assert.match(read(`static/simulator/unit${unit}.mastery.html`), /mastery_motion\.js/);
  assert.ok(
    masteryLesson.includes(`completesUnit="unit-${String(unit).padStart(2, '0')}"`),
    `Unit ${unit} coding challenge must record full-unit mastery`,
  );
  const expectedNext = unit === 15
    ? '/dashboard'
    : `/docs/unit-${String(unit + 1).padStart(2, '0')}`;
  assert.ok(
    masteryLesson.includes(`nextUnit="${expectedNext}"`),
    `Unit ${unit} coding challenge must proceed directly to ${expectedNext}`,
  );

  const lessonFiles = fs.readdirSync(path.join(root, `docs/unit-${String(unit).padStart(2, '0')}`));
  for (const lessonFile of lessonFiles.filter((name) => name.endsWith('.mdx') && !name.includes('mastery-coding-challenge'))) {
    const lessonSource = read(`docs/unit-${String(unit).padStart(2, '0')}/${lessonFile}`);
    assert.doesNotMatch(
      lessonSource,
      /^(?:title|sidebar_label):.*Challenge:/m,
      `${lessonFile} is a lesson and must not be presented as a second challenge`,
    );
  }
}
assert.match(masterySimulator, /<SimulatorFrame\b/);
assert.match(masterySimulator, /unit\$\{unit\}\.mastery\.html/);
assert.match(masterySimulator, /FTC SDK imports, correct OpMode annotation, and an empty class shell/);
assert.match(masteryChallengeRuntime, /setCode\(activeScaffold \? activeScaffold\.source : config\.starter\)/, 'coding challenges must load the active cumulative-project scaffold');
assert.match(masteryChallengeRuntime, /setTelemetryStudentOnly\(true\)/);
assert.match(masteryChallengeRuntime, /return transpileAndRun\(/, 'coding challenges must execute student telemetry');
assert.doesNotMatch(masteryChallengeRuntime, /addTelemetry\("(?:Unit|Compiler|Objectives|Lifecycle|Driver test|Ready)"/);
assert.match(masteryChallengeRuntime, /createChallengeRobot\(unit, challengeMotion\)/);
const robotProfileSource = masteryChallengeRuntime.match(
  /const ROBOT_PROFILES = Object\.freeze\(\{([\s\S]*?)\n  \}\);/,
)?.[1] || '';
assert.equal(
  (robotProfileSource.match(/^\s+\d+:\s*\{/gm) || []).length,
  14,
  'every Unit 2-15 challenge needs a distinct robot profile',
);

{
  const challengeWindow = {};
  const challengeDocument = {currentScript: {dataset: {unit: '0'}}};
  new Function('window', 'document', masteryChallengeRuntime)(challengeWindow, challengeDocument);
  const challengeApi = challengeWindow.TelemarkMasteryChallenge;
  const unit4DeadzoneCheck = challengeApi.configs[4].checks.find((criterion) =>
    criterion.label.toLowerCase().includes('deadzone'),
  );
  assert.ok(unit4DeadzoneCheck, 'Unit 4 challenge needs a deadzone check');
  assert.ok(
    unit4DeadzoneCheck.structural.patterns.every((pattern) =>
      pattern.test('if (Math.abs(forward) < DEADZONE) forward = 0;'),
    ),
    'Unit 4 deadzone check should accept the named constant taught by the lesson',
  );
  assert.equal(Object.keys(challengeApi.configs).length, 14);
  assert.equal(Object.keys(challengeApi.robotProfiles).length, 14);
  assert.equal(
    new Set(Object.values(challengeApi.robotProfiles).map((profile) => profile.name)).size,
    14,
    'challenge robot profiles must be distinct',
  );
  for (let unit = 2; unit <= 15; unit += 1) {
    const config = challengeApi.configs[unit];
    const project = challengeApi.decodeProjectOptions(unit, config);
    const active = project.initialFiles.find((file) => file.name === config.activeFile);
    assert.ok(active, `Unit ${unit} must open a real cumulative-project file`);
    assert.doesNotMatch(active.name, /Unit\d+Mastery/);
    assert.equal(project.preferredEntry.endsWith(unit === 15 ? '.FullAutonomous' : '.CompetitionTeleOp'), true);
    assert.equal(
      challengeApi.checksForUnit(unit).length,
      challengeApi.configs[unit].checks.length + (config.registration ? 1 : 0),
      `Unit ${unit} must assess every stage objective and any required registration`,
    );
    assert.ok(challengeApi.checksForUnit(unit).length >= 4, `Unit ${unit} needs substantive checks`);
  }
}
assert.match(masteryChallengeRuntime, /challengeMotion\.connectHardwareMap\(global\.hardwareMap\)/);
assert.match(masteryChallengeRuntime, /motion\.step\(dt\)/);
assert.match(masteryMotionRuntime, /function integrateDrive\(dt, mecanum\)/);
assert.match(masteryMotionRuntime, /integrateDrive\(dt, unit >= 8\)/);
assert.match(masteryMotionRuntime, /setServoPosition/);
assert.match(masteryMotionRuntime, /startFollower/);

assert.match(accessPolicy, /return false;/);
assert.match(accessPolicy, /export function isProtectedLessonPath/);
assert.doesNotMatch(docItem, /ContentLock|isProtectedLessonPath/);
assert.doesNotMatch(rootTheme, /ContentLock|isProtectedLessonPath|useAuth/);
assert.match(docItem, /trackEvent\('curriculum_start'/);
assert.match(navbarItem, /to: user \? '\/dashboard' : '\/login'/);
assert.match(navbarItem, /label: user \? 'Dashboard' : 'Sign in'/);
assert.doesNotMatch(homepage, /useState<string>\(isNumeric \? '0'/);
assert.doesNotMatch(homepage, /CURRICULUM_UNIT_COUNT|CURRICULUM_LESSON_COUNT|TOTAL_LESSON_COUNT|TOTAL_UNIT_COUNT/);
assert.doesNotMatch(homepage, /Lessons require account|isProtectedUnit/);
assert.doesNotMatch(searchPlugin, /isProtected|protected:/);
assert.match(searchPlugin, /excerpt: cleanExcerpt\(source\)/);
assert.match(searchPlugin, /actions\.setGlobalData\(content\)/);
assert.match(deployedSmoke, /deployedMeta\.commit !== expectedCommit/);
assert.match(deployedSmoke, /cacheKey = `\$\{expectedCommit \|\| Date\.now\(\)\}-\$\{attempt\}`/);
assert.match(config, /title: 'Telemark'/);
assert.match(config, /label: 'GitHub'/);
assert.match(config, /favicon: 'img\/telemark\.png'/, 'the existing web icon must remain the favicon');
assert.match(config, /src: 'img\/telemark_logo\.png'/, 'the transparent logo must be used in the navbar');
assert.match(config, /to: '\/docs\/unit-00\/classes-and-objects'[\s\S]{0,80}label: 'Software'/);
assert.match(config, /to: '\/mechanical\/module-00\/design-cycle'[\s\S]{0,80}label: 'Mechanical'/);
assert.match(config, /theme: prismThemes\.github/);
assert.match(config, /darkTheme: prismThemes\.dracula/);
assert.match(
  config,
  /© 2026 Telemark\. Built with Docusaurus\. Not affiliated with FIRST®/,
);
assert.doesNotMatch(config, /Built by FTC Team 30450/);
assert.match(customCss, /\.telemark-navbar-center[\s\S]*left: 50%/);
assert.equal((curriculum.match(/id: 'unit-\d{2}\/mastery-coding-challenge'/g) || []).length, 14);
assert.equal((curriculum.match(/id: 'unit-\d{2}\/mastery-quiz'/g) || []).length, 0);
assert.match(customCss, /\.footer[\s\S]*padding: 0\.85rem 1\.5rem/);

// Light mode must use the same shared surfaces and readable action colours on
// the exact pages that previously retained hard-coded dark styling.
assert.doesNotMatch(unitOverviewCss.match(/\.hero\s*\{([^}]+)\}/)?.[1] || '', /background:|box-shadow:|border:/, 'unit introductions use the surrounding document surface');
assert.match(unitOverviewCss, /\.lessonLabel[\s\S]{0,120}color: var\(--tm-text-strong\)/, 'lesson links retain theme-aware text');
assert.match(markCompleteCss, /\.unmarkBtn[\s\S]{0,180}border-radius: var\(--tm-r-pill\)/);
assert.match(dashboardCss, /\.resumeBtn[\s\S]{0,260}color: var\(--tm-text-on-accent\) !important/);
assert.match(loginCss, /\[data-theme='light'\] \.card\s*\{\s*background: #fff/);
assert.match(loginCss, /\.googleBtn[\s\S]{0,300}background: #fff;[\s\S]{0,80}color: #111820/);
assert.match(loginCss, /\[data-theme='light'\] \.privacy\s*\{\s*color: #111820/);

for (const frameSource of [simulatorFrame, authenticatedNavigator]) {
  assert.match(frameSource, /useColorMode/);
  assert.match(frameSource, /telemark:simulator-theme-state/);
  assert.match(frameSource, /contentWindow\?\.postMessage|contentWindow\.postMessage/);
}

// Curriculum and simulator access stay public. Authentication is reserved for
// Sharp AI and the private admin report.
{
  const policy = loadTs('src/telemark/accessPolicy.ts', 'isProtectedUnit');
  const protectedLesson = loadTs('src/telemark/accessPolicy.ts', 'isProtectedLessonPath');
  const unitSlug = loadTs('src/telemark/accessPolicy.ts', 'getUnitSlug');
  for (let unit = 0; unit <= 15; unit += 1) {
    assert.equal(policy(unit), false, `unit ${unit} should be open`);
  }
  assert.equal(protectedLesson('/docs/unit-05/if-statements'), false);
  assert.equal(protectedLesson('/mechanical/module-12/hole-standards'), false);
  assert.equal(protectedLesson('/docs/official-docs'), false);
  assert.equal(unitSlug('/docs/unit-5/if-statements'), 'unit-05');
  assert.equal(unitSlug('/mechanical/module-12/hole-standards'), 'module-12');
}

assert.match(navigator, /All simulator units open/);
assert.doesNotMatch(navigator, /Google sign-in required|Sign in to unlock|AUTH_REQUEST/);
assert.doesNotMatch(authenticatedNavigator, /signInWithGoogle|useAuth|simulator_gate_request/);
assert.match(askPanel, /if \(!user\)/, 'Sharp AI must keep its account boundary');
assert.match(askPanel, /Sign in to ask/);
assert.match(askPanel, /user\.getIdToken\(\)/);
assert.match(adminPage, /if \(!user\)/, 'admin analytics must remain private');
assert.match(adminPage, /configuredAdmin/);
assert.match(adminPage, /Administrator access has not been configured/);

// Guests receive the same progress controls as signed-in users. Local work is
// merged into Firestore when a Google sign-in later occurs.
assert.match(progressStore, /PROGRESS_STORAGE_KEY = 'telemark:progress:v1'/);
assert.match(progressStore, /export function parseProgressExport/);
assert.match(progressStore, /export function mergeProgress/);
assert.match(progressCloud, /syncLocalProgressWithUser/);
assert.match(progressCloud, /mergeProgress\(cloud, local\)/);
assert.match(useProgress, /writeLocalProgress\(nextValue\)/);
assert.match(useProgress, /mergeImportedProgress/);
assert.match(dashboard, /serializeProgress\(progress\)/);
assert.match(dashboard, /parseProgressExport/);
assert.doesNotMatch(dashboard, /history\.push\(basePath\('\/login'\)\)/);

// ── Mechanical track ──────────────────────────────────────────────────────
// The mechanical track reuses the software track's components, so these
// assertions guard the shared surfaces against being narrowed back to one
// track.

assert.match(config, /id: 'mechanical'/, 'engineering docs plugin instance missing');
assert.match(config, /routeBasePath: 'mechanical'/);
assert.match(config, /to: '\/mechanical\/module-00\/design-cycle'/, 'navbar must start the mechanical track');
assert.match(mechanicalData, /MECHANICAL_UNITS/);
assert.match(mechanicalData, /MECHANICAL_LESSONS/);

// Shared lookups must be track-aware, not curriculum-only.
assert.match(tracks, /trackForUnitSlug/);
assert.match(tracks, /unitSlug\.startsWith\('module-'\)/);
assert.match(unitOverview, /getAnyUnitBySlug/, 'UnitOverview must resolve units in either track');
assert.match(unitOverview, /getAnyLessonsForUnit/);
assert.match(useProgress, /getAnyLessonsForUnit/, 'progress must complete units in either track');
// Path handling remains track-aware even though both tracks are open.
assert.match(accessPolicy, /\(blocks-unit\|fll-unit\|unit\|module\)-/);
assert.match(accessPolicy, /export function getUnitSlug/);
assert.match(docItem, /getUnitSlug/);

// Search indexes both tracks.
assert.match(searchPlugin, /routeBase: '\/mechanical'/);
assert.match(searchPlugin, /routeBase: '\/blocks'/);
assert.match(searchPlugin, /\(\?:blocks-unit\|fll-unit\|unit\|module\)-/);

// Discovery surfaces.
// Asserted as reachability rather than by component name: what matters is that
// a visitor can get into either track from the homepage, not which component
// happens to render the link this month.
assert.ok(
  homepage.includes('/docs/unit-00/classes-and-objects')
    && homepage.includes('/mechanical/module-00/design-cycle'),
  'the reduced homepage must link into both main tracks',
);
assert.match(homepage, /Begin Software/);
assert.match(homepage, /Begin Mechanical/);
assert.match(trackOverview, /companionTrackId/);
assert.match(dashboard, /activeTrack/, 'dashboard must switch between tracks');
assert.doesNotMatch(trackOverview, /signInWithGoogle/, 'track cards should open public overviews, not sign in');
assert.doesNotMatch(homepage, /homepage_\$\{id\}_card/, 'homepage unit cards should not trigger sign in');
assert.match(trackOverview, /MOBILE_UNIT_PREVIEW_COUNT/);
assert.match(trackOverviewCss, /\.mobileCurriculumExtra\s*\{\s*display: none !important/);

console.log('Open access, local progress, navbar, search, simulators, and track regression checks passed');

// ── Programmatic navigation must respect the base URL ───────────────────────

// history.push takes its argument literally, so a raw app path sends the
// browser to example.com/docs while the site lives at example.com/telemark/.
// Hardcoding the prefix is the same bug mirrored: correct in production, broken
// locally. Both forms shipped at once and made every quick-search result 404.
{
  const collect = (dir) =>
    fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? collect(full) : [full];
    });
  const sources = collect(path.join(root, 'src')).filter(
    (file) => file.endsWith('.tsx') || file.endsWith('.ts'),
  );
  const offenders = [];
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/history\.(?:push|replace)\(\s*([^\n)]*)/g)) {
      const argument = match[1].trim();
      if (argument.startsWith('basePath(')) continue;
      offenders.push(`${path.relative(root, file)}: history.push(${argument})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `programmatic navigation must go through basePath():\n  ${offenders.join('\n  ')}`,
  );
}
