import React, {useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { signOut } from 'firebase/auth';
import { auth } from '../telemark/firebase';
import { useAuth } from '../telemark/useAuth';
import { useProgress } from '../telemark/useProgress';
import { getTrack, MAIN_TRACKS, type MainTrackId } from '../telemark/tracks';
import {parseProgressExport, serializeProgress} from '../telemark/progressStore';
import {trackEvent} from '../telemark/analytics';
import heroStyles from './index.module.css';
import styles from './dashboard.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const { user, loading } = useAuth();
  const {
    progress,
    loading: progressLoading,
    isComplete,
    isSkipped,
    markManyComplete,
    mergeImportedProgress,
  } = useProgress(user);
  const [activeTrack, setActiveTrack] = useState<MainTrackId>('software');
  const [collapsedUnits, setCollapsedUnits] = useState<Record<string, boolean>>({});
  const [updatingUnit, setUpdatingUnit] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const track = getTrack(activeTrack);
  const lastOpenLesson = progress?.lastLesson
    ? track.lessons.find(
        (lesson) => lesson.id === progress.lastLesson && !isComplete(lesson.id),
      )
    : undefined;
  const nextLesson = lastOpenLesson
    ?? track.lessons.find((lesson) => !isComplete(lesson.id));
  const fallbackUnit = track.units[track.units.length - 1];
  const unitLessons = track.units.map((unit) =>
    track.lessons.filter((lesson) => lesson.unitSlug === unit.slug),
  );
  const trackButtonClass = activeTrack === 'software'
    ? heroStyles.btnPrimary
    : heroStyles.btnTrackAlt;
  const completedUnits = unitLessons.map((lessons) => lessons.length > 0
    && lessons.every((lesson) => isComplete(lesson.id) && !isSkipped(lesson.id)));
  const firstIncompleteUnit = completedUnits.findIndex((complete) => !complete);
  const currentUnitIndex = firstIncompleteUnit === -1
    ? Math.max(0, track.units.length - 1)
    : firstIncompleteUnit;
  const visibleUnitIndexes = [
    currentUnitIndex - 1,
    currentUnitIndex,
    currentUnitIndex + 1,
  ].filter((index) => index >= 0 && index < track.units.length);

  function toggleUnit(unitSlug: string): void {
    setCollapsedUnits((current) => ({
      ...current,
      [unitSlug]: !current[unitSlug],
    }));
  }

  async function handleMarkUnitDone(
    unitLabel: string,
    unitSlug: string,
    lessonIds: string[],
  ): Promise<void> {
    setUpdatingUnit(unitSlug);
    try {
      await markManyComplete(lessonIds);
      setTransferMessage(`${unitLabel} marked done.`);
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : `Could not update ${unitLabel}.`);
    } finally {
      setUpdatingUnit(null);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setTransferMessage('Signed out. Progress remains saved on this device.');
  }

  function handleExport() {
    const blob = new Blob([serializeProgress(progress)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telemark-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setTransferMessage('Progress backup downloaded.');
    trackEvent('progress_export', {surface: 'dashboard'});
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
      setTransferMessage('That file is too large to be a Telemark progress backup.');
      return;
    }

    try {
      const imported = parseProgressExport(await file.text());
      await mergeImportedProgress(imported);
      setTransferMessage(
        user
          ? 'Imported progress merged and synced to your account.'
          : 'Imported progress merged into this browser.',
      );
      trackEvent('progress_import', {surface: 'dashboard'});
    } catch (error) {
      setTransferMessage(error instanceof Error ? error.message : 'Could not import that file.');
    }
  }

  if (loading || progressLoading) {
    return (
      <Layout title="Dashboard · Telemark" noFooter>
        <main className={styles.page}>
          <div className={styles.loading}>Loading your curriculum progress...</div>
        </main>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard · Telemark" noFooter>

      <main className={styles.page}>
        <div className={styles.content}>

          {/* ── Header ── */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>
                {user ? (
                  <>Welcome back, <span className={styles.name}>
                    {user.displayName?.split(' ')[0] ?? 'teammate'}
                  </span></>
                ) : 'Your Telemark progress'}
              </h1>
              <p className={styles.storageNote}>
                {user
                  ? 'Synced with your Google account and saved on this device.'
                  : 'Saved automatically in this browser. Export a backup before clearing site data.'}
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link
                to={nextLesson?.path ?? fallbackUnit.startPath}
                className={[trackButtonClass, styles.resumeBtn].join(' ')}
              >
                {nextLesson ? `Resume → ${nextLesson.label}` : `Review ${fallbackUnit.label} ✓`}
              </Link>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.importInput}
                onChange={(event) => void handleImport(event)}
              />
              {/* Account chores, kept in one row. Stacked, each sized to its own
                  label against a right edge, they came out as a staircase and
                  read as three choices as weighty as resuming the course. */}
              <div className={styles.utilityRow}>
                <button type="button" className={styles.signOutBtn} onClick={handleExport}>
                  Export
                </button>
                <button
                  type="button"
                  className={styles.signOutBtn}
                  onClick={() => importInputRef.current?.click()}
                >
                  Import
                </button>
                {user && (
                  <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
                    Sign out
                  </button>
                )}
              </div>
            </div>
          </div>
          {transferMessage && (
            <p className={styles.transferMessage} role="status">{transferMessage}</p>
          )}

          <div className={styles.trackSwitcher} role="group" aria-label="Choose a track">
            {MAIN_TRACKS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={[
                  option.id === 'software' ? heroStyles.btnPrimary : heroStyles.btnTrackAlt,
                  styles.trackTab,
                  activeTrack === option.id ? styles.trackTabActive : '',
                ].join(' ')}
                aria-pressed={activeTrack === option.id}
                onClick={() => setActiveTrack(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className={styles.unitMap} data-track={activeTrack}>
            <ol
              className={`${styles.unitGrid} ${visibleUnitIndexes.length === 2 ? styles.unitGridTwo : ''}`}
              aria-label={track.shortLabel + ' units'}
            >
              {visibleUnitIndexes.map((unitIndex) => {
                const unit = track.units[unitIndex];
                const lessons = unitLessons[unitIndex];
                const expanded = !collapsedUnits[unit.slug];
                const current = unitIndex === currentUnitIndex;
                const unitComplete = completedUnits[unitIndex];
                const completedLessonCount = lessons.filter(
                  (lesson) => isComplete(lesson.id) && !isSkipped(lesson.id),
                ).length;
                const completionPercentage = lessons.length > 0
                  ? Math.round((completedLessonCount / lessons.length) * 100)
                  : 0;
                return (
                  <li key={unit.slug} className={styles.unitStep}>
                    <button
                      type="button"
                      className={[
                        trackButtonClass,
                        styles.unitTile,
                        unitComplete ? styles.unitDone : '',
                        current ? styles.unitCurrent : '',
                      ].join(' ')}
                      aria-expanded={expanded}
                      aria-controls={`${unit.slug}-lessons`}
                      aria-label={`${unit.label}: ${unit.title}. ${completedLessonCount} of ${lessons.length} lessons complete. ${expanded ? 'Hide lessons' : 'Show lessons'}`}
                      onClick={() => toggleUnit(unit.slug)}
                    >
                      <span className={styles.unitHeading}>
                        <span className={styles.unitLabel}>{unit.label}</span>
                        <span className={styles.unitTitle}>{unit.title}</span>
                      </span>
                      <span className={styles.unitProgress} aria-hidden="true">
                        <span className={styles.unitProgressMeta}>
                          <span>{completedLessonCount} / {lessons.length} lessons</span>
                          <span>{completionPercentage}%</span>
                        </span>
                        <span className={styles.unitProgressTrack}>
                          <span
                            className={styles.unitProgressFill}
                            style={{width: `${completionPercentage}%`}}
                          />
                        </span>
                      </span>
                      <span className={styles.unitToggleHint}>
                        {expanded ? 'Hide lessons' : 'Show lessons'}
                      </span>
                    </button>

                    <div className={styles.unitActions}>
                      <button
                        type="button"
                        className={`${styles.signOutBtn} ${styles.unitCompleteButton}`}
                        disabled={unitComplete || updatingUnit === unit.slug || lessons.length === 0}
                        onClick={() => void handleMarkUnitDone(
                          unit.label,
                          unit.slug,
                          lessons.map((lesson) => lesson.id),
                        )}
                      >
                        {unitComplete
                          ? 'Unit done'
                          : updatingUnit === unit.slug
                            ? 'Saving...'
                            : 'Mark unit done'}
                      </button>
                    </div>

                    {expanded && (
                      <ul id={`${unit.slug}-lessons`} className={styles.lessonRequirements}>
                        {lessons.map((lesson) => {
                          const done = isComplete(lesson.id) && !isSkipped(lesson.id);
                          return (
                            <li key={lesson.id}>
                              <Link
                                to={lesson.path}
                                className={`${styles.lessonRequirement} ${done ? styles.lessonRequirementDone : ''}`}
                                aria-label={`${lesson.label}, ${done ? 'complete' : 'incomplete'}`}
                              >
                                <span className={styles.lessonMarker} aria-hidden="true" />
                                <span>{lesson.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

        </div>
      </main>
    </Layout>
  );
}
