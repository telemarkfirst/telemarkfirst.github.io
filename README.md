# Telemark

Telemark is a Docusaurus-based FTC curriculum with two parallel tracks:

- **Software** (`docs/`, served at `/docs`): 16 units and 118 lessons of FTC
  Java, from classes and OpModes through sensors, vision, and autonomous, with
  a browser simulator on most lessons.
- **Mechanical** (`mechanical/`, served at `/mechanical`): 12 modules and 60
  lessons covering the design process, the notebook, shop work, materials, CAD,
  power transmission, drivetrains, mechanisms, wiring, testing, and competition
  readiness, with 12 interactive design calculators.

Both tracks share the same unit and lesson shape, defined by `CurriculumUnit`
and `CurriculumLesson` in `src/telemark/curriculum.ts`. The software track's
data lives in that file; the mechanical track's lives in
`src/telemark/mechanical.ts`. Components that must work for both read through
`src/telemark/tracks.ts` rather than importing one track directly.

Both tracks, their simulators, and the design calculators are public. Progress
saves in the browser without an account and can be exported or imported from
the dashboard. Google sign-in is required only for Sharp AI and the private
analytics dashboard; when a learner signs in, browser progress is merged into
their existing Firestore progress.

### Java simulator projects

37 Java simulator pages share `static/simulator/telemark-project.js` and
`telemark-java.js`: Units 2–10, Lessons 12.2/12.4, and all unit mastery challenges.
The remaining 23 lesson pages have custom execution adapters and retain their
single-file editors until those adapters can execute complete projects.
Supported full-mode simulators use the project through
`TelemarkSimulatorBase.getCode()` and `compileStudentSource()`; older iterative
lessons can use `TelemarkProject.createRunner(editor, hardwareCallbacks)`.
`TelemarkJava.compileProject(files, runtime, {entry})` also accepts projects
directly. Each file is `{name, source}`; `entry` is a qualified OpMode class name.

Project linking preserves per-file package/import scope, same-package access,
public class filenames, explicit/wildcard imports, qualified references, and
classes with identical names in different packages. Helpers share class identity
and static state throughout one run. Concrete inheritance, constructors, arrays,
and helper method overloads distinguished by argument count or runtime type are
supported. Errors include a filename and line when available.

Typing, autocomplete, file switching, and draft saving only update the editor
view and browser storage. Compilation begins when the learner presses Init (or
Run on older one-button lessons), and behavioral requirement checks run after
Start/Run. Do not dispatch synthetic `input` events for project navigation;
those events are reserved for edits made by the learner.

This remains a Java-to-JavaScript teaching runtime, not a JVM or complete Java
type checker. SDK APIs depend on the lesson. Interfaces, records, nested classes,
generic collections, static imports, overloaded constructors, and ambiguous
numeric overloads report unsupported-feature errors. Java access modifiers and
compile-time overload resolution are not fully modeled. No Java service or
CheerpJ dependency is involved.

Projects and the completed-lesson library stay in browser storage, for guests
and signed-in learners alike. `SimulatorFrame` supplies lesson identity and
completion state; skipped and placement-completed lessons do not appear in the
library. Existing drafts enter the library when their lesson is opened. Local
`.java`/project JSON imports preview selected files and replace same-named files
while keeping the rest of the current project; project exports move code between
devices. The tab strip reveals create/import and per-file delete controls on
hover or keyboard focus, while Export remains visible. Shift+Delete removes a
focused file without confirmation. Files created or imported through this UI use
`package org.firstinspires.ftc.teamcode;`.

Run `npm run test:simulator` and `npm run test:simulator:audit` when changing this
layer. Unit 7 mastery and Units 8.1–8.5/9.1 use isolated hardware behavior checks
to accept working imported helpers and reject inactive or unsafe implementations.
Other lesson rubrics retain their existing lesson-specific checks.

The Unit 13 DECODE scene uses the uploaded full-field GLB through
`npm run prepare:decode-field`; preparation removes the external driver-station
tape while retaining the competition field. `npm run rig:decode-mechanisms`
partitions the imported DECODE intake into three independently pivoted stages
and rigs the anti-jam transfer spinner, flywheel, and servo trigger as stable
animation nodes. Neither command fabricates replacement robot mechanisms.

### Adding a mechanical module

1. Add a seed to `MODULE_SEEDS` in `src/telemark/mechanical.ts`.
2. Create `mechanical/module-NN/` with `_category_.json`, an overview that
   renders `<UnitOverview unitSlug="module-NN" />`, four lessons, and a mastery
   quiz.
3. Run `npm run test:mechanical`, which verifies the data model and the MDX
   files agree, and that every lesson records progress under the right id.

### Engineering calculators and visuals

The mechanical track uses calculators and diagrams the way the software track
uses simulators.

- **Math** lives in `src/telemark/mechanicalMath.ts` as pure functions with no
  React or DOM dependency. The calculator components collect numbers and render
  results; they contain no arithmetic of their own.
- **Tests** are in `scripts/mechanical-math.test.cjs`, which transpiles that
  module in memory and asserts against hand-checked reference values, known
  closed forms, and edge cases such as division by zero. Run with
  `npm run test:mechanical`.
- **Interactive visuals** in `src/components/mechanical/visuals/` are SVG
  figures driven by the same numbers the calculator displays, so the picture and
  the readout cannot disagree. Every calculator has one.
- **Static lesson diagrams** are in
  `src/components/mechanical/EngineeringDiagrams.tsx`.

### Cross-track links

The two tracks describe one robot, so lessons link to their counterpart: gear
ratios points at encoder tick conversion, odometry pod mounting points at path
following, and so on in both directions. `npm run test:mechanical` fails if
those links fall below the expected count, so they cannot silently rot.

### PDFs

```bash
npm run pdf:software
npm run pdf:mechanical
```

Both write a PDF to the repo root, which is gitignored. The script looks for
Chrome in the usual Linux and macOS locations; set `CHROME_PATH` to override.

`npm run check:content` fails if a calculator, visual, or diagram is not
reachable from a lesson, and if any figure is missing the `description` used as
its accessible label.

### Scored quizzes

Each module's mastery quiz ends with an auto-graded multiple choice section.
Questions live in `src/telemark/mechanicalQuizzes.ts`, keyed by module slug,
and are rendered by `ScoredQuiz`. Grading happens in the browser; passing offers
to record the lesson through the same progress store the rest of the site uses.
`npm run test:mechanical` validates every question: answer indices in range,
no duplicate options, and a real explanation on each.

### CAD practice

`mechanical/cad-practice.mdx` holds graded exercises with hard numbers and
self-check lists, rendered by `CadExercise`. Each exercise names the mistake it
is designed to provoke, so a student can tell whether they passed without a
mentor.

### Photographs

Lessons use `<LessonPhoto>`, which renders a labelled shot request until a real
photograph is supplied. Nothing is illustrated or generated: a real stripped
thread teaches faster than a drawing of one, so the slots describe exactly what
to shoot.

```bash
npm run photos:shotlist
```

regenerates `PHOTO-SHOTLIST.md` from those slots. To fill one, drop the file in
`static/img/mechanical/` and add `src` to the slot.

### Animation and interactivity

Animation is explanatory, never decorative: the arm sweeps through its range to
make the cosine relationship visible, the gear train turns at true relative
speeds, the slide extends so cascade multiplication can be watched rather than
read. Because it is explanatory it is also optional.

- `useAnimation.ts` provides `usePrefersReducedMotion()` and `useSweep()`.
  Nothing autoplays; the student presses play.
- Under `prefers-reduced-motion`, sweeps stop, `PlayControl` renders disabled
  with an explanation rather than vanishing, and declarative SVG animation is
  not rendered at all. CSS `animation-play-state` does not affect SMIL, so it
  is gated in JavaScript instead.
- `RangeField` pairs a slider with an exact number box, so dragging is
  available without losing precise entry.
- `Presets` load a configuration in one click, including ones that fail
  instructively: an under-geared drivetrain that stalls, an arm that cannot
  lift itself at horizontal, a cascading slide that is fast and too weak.

`npm run test:mechanical` asserts that every animated component honours
reduced motion, that sweep-driven motion has a play control, that every slider
has an exact number entry beside it, and that SMIL is guarded.

### Design system

All styling flows from tokens defined at the top of `src/css/custom.css`:
surfaces, ink, accent and its washes, semantic colours, borders, a type scale,
a 4px spacing scale, radii, elevation, and motion. Component stylesheets
reference tokens rather than repeating literals.

This exists because the site had drifted badly: 237 distinct colour literals
across 641 uses, 77 border-radius values, and 67 font sizes, all expressing a
handful of intentions in slightly different ways. After the migration:

| | Before | After |
| --- | --- | --- |
| Colour literals (uses) | 641 | 143 |
| Token references | 61 | 960 |
| Distinct border-radius values | 77 | 19 |
| Distinct font-size values | 67 | 26 |

`npm run test:design` enforces it: every required token must be defined, tokens
must outnumber literals, no single stylesheet may lean on more than 30
literals, the radius and font-size scales must stay small, reduced motion must
neutralise the duration tokens, and no stylesheet may write `-var(...)`, which
is invalid CSS that silently does nothing.

Two notes on intent. The slightly irregular corner radius
(`--tm-r-hand`) is deliberate, not a mistake, and there are two variants so
alternating cards do not look mechanically identical. And `custom.css` styles
the Docusaurus doc chrome directly, because lessons are where students spend
nearly all their time and should not look like a default theme inside a
themed shell.

### Design review

`PRODUCT.md` and `DESIGN.md` at the repo root hold the design context: users,
tone, anti-references, strategic principles, and the token system with the
reasoning behind the theme and colour strategy. They are the reference for any
future UI work.

A review against those rules found and fixed:

- **12 side-stripe borders.** A thick coloured accent on one arbitrary edge of
  a callout, card, or alert. All rewritten as a full border with a background
  tint, so the whole element is marked rather than one side of it.
- **The hero-metric bar.** Four big numbers with small labels is the SaaS
  template. The same facts now read as one sentence with the figures
  emphasised, which also stops them competing with the headline above.
- **An identical icon-card grid.** Four same-sized tiles of icon, heading, and
  text. Rewritten as a definition list whose rows differ in length, so it
  reads as prose about the product.
- **Accent-coloured custom scrollbars.** Restyling a standard affordance.
  Thinned and neutralised instead.
- **Em dashes in app copy.** The lesson rule already banned them; it now
  applies sitewide.

`npm run test:design` enforces all of it, across every stylesheet and
component.

### Site interactivity

`src/components/ui/` holds the sitewide interactive layer.

- **Command palette** (`CommandPalette.tsx`), opened with `Cmd/Ctrl+K` or `/`.
  It searches both tracks from any page, reusing the index the search plugin
  already builds rather than shipping a second one. Arrow keys move, Enter
  opens, Escape closes. It exists because 130 lessons across two sidebars meant
  finding one required knowing which track it lived in.
- **Reveal and count-up** (`useReveal.ts`), scroll-triggered entrance animation
  and animated statistics. The observer disconnects after firing, so nothing
  re-animates on every scroll past.

Two details worth keeping. `useCountUp` initialises to its target so server
rendered HTML carries the real figure: a visitor without JavaScript, and any
crawler, sees `157`, not `0`. And it skips the animation when the element was
already on screen at mount, since counting up then means visibly resetting a
number the reader has already seen.

Progress uses one normalized shape across local storage, portable JSON backups,
and Firestore. Imported and cloud records are merged so moving devices never
erases completion that exists in only one place.

### Keeping the two tracks consistent

The tracks teach different subjects, so their lesson content differs by design.
What must not differ is the furniture: a student moving between them should
meet the same landing page and the same navigation. Assessment matches the
kind of work each track teaches.

They had already drifted, and the fixes were:

- **One landing component.** The software landing was a bespoke page with its
  own 317 line stylesheet while the mechanical landing rendered
  `TrackOverview`. Both now render `TrackOverview`, including the same local
  progress indicators.
- **The same track-level pages.** Both tracks have `getting-started.mdx` and
  `learning-paths.mdx`.
- **Purpose-built assessment.** Software Units 2–15 end with one comprehensive
  coding challenge that supplies the FTC SDK imports, annotation, and empty
  class shell while leaving the implementation unscaffolded. Its checks cover the whole unit. The
  mechanical modules retain scored mastery quizzes because calculations and
  design judgment are better checked directly than through a Java simulator.

- **The same shell.** Both landings are docs index pages owning their track
  root (`/docs` and `/engineering`), so each opens with its own sidebar and
  identical chrome. `/curriculum` survives as a redirect for old links, and is
  public so old bookmarks keep working.
- **One navbar.** The homepage used to hand roll its own `<nav>`, so it had
  different chrome from every other page and the command palette was
  unreachable there. It now renders inside the shared `Layout`.

`npm run test:parity` enforces all of it, verifies all 14 software coding
challenges and 14 mechanical mastery quizzes, validates the mechanical question
bank, and fails if any page stops using the shared shell or grows its own navbar.

Legitimate differences remain: software lessons carry browser simulators and
mechanical lessons carry calculators, because a mechanism's behaviour is
decided by numbers you compute before cutting anything, while code is checked
by running it.

### Simulator theming

The 61 simulator pages under `static/simulator/` are iframes, so they cannot
inherit the site's design tokens through the cascade. `telemark-sim.css`
restates the tokens and maps them onto the variable names those pages already
use, and is linked after each page's inline `<style>` so it wins on equal
specificity. That themes all of them without rewriting any.

### Access and progress

The homepage, both curriculum tracks, full-text search, simulators, calculators,
and the progress dashboard are public. The dashboard reads the same browser
record as the lesson controls and offers **Export Progress** and **Import
Progress**. Clearing browser site data removes the local copy, so the exported
JSON file is the no-account recovery path.

Sharp AI still asks for Google sign-in because its question limit is enforced
per authenticated account. Signing in also merges the device record into
Firestore for automatic cross-device progress. `/admin` separately requires
the administrator account configured for that deployment.

### Tests

| Command | Covers |
| --- | --- |
| `npm run typecheck` | Types across the site |
| `npm run check:content` | Prose rules, and that every calculator, visual, diagram, quiz, and photo slot is reachable |
| `npm run test:site` | Open access, local progress import/export, design tokens, design rules, track parity, track data model, math assertions, component render smoke tests |
| `npm run test:simulator` | Software track simulator runtimes |
| `npm run functions:test` | Analytics backend. Requires `npm ci` inside `functions/` first, which is easy to miss: without it every import resolves to `any` and the type errors look like code faults |
| `npm run verify:build` | Built routes, homepage counts, and every internal cross-track link |

Run `verify:build` after `build`; it is the only check that sees the built
output, and it is what catches a doc whose `id` frontmatter silently moved its
route.

## Local development

```bash
npm ci
npm start
```

Production checks:

```bash
npm run typecheck
npm run build
npm run check:content
npm run test:site
npm run test:simulator
npm run functions:test
```

`test:site` runs the site regression checks and the mechanical track
consistency test. `check:content` enforces the prose rules for both tracks and
verifies every mechanical calculator is reachable from a lesson.

## Analytics administration

The private analytics dashboard is available at `/admin`. Both the browser and
callable backend read `TELEMARK_ADMIN_EMAIL`; leaving it unset disables admin
authorization. The dashboard reports GA4 estimated visitors, curriculum users,
engagement, verified Google accounts, and aggregate cloud-synced progress; it
never returns learner names, emails, or UIDs.

See [ANALYTICS_SETUP.md](./ANALYTICS_SETUP.md) for the required one-time Google
Analytics, Firebase, IAM, and GitHub Actions configuration.
