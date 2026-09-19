import type {CurriculumLesson, CurriculumUnit, Tier} from './curriculum';

/**
 * Engineering track data.
 *
 * The engineering track mirrors the software curriculum's shape so that the
 * shared UnitOverview, MarkComplete, progress, and dashboard surfaces work for
 * both tracks without branching. Software units live at /docs/unit-NN and
 * engineering modules live at /mechanical/module-NN.
 */

export const MECHANICAL_ROUTE_BASE = '/mechanical';

interface LessonSeed {
  /** URL segment and doc id, for example 'design-cycle'. */
  slug: string;
  /** Short sidebar-style label, for example 'Design Cycle'. */
  label: string;
  /** Full lesson title shown in roadmaps and search. */
  title: string;
}

interface ModuleSeed {
  /** Zero-padded module number, for example '00'. */
  number: string;
  title: string;
  desc: string;
  tier: Tier;
  overview: string;
  outcomes: string[];
  lessons: LessonSeed[];
}

const MODULE_SEEDS: ModuleSeed[] = [
  {
    number: '00',
    title: 'Engineering Design Process',
    desc: 'Turn a game manual into requirements, constraints, and concepts before anyone cuts metal.',
    tier: 'Beginner',
    overview:
      'Read the game manual for scoring opportunities and constraints, turn the strategy into testable requirements, and generate several concepts before you build.',
    outcomes: [
      'Describe the engineering design cycle and explain why it loops instead of ending.',
      'Pull scoring actions, cycle times, and penalties out of a game manual and restate them as robot requirements.',
      'Separate a hard constraint you cannot negotiate from a preference your team chose.',
      'Generate several distinct concepts before committing to one, and record why the others were set aside.',
    ],
    lessons: [
      {slug: 'design-cycle', label: 'Design Cycle', title: 'Lesson 0.1: The Engineering Design Cycle and Why It Loops'},
      {slug: 'reading-the-game', label: 'Reading the Game', title: 'Lesson 0.2: Reading a Game Manual Like an Engineer'},
      {slug: 'requirements-and-constraints', label: 'Requirements', title: 'Lesson 0.3: Writing Requirements and Separating Them From Constraints'},
      {slug: 'concept-generation', label: 'Concept Generation', title: 'Lesson 0.4: Generating and Narrowing Robot Concepts'},
    ],
  },
  {
    number: '01',
    title: 'The Engineering Notebook',
    desc: 'Document design decisions so judges, and your own team next month, can follow the reasoning.',
    tier: 'Beginner',
    overview:
      'Document decisions, sketches, tests, failures, and revisions as the work happens. Your team can recover the reasoning later, and judges can follow the same record when evaluating Design and Think awards.',
    outcomes: [
      'Explain what judges actually look for in an engineering notebook.',
      'Write a dated entry that captures the problem, what was tried, the result, and the next step.',
      'Sketch and annotate a mechanism so a teammate can build from the page.',
      'Score competing designs with a weighted decision matrix instead of arguing from opinion.',
    ],
    lessons: [
      {slug: 'notebook-purpose', label: 'Notebook Purpose', title: 'Lesson 1.1: What the Engineering Notebook Is Actually For'},
      {slug: 'daily-entries', label: 'Daily Entries', title: 'Lesson 1.2: Writing Entries That Capture Real Engineering Work'},
      {slug: 'sketching-and-annotation', label: 'Sketching', title: 'Lesson 1.3: Sketching and Annotating Mechanisms by Hand'},
      {slug: 'decision-matrices', label: 'Decision Matrices', title: 'Lesson 1.4: Choosing Between Designs With a Weighted Decision Matrix'},
    ],
  },
  {
    number: '02',
    title: 'Shop Safety, Tools, and Measurement',
    desc: 'Work safely and measure accurately before touching the robot.',
    tier: 'Beginner',
    overview:
      'Work safely, choose a measuring tool that matches the required tolerance, and practice the cutting, drilling, and threading operations used on an FTC robot.',
    outcomes: [
      'Follow shop safety rules and identify the required protective equipment for each operation.',
      'Read a caliper to a thousandth of an inch and choose the right tool for a given measurement.',
      'Cut and drill aluminum and polycarbonate without damaging the material or the tool.',
      'Tap a hole to the correct size and understand why tap drill size matters.',
    ],
    lessons: [
      {slug: 'shop-safety', label: 'Shop Safety', title: 'Lesson 2.1: Shop Safety, Protective Equipment, and Working Rules'},
      {slug: 'measuring-tools', label: 'Measuring Tools', title: 'Lesson 2.2: Calipers, Rules, and Squares, and How to Read Them'},
      {slug: 'cutting-and-drilling', label: 'Cutting & Drilling', title: 'Lesson 2.3: Cutting and Drilling Aluminum and Polycarbonate'},
      {slug: 'tapping-and-threads', label: 'Tapping', title: 'Lesson 2.4: Tapping Holes and Choosing the Correct Tap Drill'},
    ],
  },
  {
    number: '03',
    title: 'Materials and Structure',
    desc: 'Choose materials and build frames that stay stiff without wasting weight.',
    tier: 'Beginner',
    overview:
      'A robot frame has one job: hold every mechanism in the right place while absorbing impacts from other robots. This module covers the materials FTC teams actually use and the structural ideas that keep a frame from flexing.',
    outcomes: [
      'Compare aluminum, steel, polycarbonate, and printed plastics by stiffness, weight, and workability.',
      'Work inside a commercial build system without fighting its hole pattern.',
      'Explain why a deep beam resists bending far better than a thick one, and use triangulation deliberately.',
      'Hold the robot to a weight budget by tracking subsystem mass as you design.',
    ],
    lessons: [
      {slug: 'material-selection', label: 'Material Selection', title: 'Lesson 3.1: Selecting Materials for FTC Structures'},
      {slug: 'extrusion-systems', label: 'Build Systems', title: 'Lesson 3.2: Working Inside goBILDA, REV, and Tetrix Build Systems'},
      {slug: 'stiffness-and-deflection', label: 'Stiffness', title: 'Lesson 3.3: Stiffness, Deflection, and Why Beam Depth Wins'},
      {slug: 'weight-budget', label: 'Weight Budget', title: 'Lesson 3.4: Holding the Robot to a Weight Budget'},
    ],
  },
  {
    number: '04',
    title: 'Fasteners, Bearings, and Shafts',
    desc: 'Assemble joints that survive a full season of impacts and vibration.',
    tier: 'Intermediate',
    overview:
      'Loose fasteners, worn bearings, unsupported shafts, and incorrect spacer stacks can stop a subsystem without breaking a major part. Learn how to choose and assemble the hardware that keeps each joint aligned.',
    outcomes: [
      'Read a metric fastener callout and choose the correct length, head style, and drive.',
      'Prevent fasteners from backing out under vibration without making the robot impossible to service.',
      'Support a rotating shaft properly and recognize the failure modes of an unsupported one.',
      'Plan a spacer stack so a mechanism lands exactly where the design intended.',
    ],
    lessons: [
      {slug: 'screws-and-threads', label: 'Screws & Threads', title: 'Lesson 4.1: Metric Fasteners, Thread Callouts, and Hole Sizing'},
      {slug: 'thread-locking', label: 'Thread Locking', title: 'Lesson 4.2: Keeping Fasteners Tight Under Vibration'},
      {slug: 'bearings-and-shafts', label: 'Bearings & Shafts', title: 'Lesson 4.3: Supporting Rotating Shafts With Bearings'},
      {slug: 'spacers-and-stackups', label: 'Stack-Ups', title: 'Lesson 4.4: Planning Spacer Stack-Ups and Controlling Alignment'},
    ],
  },
  {
    number: '05',
    title: 'CAD With Onshape',
    desc: 'Design the robot in CAD so mistakes cost minutes instead of parts.',
    tier: 'Intermediate',
    overview:
      'Use CAD to find interference, check reach, and compare geometry before fabricating parts. The lessons use Onshape because it runs in a browser and offers an education plan for FTC teams.',
    outcomes: [
      'Explain what CAD catches that a sketch on paper cannot.',
      'Build fully defined sketches and turn them into parts with the core feature set.',
      'Choose the right solid feature for a shape instead of forcing everything through extrude.',
      'Drive a model from variables so one number changes the whole part.',
      'Work with imported, surface, and mesh geometry that has no feature history.',
      'Assemble parts with mates that move the way the real mechanism moves.',
      'Pull vendor parts into your design instead of modeling hardware from scratch.',
    ],
    lessons: [
      {slug: 'why-cad', label: 'Why CAD', title: 'Lesson 5.1: What CAD Catches Before the Robot Is Built'},
      {slug: 'sketches-and-constraints', label: 'Sketches', title: 'Lesson 5.2: Fully Defined Sketches and the Core Feature Set'},
      {slug: 'part-studios', label: 'Part Studios', title: 'Lesson 5.3: Part Studios, the Feature List, and Reference Geometry'},
      {slug: 'solid-features', label: 'Solid Features', title: 'Lesson 5.4: Extrude, Revolve, Sweep, and Loft'},
      {slug: 'modifying-solids', label: 'Modifying Solids', title: 'Lesson 5.5: Fillet, Chamfer, Shell, Draft, Rib, and Hole'},
      {slug: 'patterns-and-booleans', label: 'Patterns & Booleans', title: 'Lesson 5.6: Patterns, Booleans, Transform, and Mirror'},
      {slug: 'imported-and-surface-geometry', label: 'Imports & Surfaces', title: 'Lesson 5.7: Direct Editing, Imported Geometry, Surfaces, and Mesh'},
      {slug: 'variables-and-equations', label: 'Variables', title: 'Lesson 5.8: Variables, Expressions, and Equations'},
      {slug: 'assemblies-and-mates', label: 'Assemblies', title: 'Lesson 5.9: Assemblies, Mates, and Checking Range of Motion'},
      {slug: 'part-libraries', label: 'Part Libraries', title: 'Lesson 5.10: Using Vendor Part Libraries and Managing Versions'},
    ],
  },
  {
    number: '06',
    title: 'Power Transmission',
    desc: 'Get motor power to the mechanism at the speed and torque the design needs.',
    tier: 'Intermediate',
    overview:
      'A motor produces one speed and torque curve. Power transmission is how you trade one for the other until the mechanism does what the strategy requires. This is the most quantitative module in the track.',
    outcomes: [
      'Read a motor curve and find the operating point where a mechanism actually runs.',
      'Compute gear ratios across multiple stages and predict output speed and torque.',
      'Size chain and belt drives, including center distance and length.',
      'Account for efficiency losses and backlash instead of assuming ideal transmission.',
    ],
    lessons: [
      {slug: 'motor-curves', label: 'Motor Curves', title: 'Lesson 6.1: Reading Motor Curves, Free Speed, and Stall Torque'},
      {slug: 'gear-ratios', label: 'Gear Ratios', title: 'Lesson 6.2: Calculating Gear Ratios Across Multiple Stages'},
      {slug: 'chain-and-belt', label: 'Chain & Belt', title: 'Lesson 6.3: Sizing Chain and Timing Belt Drives'},
      {slug: 'efficiency-and-backlash', label: 'Efficiency', title: 'Lesson 6.4: Efficiency Losses, Backlash, and Real Transmission Behavior'},
    ],
  },
  {
    number: '07',
    title: 'Drivetrains',
    desc: 'Pick and size a drivetrain that matches your strategy instead of copying last season.',
    tier: 'Intermediate',
    overview:
      'The drivetrain decides whether your robot can get to the scoring position in time and hold it against defense. This module covers the common archetypes and the math that turns a motor choice into a real speed and pushing force.',
    outcomes: [
      'Compare tank, mecanum, and swerve drivetrains by capability, complexity, and failure mode.',
      'Select wheels and understand how the coefficient of friction limits pushing force.',
      'Compute free speed and pushing force for a proposed drivetrain and check it against the motor current limit.',
      'Mount odometry pods so the localization the programmers rely on actually works.',
    ],
    lessons: [
      {slug: 'drivetrain-archetypes', label: 'Archetypes', title: 'Lesson 7.1: Tank, Mecanum, and Swerve Drivetrain Trade-Offs'},
      {slug: 'wheels-and-traction', label: 'Wheels & Traction', title: 'Lesson 7.2: Wheel Selection, Traction, and Weight Transfer'},
      {slug: 'speed-and-pushing-force', label: 'Speed & Force', title: 'Lesson 7.3: Calculating Drivetrain Speed and Pushing Force'},
      {slug: 'odometry-pods', label: 'Odometry Pods', title: 'Lesson 7.4: Mounting Odometry Pods for Reliable Localization'},
    ],
  },
  {
    number: '08',
    title: 'Mechanisms',
    desc: 'Design the intakes, slides, and arms that actually score game elements.',
    tier: 'Advanced',
    overview:
      'Design intakes, linear slides, arms, and counterbalances around the game element and expected load. Check the numbers before choosing motors, reductions, and structural dimensions.',
    outcomes: [
      'Select an intake style that matches the game element and the approach geometry.',
      'Size a linear slide stage count, spool diameter, and motor for a required extension and speed.',
      'Compute the gravity torque on an arm at its worst-case angle and pick a reduction with real margin.',
      'Use springs, surgical tubing, or constant-force elements to unload a motor holding a static load.',
    ],
    lessons: [
      {slug: 'intakes', label: 'Intakes', title: 'Lesson 8.1: Intake Geometry, Compliance, and Element Handoff'},
      {slug: 'linear-slides', label: 'Linear Slides', title: 'Lesson 8.2: Sizing Linear Slides, Spools, and Extension Speed'},
      {slug: 'arms-and-pivots', label: 'Arms & Pivots', title: 'Lesson 8.3: Arm Gravity Torque and Choosing a Reduction'},
      {slug: 'counterbalance', label: 'Counterbalance', title: 'Lesson 8.4: Springs, Tubing, and Counterbalancing Static Loads'},
    ],
  },
  {
    number: '09',
    title: 'Electrical and Wiring',
    desc: 'Wire the control system so it passes inspection and survives the match.',
    tier: 'Intermediate',
    overview:
      'Build one shared map between the control system, physical wiring, and software configuration. Then size, route, label, and strain-relieve each wire for its current and motion.',
    outcomes: [
      'Lay out the FTC control system and explain what each port and cable does.',
      'Choose wire gauge for a given current and length, and estimate voltage drop.',
      'Route and strain relieve wiring so motion does not fatigue a connector.',
      'Pass electrical inspection on the first attempt by checking against the actual rules.',
    ],
    lessons: [
      {slug: 'control-system-layout', label: 'Control System', title: 'Lesson 9.1: The FTC Control System Layout and Port Map'},
      {slug: 'wire-gauge-and-current', label: 'Wire Gauge', title: 'Lesson 9.2: Wire Gauge, Current Capacity, and Voltage Drop'},
      {slug: 'routing-and-strain-relief', label: 'Routing', title: 'Lesson 9.3: Routing, Strain Relief, and Surviving Robot Motion'},
      {slug: 'inspection-legal-wiring', label: 'Legal Wiring', title: 'Lesson 9.4: Wiring That Passes Electrical Inspection'},
    ],
  },
  {
    number: '10',
    title: 'Prototyping, Testing, and Iteration',
    desc: 'Prove a mechanism works with data before committing it to the competition robot.',
    tier: 'Advanced',
    overview:
      'Prototype one question at a time, write the test conditions before running trials, and use the results to revise the design or investigate a failure.',
    outcomes: [
      'Build a rough prototype quickly to answer one specific question.',
      'Write a test plan with a measurable success criterion and run enough trials to trust it.',
      'Analyze a failure to its root cause instead of replacing the broken part and moving on.',
      'Run a design review that surfaces problems while they are still cheap to fix.',
    ],
    lessons: [
      {slug: 'rapid-prototyping', label: 'Prototyping', title: 'Lesson 10.1: Rapid Prototyping to Answer One Question at a Time'},
      {slug: 'test-plans', label: 'Test Plans', title: 'Lesson 10.2: Writing Test Plans and Collecting Reliability Data'},
      {slug: 'failure-analysis', label: 'Failure Analysis', title: 'Lesson 10.3: Root Cause Analysis of Mechanical Failures'},
      {slug: 'design-reviews', label: 'Design Reviews', title: 'Lesson 10.4: Running Design Reviews That Catch Real Problems'},
    ],
  },
  {
    number: '11',
    title: 'Fabrication and Competition Readiness',
    desc: 'Make parts that fit and bring a robot that passes inspection and survives the day.',
    tier: 'Advanced',
    overview:
      'The last module closes the loop from design to competition: holding tolerances, printing parts that fit, passing inspection, and keeping the robot running through a long tournament day.',
    outcomes: [
      'Choose a fit class for a shaft and hole and understand what tolerance the fit demands.',
      'Design printed parts that survive robot loads and fit their mating hardware.',
      'Walk the robot through the inspection checklist before an inspector does.',
      'Run a pit that can diagnose and repair the robot between matches.',
    ],
    lessons: [
      {slug: 'tolerances-and-fits', label: 'Tolerances & Fits', title: 'Lesson 11.1: Tolerances, Clearance Fits, and Press Fits'},
      {slug: 'printed-parts', label: 'Printed Parts', title: 'Lesson 11.2: Designing 3D Printed Parts That Survive FTC Loads'},
      {slug: 'inspection-checklist', label: 'Inspection', title: 'Lesson 11.3: Passing Robot Inspection on the First Attempt'},
      {slug: 'pit-and-match-day', label: 'Match Day', title: 'Lesson 11.4: Pit Organization and Match Day Maintenance'},
    ],
  },
  {
    number: '12',
    title: 'Shop Standards and Non-Negotiables',
    desc: 'Standardize recurring hole, joint, shaft, and design-margin decisions.',
    tier: 'Beginner',
    overview:
      'Use one documented set of standards for recurring design decisions. Post these values in the shop and apply them in CAD, fabrication, assembly, and inspection.',
    outcomes: [
      'Apply the standard hole clearances without re-deriving them, and know why 0.15 mm per side is the floor.',
      'Meet the minimum thread engagement, fastener count, and retention standard on every joint.',
      'Support every rotating assembly to the same standard, whatever the mechanism.',
      'Apply design margins for load, speed, weight, and battery condition before competition.',
    ],
    lessons: [
      {slug: 'hole-standards', label: 'Hole Standards', title: 'Lesson 12.1: Clearance, Tap Drills, and the 0.15 mm Rule'},
      {slug: 'joint-standards', label: 'Joint Standards', title: 'Lesson 12.2: Thread Engagement, Fastener Count, and Retention'},
      {slug: 'rotating-standards', label: 'Rotating Standards', title: 'Lesson 12.3: Standards for Anything That Spins'},
      {slug: 'margin-standards', label: 'Margin Standards', title: 'Lesson 12.4: The Design Margins That Survive a Tournament'},
    ],
  },
  {
    number: '13',
    title: 'Proven Mechanisms and Why They Work',
    desc: 'Study common FTC mechanisms and the physical problems each one solves.',
    tier: 'Advanced',
    overview:
      'Study compliant intakes, staged lifts, four-bar linkages, and drivetrains by function instead of copying a past robot. Use the underlying geometry and forces to decide whether an arrangement fits the current game.',
    outcomes: [
      'Explain why compliant intakes grip a range of objects that rigid grippers cannot.',
      'Choose between cascading and continuous lifts from the extension and load you need, not from what you saw last season.',
      'Use linkage geometry to hold an end effector level without a sensor or a second motor.',
      'Read a drivetrain choice in terms of traction, weight transfer, and the odometry it makes possible.',
    ],
    lessons: [
      {slug: 'compliance', label: 'Compliant Intakes', title: 'Lesson 13.1: Why Compliant Intakes Beat Precise Ones'},
      {slug: 'lifts', label: 'Lift Architectures', title: 'Lesson 13.2: Cascading, Continuous, and the Rigging That Decides'},
      {slug: 'linkages', label: 'Linkage Geometry', title: 'Lesson 13.3: Four-Bars, Virtual Four-Bars, and Keeping Things Level'},
      {slug: 'drivetrains', label: 'Drivetrain Theory', title: 'Lesson 13.4: Traction, Weight Transfer, and Dead Wheels'},
    ],
  },
];

function modulePath(number: string, lessonSlug?: string): string {
  const base = `${MECHANICAL_ROUTE_BASE}/module-${number}`;
  return lessonSlug ? `${base}/${lessonSlug}` : base;
}

export const MECHANICAL_UNITS: CurriculumUnit[] = MODULE_SEEDS.map(
  (seed, index): CurriculumUnit => {
    const next = MODULE_SEEDS[index + 1];
    return {
      id: `MODULE_${seed.number}`,
      label: `Module ${Number.parseInt(seed.number, 10)}`,
      title: seed.title,
      desc: seed.desc,
      tier: seed.tier,
      slug: `module-${seed.number}`,
      overviewPath: modulePath(seed.number),
      startPath: modulePath(seed.number, seed.lessons[0].slug),
      nextPath: next ? modulePath(next.number) : MECHANICAL_ROUTE_BASE,
      nextLabel: next
        ? `Module ${Number.parseInt(next.number, 10)}: ${next.title}`
        : 'Engineering Track Overview',
      lessonCount: seed.lessons.length + 1,
      overview: seed.overview,
      outcomes: seed.outcomes,
    };
  },
);

export const MECHANICAL_LESSONS: CurriculumLesson[] = MODULE_SEEDS.flatMap(
  (seed) => {
    const moduleNumber = Number.parseInt(seed.number, 10);
    const unitSlug = `module-${seed.number}`;
    const unitLabel = `Module ${moduleNumber}`;

    const lessons: CurriculumLesson[] = seed.lessons.map((lesson, lessonIndex) => ({
      id: `${unitSlug}/${lesson.slug}`,
      label: `${moduleNumber}.${lessonIndex + 1} · ${lesson.label}`,
      title: lesson.title,
      path: modulePath(seed.number, lesson.slug),
      unitSlug,
      unitLabel,
      unitTitle: seed.title,
    }));

    lessons.push({
      id: `${unitSlug}/mastery-quiz`,
      label: `${unitLabel} · Mastery Quiz`,
      title: `${unitLabel} Mastery Quiz: ${seed.title}`,
      path: modulePath(seed.number, 'mastery-quiz'),
      unitSlug,
      unitLabel,
      unitTitle: seed.title,
    });

    return lessons;
  },
);

export const MECHANICAL_UNIT_COUNT = MECHANICAL_UNITS.length;
export const MECHANICAL_LESSON_COUNT = MECHANICAL_LESSONS.length;

export function getMechanicalUnitBySlug(
  unitSlug: string,
): CurriculumUnit | undefined {
  return MECHANICAL_UNITS.find((unit) => unit.slug === unitSlug);
}

export function getMechanicalLessonsForUnit(
  unitSlug: string,
): CurriculumLesson[] {
  return MECHANICAL_LESSONS.filter((lesson) => lesson.unitSlug === unitSlug);
}
