import {BLOCKS_LESSONS} from './blocksCurriculum';
import {CURRICULUM_LESSONS} from './curriculum';
import {MECHANICAL_LESSONS} from './mechanical';
export type ClassroomTrackId = 'software' | 'mechanical' | 'overall';

export interface ClassroomProgressInput {
  completedLessons?: readonly string[];
  skippedLessons?: readonly string[];
  autoCompletedLessons?: readonly string[];
}

export interface ClassroomProgressSummary {
  completed: number;
  skipped: number;
  placement: number;
  handled: number;
  total: number;
  percentage: number;
}

const SOFTWARE_LESSON_IDS = new Set([
  ...BLOCKS_LESSONS.map((lesson) => lesson.id),
  ...CURRICULUM_LESSONS.map((lesson) => lesson.id),
]);
const MECHANICAL_LESSON_IDS = new Set(
  MECHANICAL_LESSONS.map((lesson) => lesson.id),
);
const ALL_LESSON_IDS = new Set([
  ...SOFTWARE_LESSON_IDS,
  ...MECHANICAL_LESSON_IDS,
]);

function lessonIdsFor(track: ClassroomTrackId): Set<string> {
  if (track === 'software') return SOFTWARE_LESSON_IDS;
  if (track === 'mechanical') return MECHANICAL_LESSON_IDS;
  return ALL_LESSON_IDS;
}

/**
 * Turn a private progress record into the small summary shown to a coach or
 * classmate. "Handled" follows the learner dashboard: finished, skipped, and
 * placement-credit lessons all advance the bar, while the separate counts keep
 * those three cases visible to a coach.
 */
export function summarizeClassroomProgress(
  progress: ClassroomProgressInput | null | undefined,
  track: ClassroomTrackId = 'overall',
): ClassroomProgressSummary {
  const lessonIds = lessonIdsFor(track);
  const completedIds = new Set(
    (progress?.completedLessons ?? []).filter((lessonId) => lessonIds.has(lessonId)),
  );
  const skippedIds = new Set(
    (progress?.skippedLessons ?? []).filter((lessonId) => completedIds.has(lessonId)),
  );
  const placementIds = new Set(
    (progress?.autoCompletedLessons ?? []).filter((lessonId) => (
      completedIds.has(lessonId) && !skippedIds.has(lessonId)
    )),
  );
  const handled = completedIds.size;
  const total = lessonIds.size;

  return {
    completed: Math.max(0, handled - skippedIds.size - placementIds.size),
    skipped: skippedIds.size,
    placement: placementIds.size,
    handled,
    total,
    percentage: total === 0 ? 0 : Math.round((handled / total) * 100),
  };
}
