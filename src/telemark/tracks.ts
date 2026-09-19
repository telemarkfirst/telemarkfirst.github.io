import {
  CURRICULUM_LESSONS,
  CURRICULUM_LESSON_COUNT,
  CURRICULUM_UNITS,
  CURRICULUM_UNIT_COUNT,
  getLessonsForUnit,
  getUnitBySlug,
  type CurriculumLesson,
  type CurriculumUnit,
} from './curriculum';
import {
  MECHANICAL_LESSONS,
  MECHANICAL_LESSON_COUNT,
  MECHANICAL_UNITS,
  MECHANICAL_UNIT_COUNT,
  getMechanicalLessonsForUnit,
  getMechanicalUnitBySlug,
} from './mechanical';
import {
  BLOCKS_LESSONS,
  BLOCKS_LESSON_COUNT,
  BLOCKS_UNITS,
  BLOCKS_UNIT_COUNT,
  getBlocksLessonsForUnit,
  getBlocksUnitBySlug,
} from './blocksCurriculum';
import {
  FLL_LESSONS,
  FLL_UNITS,
  getFllLessonsForUnit,
  getFllUnitBySlug,
} from './fllCurriculum';

/**
 * Track-aware lookups.
 *
 * Telemark has two parallel tracks that share the same unit and lesson shape:
 * the software curriculum (unit-NN) and the engineering track (module-NN).
 * Components that work for both should read from here so a new track does not
 * require touching every call site.
 */

export type MainTrackId = 'software' | 'mechanical';
export type TrackId = MainTrackId | 'blocks';

export interface Track {
  id: TrackId;
  label: string;
  shortLabel: string;
  tagline: string;
  /** Landing page listing every unit in the track. */
  indexPath: string;
  units: CurriculumUnit[];
  lessons: CurriculumLesson[];
  unitCount: number;
  lessonCount: number;
}

export const SOFTWARE_TRACK: Track & {id: 'software'} = {
  id: 'software',
  label: 'Software Track',
  shortLabel: 'Software',
  tagline: 'FTC Java, from setup to autonomous.',
  indexPath: '/docs',
  units: CURRICULUM_UNITS,
  lessons: CURRICULUM_LESSONS,
  unitCount: CURRICULUM_UNIT_COUNT,
  lessonCount: CURRICULUM_LESSON_COUNT,
};

export const MECHANICAL_TRACK: Track & {id: 'mechanical'} = {
  id: 'mechanical',
  label: 'Mechanical Track',
  shortLabel: 'Mechanical',
  tagline: 'Design, build, and fabricate the robot the code runs on.',
  indexPath: '/mechanical',
  units: MECHANICAL_UNITS,
  lessons: MECHANICAL_LESSONS,
  unitCount: MECHANICAL_UNIT_COUNT,
  lessonCount: MECHANICAL_LESSON_COUNT,
};

export const BLOCKS_TRACK: Track = {
  id: 'blocks',
  label: 'Software: Blocks Foundations',
  shortLabel: 'Blocks',
  tagline: 'Core programming skills before FTC Java.',
  indexPath: '/blocks',
  units: BLOCKS_UNITS,
  lessons: BLOCKS_LESSONS,
  unitCount: BLOCKS_UNIT_COUNT,
  lessonCount: BLOCKS_LESSON_COUNT,
};

export const MAIN_TRACKS: Array<typeof SOFTWARE_TRACK | typeof MECHANICAL_TRACK> = [
  SOFTWARE_TRACK,
  MECHANICAL_TRACK,
];
/** Public top-level choices. Blocks is nested inside Software as its prerequisite. */
export const TRACKS: Track[] = MAIN_TRACKS;

export const TOTAL_UNIT_COUNT = BLOCKS_UNIT_COUNT + CURRICULUM_UNIT_COUNT + MECHANICAL_UNIT_COUNT;
export const TOTAL_LESSON_COUNT = BLOCKS_LESSON_COUNT + CURRICULUM_LESSON_COUNT + MECHANICAL_LESSON_COUNT;

/** Engineering slugs are module-NN; everything else belongs to the software track. */
export function trackForUnitSlug(unitSlug: string): TrackId {
  if (unitSlug.startsWith('blocks-unit-') || unitSlug.startsWith('fll-unit-')) return 'blocks';
  return unitSlug.startsWith('module-') ? 'mechanical' : 'software';
}

export function getTrack(trackId: TrackId): Track {
  if (trackId === 'blocks') return BLOCKS_TRACK;
  return trackId === 'mechanical' ? MECHANICAL_TRACK : SOFTWARE_TRACK;
}

/** Look up a unit in either track. */
export function getAnyUnitBySlug(unitSlug: string): CurriculumUnit | undefined {
  if (unitSlug.startsWith('fll-unit-')) return getFllUnitBySlug(unitSlug);
  const track = trackForUnitSlug(unitSlug);
  if (track === 'blocks') return getBlocksUnitBySlug(unitSlug);
  return track === 'mechanical' ? getMechanicalUnitBySlug(unitSlug) : getUnitBySlug(unitSlug);
}

/** Look up a unit's lessons in either track. */
export function getAnyLessonsForUnit(unitSlug: string): CurriculumLesson[] {
  if (unitSlug.startsWith('fll-unit-')) return getFllLessonsForUnit(unitSlug);
  const track = trackForUnitSlug(unitSlug);
  if (track === 'blocks') return getBlocksLessonsForUnit(unitSlug);
  return track === 'mechanical'
    ? getMechanicalLessonsForUnit(unitSlug)
    : getLessonsForUnit(unitSlug);
}

/** Every lesson across both tracks, used by dashboard and progress summaries. */
export function getAllLessons(): CurriculumLesson[] {
  return [...BLOCKS_LESSONS, ...FLL_LESSONS, ...CURRICULUM_LESSONS, ...MECHANICAL_LESSONS];
}

/** Every unit across both tracks. */
export function getAllUnits(): CurriculumUnit[] {
  return [...BLOCKS_UNITS, ...FLL_UNITS, ...CURRICULUM_UNITS, ...MECHANICAL_UNITS];
}
