import type {CurriculumLesson, CurriculumUnit, Tier} from './curriculum';

interface BlocksUnitSeed {
  title: string;
  desc: string;
  overview: string;
  outcomes: string[];
  lessons: Array<{slug: string; title: string; challenge?: boolean}>;
}

const BLOCKS_UNIT_SEEDS: BlocksUnitSeed[] = [
  {
    title: 'How Programs Run',
    desc: 'Build, run, trace, and repair programs made from ordered commands.',
    overview: 'A program follows instructions in a specific order. You will learn how a run starts, how to follow each step, and how to find the first step that went wrong.',
    outcomes: [
      'Connect blocks into an ordered program and use Run, Step, Reset, and Stop.',
      'Explain how a start event begins a program and how execution moves between commands.',
      'Trace a short program and repair a command that is missing or out of order.',
    ],
    lessons: [
      {slug: 'workspace-and-run-controls', title: 'The Workspace and Run Controls'},
      {slug: 'commands-in-order', title: 'Commands Run in Order'},
      {slug: 'start-blocks-and-events', title: 'Start Blocks and Events'},
      {slug: 'step-through-and-debug', title: 'Step Through and Debug a Program'},
      {slug: 'route-runner-challenge', title: 'Coding Challenge: Route Runner', challenge: true},
    ],
  },
  {
    title: 'Values and Variables',
    desc: 'Store numbers, text, and true-or-false values, then use them in expressions.',
    overview: 'Programs work with information. You will choose a useful data type, save a value under a clear name, change it, and inspect the result while the program runs.',
    outcomes: [
      'Tell numbers, text, and Boolean values apart.',
      'Create, set, read, and change variables.',
      'Build expressions and trace how their results change.',
    ],
    lessons: [
      {slug: 'numbers-text-booleans', title: 'Numbers, Text, and True or False'},
      {slug: 'set-and-change-variables', title: 'Create, Set, and Change Variables'},
      {slug: 'math-and-text-expressions', title: 'Math and Text Expressions'},
      {slug: 'input-output-tracing', title: 'Inputs, Outputs, and Value Tracing'},
      {slug: 'score-tracker-challenge', title: 'Coding Challenge: Score Tracker', challenge: true},
    ],
  },
  {
    title: 'Decisions and Logic',
    desc: 'Compare values and choose exactly which part of a program should run.',
    overview: 'A condition is a question with a true-or-false result. You will use conditions to choose one path, handle several cases, and combine rules without making them unclear.',
    outcomes: [
      'Build comparisons that return true or false.',
      'Use if, else if, and else branches in a clear order.',
      'Combine conditions with and, or, and not.',
    ],
    lessons: [
      {slug: 'compare-values', title: 'Compare Two Values'},
      {slug: 'choose-with-if', title: 'Make a Choice with If'},
      {slug: 'else-and-else-if', title: 'Use Else and Else If'},
      {slug: 'and-or-not', title: 'Combine Rules with And, Or, and Not'},
      {slug: 'package-sorter-challenge', title: 'Coding Challenge: Package Sorter', challenge: true},
    ],
  },
  {
    title: 'Loops and Repeated Work',
    desc: 'Repeat commands safely with counts, conditions, and loop variables.',
    overview: 'A loop repeats a group of commands. You will choose a loop that matches the job, check its stopping rule, and trace repeated work without losing your place.',
    outcomes: [
      'Use fixed-count, condition-controlled, and counting loops.',
      'Trace loop variables and recognize off-by-one errors.',
      'Stop an endless loop and simplify repeated patterns with nesting.',
    ],
    lessons: [
      {slug: 'repeat-known-count', title: 'Repeat a Known Number of Times'},
      {slug: 'repeat-while-true', title: 'Repeat While a Rule Is True'},
      {slug: 'counting-loops', title: 'Counting Loops and Loop Variables'},
      {slug: 'nested-and-nonstop-loops', title: 'Nested Loops and Programs That Do Not Stop'},
      {slug: 'grid-scanner-challenge', title: 'Coding Challenge: Grid Scanner', challenge: true},
    ],
  },
  {
    title: 'Functions and Lists',
    desc: 'Name reusable work, pass values into it, return results, and process lists.',
    overview: 'Functions give one name to a useful group of commands. Lists keep several related values in order. You will use both to make programs easier to test and change.',
    outcomes: [
      'Define and call a function at the correct point in a program.',
      'Use parameters, local values, and returned results.',
      'Read list items by index and process each item with a loop.',
    ],
    lessons: [
      {slug: 'define-and-call-functions', title: 'Define and Call a Function'},
      {slug: 'function-parameters', title: 'Give Information to a Function'},
      {slug: 'return-a-result', title: 'Return a Result'},
      {slug: 'store-and-process-lists', title: 'Store and Process a List'},
      {slug: 'data-report-challenge', title: 'Coding Challenge: Data Report', challenge: true},
    ],
  },
  {
    title: 'Plan, Test, and Move to Text Code',
    desc: 'Combine the foundations, test them carefully, and connect each idea to Java.',
    overview: 'A complete program is easier to build when the work is split into small parts. You will plan those parts, test them with useful cases, and read the same ideas in blocks and Java.',
    outcomes: [
      'Break a problem into small steps and write a short plan before building.',
      'Test normal, boundary, and unexpected inputs while tracing program state.',
      'Recognize variables, conditions, loops, functions, and lists in Java-shaped code.',
    ],
    lessons: [
      {slug: 'break-programs-into-parts', title: 'Break a Program into Smaller Parts'},
      {slug: 'combine-programming-tools', title: 'Combine State, Decisions, Loops, and Functions'},
      {slug: 'test-cases-and-debugging', title: 'Test Cases and Debugging'},
      {slug: 'blocks-beside-java', title: 'Read Blocks Beside Java-Shaped Code'},
      {slug: 'delivery-controller-challenge', title: 'Final Coding Challenge: Delivery Controller', challenge: true},
    ],
  },
];

const unitSlug = (index: number) => `blocks-unit-${String(index).padStart(2, '0')}`;

export const BLOCKS_UNITS: CurriculumUnit[] = BLOCKS_UNIT_SEEDS.map((seed, index) => {
  const slug = unitSlug(index);
  const next = BLOCKS_UNIT_SEEDS[index + 1];
  return {
    id: `BLOCKS_UNIT_${String(index).padStart(2, '0')}`,
    label: `Unit ${index}`,
    title: seed.title,
    desc: seed.desc,
    tier: 'Beginner' as Tier,
    slug,
    overviewPath: `/blocks/${slug}`,
    startPath: `/blocks/${slug}/${seed.lessons[0].slug}`,
    nextPath: next ? `/blocks/${unitSlug(index + 1)}` : '/blocks/next-step',
    nextLabel: next ? `Unit ${index + 1}: ${next.title}` : 'Choose Your Next Step',
    lessonCount: seed.lessons.length,
    overview: seed.overview,
    outcomes: seed.outcomes,
  };
});

export const BLOCKS_LESSONS: CurriculumLesson[] = BLOCKS_UNIT_SEEDS.flatMap(
  (seed, unitIndex) => {
    const slug = unitSlug(unitIndex);
    return seed.lessons.map((lesson, lessonIndex) => ({
      id: `${slug}/${lesson.slug}`,
      label: `${unitIndex}.${lessonIndex + 1} · ${lesson.title}`,
      title: `Lesson ${unitIndex}.${lessonIndex + 1}: ${lesson.title}`,
      path: `/blocks/${slug}/${lesson.slug}`,
      unitSlug: slug,
      unitLabel: `Unit ${unitIndex}`,
      unitTitle: seed.title,
    }));
  },
);

export const BLOCKS_UNIT_COUNT = BLOCKS_UNITS.length;
export const BLOCKS_LESSON_COUNT = BLOCKS_LESSONS.length;

export function getBlocksUnitBySlug(slug: string): CurriculumUnit | undefined {
  return BLOCKS_UNITS.find((unit) => unit.slug === slug);
}

export function getBlocksLessonsForUnit(slug: string): CurriculumLesson[] {
  return BLOCKS_LESSONS.filter((lesson) => lesson.unitSlug === slug);
}

export function isBlocksChallenge(lessonId: string): boolean {
  const [unitSlugValue, lessonSlug] = lessonId.split('/');
  const index = BLOCKS_UNITS.findIndex((unit) => unit.slug === unitSlugValue);
  return index >= 0 && BLOCKS_UNIT_SEEDS[index].lessons.some(
    (lesson) => lesson.slug === lessonSlug && lesson.challenge,
  );
}
