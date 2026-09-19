import {useCallback, useEffect, useState} from 'react';
import type {User} from 'firebase/auth';
import {trackEvent} from './analytics';
import {getAnyLessonsForUnit} from './tracks';
import {saveCloudProgress, syncLocalProgressWithUser} from './progressCloud';
import {
  PROGRESS_CHANGED_EVENT,
  addAutomaticCompletions,
  clearAutomaticCompletions,
  completeLessonsManually,
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  readLocalProgress,
  writeLocalProgress,
  type ProgressData,
} from './progressStore';

export type {ProgressData} from './progressStore';

function unitSlugForLessons(lessonIds: string[]): string | null {
  return lessonIds[0]?.split('/')[0] ?? null;
}

export function useProgress(user: User | null) {
  // Start with the same value during server rendering and hydration, then read
  // browser storage in the effect below. Reading localStorage here would make
  // completed lessons hydrate with different markup from the generated page.
  const [progress, setProgress] = useState<ProgressData>(() => emptyProgress());
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    function receiveProgress(event: Event) {
      const next = event instanceof CustomEvent
        ? normalizeProgress(event.detail)
        : readLocalProgress();
      setProgress(next);
    }
    window.addEventListener(PROGRESS_CHANGED_EVENT, receiveProgress);
    window.addEventListener('storage', receiveProgress);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED_EVENT, receiveProgress);
      window.removeEventListener('storage', receiveProgress);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProgress(readLocalProgress());
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    syncLocalProgressWithUser(user)
      .then((merged) => {
        if (!cancelled) setProgress(merged);
      })
      .catch((error) => {
        console.error('Telemark cloud progress sync failed:', error);
        if (!cancelled) setProgress(readLocalProgress());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProgress = useCallback(async (nextValue: ProgressData) => {
    const local = writeLocalProgress(nextValue);
    setProgress(local);
    if (!user) return local;

    const merged = await saveCloudProgress(user, local);
    setProgress(merged);
    return merged;
  }, [user]);

  const mergeImportedProgress = useCallback(async (imported: ProgressData) => {
    return saveProgress(mergeProgress(progress, imported));
  }, [progress, saveProgress]);

  const markComplete = useCallback(async (lessonId: string) => {
    const alreadyComplete = progress.completedLessons.includes(lessonId);
    const wasSkipped = progress.skippedLessons.includes(lessonId);
    if (alreadyComplete && !wasSkipped) return;

    const newCompleted = alreadyComplete
      ? progress.completedLessons
      : [...progress.completedLessons, lessonId];
    const unitSlug = lessonId.split('/')[0];
    const unitLessonIds = getAnyLessonsForUnit(unitSlug).map((lesson) => lesson.id);
    const unitNowComplete = unitLessonIds.length > 0
      && unitLessonIds.every((id) => newCompleted.includes(id));
    const manual = completeLessonsManually(progress, [lessonId]);
    await saveProgress({
      ...manual,
      completedLessons: newCompleted,
      reviewingUnits: unitNowComplete
        ? progress.reviewingUnits.filter((slug) => slug !== unitSlug)
        : progress.reviewingUnits,
      lastLesson: lessonId,
    });
    trackEvent('lesson_complete', {lesson_id: lessonId, unit_slug: unitSlug});
  }, [progress, saveProgress]);

  const markManyComplete = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) return;
    const additions = lessonIds.filter((lessonId) => !progress.completedLessons.includes(lessonId));
    const skippedToComplete = lessonIds.some((lessonId) => progress.skippedLessons.includes(lessonId));
    if (additions.length === 0 && !skippedToComplete) return;

    const unitSlug = unitSlugForLessons(lessonIds);
    const manual = completeLessonsManually(progress, lessonIds);
    await saveProgress({
      ...manual,
      reviewingUnits: unitSlug
        ? progress.reviewingUnits.filter((slug) => slug !== unitSlug)
        : progress.reviewingUnits,
      lastLesson: lessonIds[lessonIds.length - 1],
    });
    additions.forEach((lessonId) => {
      trackEvent('lesson_complete', {
        lesson_id: lessonId,
        unit_slug: lessonId.split('/')[0] ?? 'unknown',
      });
    });
    trackEvent('unit_complete', {
      unit_slug: unitSlug ?? 'unknown',
      lessons_completed: additions.length,
    });
  }, [progress, saveProgress]);

  const markManySkipped = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) return;
    const unitSlug = unitSlugForLessons(lessonIds);
    await saveProgress({
      ...progress,
      completedLessons: [
        ...progress.completedLessons,
        ...lessonIds.filter((lessonId) => !progress.completedLessons.includes(lessonId)),
      ],
      skippedLessons: [
        ...progress.skippedLessons,
        ...lessonIds.filter((lessonId) => !progress.skippedLessons.includes(lessonId)),
      ],
      autoCompletedLessons: progress.autoCompletedLessons.filter(
        (lessonId) => !lessonIds.includes(lessonId),
      ),
      reviewingUnits: unitSlug
        ? progress.reviewingUnits.filter((slug) => slug !== unitSlug)
        : progress.reviewingUnits,
      lastLesson: lessonIds[lessonIds.length - 1],
    });
    trackEvent('unit_skip', {
      unit_slug: unitSlug ?? 'unknown',
      lessons_skipped: lessonIds.length,
    });
  }, [progress, saveProgress]);

  const reviewMany = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) return;
    const unitSlug = unitSlugForLessons(lessonIds);
    await saveProgress({
      ...progress,
      completedLessons: progress.completedLessons.filter((lessonId) => !lessonIds.includes(lessonId)),
      skippedLessons: progress.skippedLessons.filter((lessonId) => !lessonIds.includes(lessonId)),
      autoCompletedLessons: progress.autoCompletedLessons.filter(
        (lessonId) => !lessonIds.includes(lessonId),
      ),
      reviewingUnits: unitSlug && !progress.reviewingUnits.includes(unitSlug)
        ? [...progress.reviewingUnits, unitSlug]
        : progress.reviewingUnits,
      lastLesson: lessonIds[0],
    });
    trackEvent('unit_review', {unit_slug: unitSlug ?? 'unknown'});
  }, [progress, saveProgress]);

  const unmarkMany = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) return;
    const unitSlug = unitSlugForLessons(lessonIds);
    await saveProgress({
      ...progress,
      completedLessons: progress.completedLessons.filter((lessonId) => !lessonIds.includes(lessonId)),
      skippedLessons: progress.skippedLessons.filter((lessonId) => !lessonIds.includes(lessonId)),
      autoCompletedLessons: progress.autoCompletedLessons.filter(
        (lessonId) => !lessonIds.includes(lessonId),
      ),
      reviewingUnits: unitSlug
        ? progress.reviewingUnits.filter((slug) => slug !== unitSlug)
        : progress.reviewingUnits,
      lastLesson: lessonIds[0],
    });
    trackEvent('unit_unmark', {unit_slug: unitSlug ?? 'unknown'});
  }, [progress, saveProgress]);

  const markSkipped = useCallback(async (lessonId: string) => {
    if (progress.skippedLessons.includes(lessonId)) return;
    await saveProgress({
      ...progress,
      completedLessons: progress.completedLessons.includes(lessonId)
        ? progress.completedLessons
        : [...progress.completedLessons, lessonId],
      skippedLessons: [...progress.skippedLessons, lessonId],
      autoCompletedLessons: progress.autoCompletedLessons.filter((id) => id !== lessonId),
    });
  }, [progress, saveProgress]);

  const unskip = useCallback(async (lessonId: string) => {
    if (!progress.skippedLessons.includes(lessonId)) return;
    await saveProgress({
      ...progress,
      completedLessons: progress.completedLessons.filter((id) => id !== lessonId),
      skippedLessons: progress.skippedLessons.filter((id) => id !== lessonId),
    });
  }, [progress, saveProgress]);

  const unmarkComplete = useCallback(async (lessonId: string) => {
    const unitSlug = lessonId.split('/')[0];
    await saveProgress({
      ...progress,
      completedLessons: progress.completedLessons.filter((id) => id !== lessonId),
      skippedLessons: progress.skippedLessons.filter((id) => id !== lessonId),
      autoCompletedLessons: progress.autoCompletedLessons.filter((id) => id !== lessonId),
      reviewingUnits: progress.reviewingUnits.filter((slug) => slug !== unitSlug),
      lastLesson: lessonId,
    });
    trackEvent('lesson_unmark', {lesson_id: lessonId, unit_slug: unitSlug});
  }, [progress, saveProgress]);

  const markManyAutoComplete = useCallback(async (lessonIds: string[]) => {
    const additions = lessonIds.filter(
      (lessonId) => !progress.completedLessons.includes(lessonId),
    );
    if (additions.length === 0) return;
    await saveProgress({
      ...addAutomaticCompletions(progress, lessonIds),
      lastLesson: progress.lastLesson,
    });
    trackEvent('blocks_placement_complete', {lessons_completed: additions.length});
  }, [progress, saveProgress]);

  const clearAutoCompleted = useCallback(async (lessonIds: string[]) => {
    const removals = lessonIds.filter((lessonId) =>
      progress.autoCompletedLessons.includes(lessonId),
    );
    if (removals.length === 0) return;
    await saveProgress(clearAutomaticCompletions(progress, lessonIds));
  }, [progress, saveProgress]);

  const isComplete = useCallback(
    (lessonId: string) => progress.completedLessons.includes(lessonId),
    [progress],
  );
  const isSkipped = useCallback(
    (lessonId: string) => progress.skippedLessons.includes(lessonId),
    [progress],
  );
  const isReviewingUnit = useCallback(
    (unitSlug: string) => progress.reviewingUnits.includes(unitSlug),
    [progress],
  );

  return {
    progress,
    loading,
    mergeImportedProgress,
    markComplete,
    markManyComplete,
    markManyAutoComplete,
    clearAutoCompleted,
    markManySkipped,
    markSkipped,
    unskip,
    reviewMany,
    unmarkMany,
    unmarkComplete,
    isComplete,
    isSkipped,
    isReviewingUnit,
  };
}
