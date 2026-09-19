import type {CurriculumLesson, CurriculumUnit, Tier} from './curriculum';

interface FllUnitSeed {
  title: string;
  desc: string;
  overview: string;
  outcomes: string[];
  lessons: Array<{slug: string; title: string; challenge?: boolean}>;
}

const FLL_UNIT_SEEDS: FllUnitSeed[] = [
  {
    title: 'Challenge and SPIKE Motion',
    desc: 'Meet the Robot Game, then drive a SPIKE-style robot with useful units and controlled turns.',
    overview: 'FLL Challenge robots run autonomous programs on a mission field. Start with the official SPIKE workflow, then learn how distance, speed, steering, and turn geometry change a route.',
    outcomes: [
      'Explain where coding fits beside Robot Design, the Innovation Project, and Core Values.',
      'Relate Telemark movement blocks to SPIKE Prime Word Blocks.',
      'Build a route from measured drives and point, pivot, or arc turns.',
    ],
    lessons: [
      {slug: 'what-is-fll-challenge', title: 'What FLL Challenge Is'},
      {slug: 'spike-app-and-simulator', title: 'The SPIKE App and Telemark Simulator'},
      {slug: 'motor-pairs-and-distance', title: 'Motor Pairs, Speed, and Distance'},
      {slug: 'turns-and-steering', title: 'Point, Pivot, and Arc Turns'},
      {slug: 'precision-route-challenge', title: 'Coding Challenge: Precision Route', challenge: true},
    ],
  },
  {
    title: 'Sensors and Mission Tools',
    desc: 'Use reflected light, distance, heading, and a motorized attachment to interact with the field.',
    overview: 'Sensors give a mission program landmarks that are more reliable than timing alone. Add a simple powered tool so the robot can detect, collect, activate, and deliver objects.',
    outcomes: [
      'Stop or choose an action from color and distance readings.',
      'Reset and read heading for a simplified correction.',
      'Coordinate drive motors with an attachment motor.',
    ],
    lessons: [
      {slug: 'color-and-reflected-light', title: 'Color and Reflected Light'},
      {slug: 'distance-and-wait-until', title: 'Distance and Wait Until'},
      {slug: 'hub-heading', title: 'Hub Heading and Yaw Reset'},
      {slug: 'attachment-motors', title: 'Attachment Motors and Objects'},
      {slug: 'retrieve-deliver-challenge', title: 'Coding Challenge: Retrieve and Deliver', challenge: true},
    ],
  },
  {
    title: 'Reliable Mission Runs',
    desc: 'Organize mission code, calibrate it, budget match time, and test repeatability.',
    overview: 'A route that succeeds once is a prototype. Turn it into a competition program with My Blocks, consistent launches, measured tests, time budgets, and planned returns to home.',
    outcomes: [
      'Use a parameterized My Block to organize reusable motion.',
      'Plan and test a route from a repeatable launch position.',
      'Complete a multi-objective run within the 150-second match budget.',
    ],
    lessons: [
      {slug: 'my-blocks', title: 'My Blocks and Parameters'},
      {slug: 'launch-plan-and-home', title: 'Launch Alignment, Route Plans, and Home'},
      {slug: 'calibration-and-repeatability', title: 'Calibration and Repeatability'},
      {slug: 'mission-order-and-time', title: 'Mission Order, Recovery, and Time'},
      {slug: 'mission-run-capstone', title: 'Coding Challenge: Mission Run Capstone', challenge: true},
    ],
  },
];

const unitSlug = (index: number) => `fll-unit-${String(index).padStart(2, '0')}`;

export const FLL_UNITS: CurriculumUnit[] = FLL_UNIT_SEEDS.map((seed, index) => {
  const slug = unitSlug(index);
  const next = FLL_UNIT_SEEDS[index + 1];
  return {
    id: `FLL_UNIT_${String(index).padStart(2, '0')}`,
    label: `FLL Unit ${index}`,
    title: seed.title,
    desc: seed.desc,
    tier: (index === 0 ? 'Beginner' : 'Intermediate') as Tier,
    slug,
    overviewPath: `/blocks/fll/unit-${String(index).padStart(2, '0')}`,
    startPath: `/blocks/fll/unit-${String(index).padStart(2, '0')}/${seed.lessons[0].slug}`,
    nextPath: next ? `/blocks/fll/unit-${String(index + 1).padStart(2, '0')}` : '/blocks/fll',
    nextLabel: next ? `FLL Unit ${index + 1}: ${next.title}` : 'FLL Challenge Extension',
    lessonCount: seed.lessons.length,
    overview: seed.overview,
    outcomes: seed.outcomes,
  };
});

export const FLL_LESSONS: CurriculumLesson[] = FLL_UNIT_SEEDS.flatMap((seed, unitIndex) => {
  const slug = unitSlug(unitIndex);
  return seed.lessons.map((lesson, lessonIndex) => ({
    id: `${slug}/${lesson.slug}`,
    label: `F${unitIndex}.${lessonIndex + 1} · ${lesson.title}`,
    title: `Lesson F${unitIndex}.${lessonIndex + 1}: ${lesson.title}`,
    path: `/blocks/fll/unit-${String(unitIndex).padStart(2, '0')}/${lesson.slug}`,
    unitSlug: slug,
    unitLabel: `FLL Unit ${unitIndex}`,
    unitTitle: seed.title,
  }));
});

export const FLL_UNIT_COUNT = FLL_UNITS.length;
export const FLL_LESSON_COUNT = FLL_LESSONS.length;

export function getFllUnitBySlug(slug: string): CurriculumUnit | undefined {
  return FLL_UNITS.find((unit) => unit.slug === slug);
}

export function getFllLessonsForUnit(slug: string): CurriculumLesson[] {
  return FLL_LESSONS.filter((lesson) => lesson.unitSlug === slug);
}

export function isFllChallenge(lessonId: string): boolean {
  const [unitSlugValue, lessonSlug] = lessonId.split('/');
  const index = FLL_UNITS.findIndex((unit) => unit.slug === unitSlugValue);
  return index >= 0 && FLL_UNIT_SEEDS[index].lessons.some(
    (lesson) => lesson.slug === lessonSlug && lesson.challenge,
  );
}
