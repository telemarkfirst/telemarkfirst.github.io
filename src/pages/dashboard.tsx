import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { signOut } from 'firebase/auth';
import { auth } from '../telemark/firebase';
import { useAuth } from '../telemark/useAuth';
import { useProgress } from '../telemark/useProgress';
import { getTrack, MAIN_TRACKS, type MainTrackId } from '../telemark/tracks';
import {parseProgressExport, serializeProgress} from '../telemark/progressStore';
import {trackEvent} from '../telemark/analytics';
import {useLearnerProfile} from '../telemark/useLearnerProfile';
import {BLOCKS_LESSONS, BLOCKS_UNITS} from '../telemark/blocksCurriculum';
import {FLL_LESSONS, FLL_UNITS} from '../telemark/fllCurriculum';
import styles from './dashboard.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const { user, loading }          = useAuth();
  const {profile, status: profileStatus} = useLearnerProfile();
  const {
    progress,
    loading: progressLoading,
    isComplete,
    isSkipped,
    isReviewingUnit,
    markManyComplete,
    markManySkipped,
    reviewMany,
    unmarkMany,
    mergeImportedProgress,
  } = useProgress(user);
  const [activeTrack, setActiveTrack] = useState<MainTrackId>('software');
  const [blocksSectionOpen, setBlocksSectionOpen] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [savingUnit, setSavingUnit] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const previousStatusesRef = useRef<Record<string, string>>({});
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || profileStatus !== 'ready' || !profile) return;
    const blocksIncomplete = BLOCKS_LESSONS.some((lesson) => !isComplete(lesson.id));
    if ((profile.blocksPlacement === 'required' && blocksIncomplete)
      || profile.selectedTracks.includes('software')) {
      setActiveTrack('software');
    } else {
      setActiveTrack('mechanical');
    }
  }, [user, profileStatus, profile, isComplete]);

  useEffect(() => {
    if (!user || profileStatus !== 'ready' || !profile) return;
    setBlocksSectionOpen(profile.blocksPlacement !== 'auto_completed');
  }, [user, profileStatus, profile]);

  const track = getTrack(activeTrack);
  const trackLessons = useMemo(() => activeTrack === 'software'
    ? [...BLOCKS_LESSONS, ...track.lessons]
    : track.lessons, [activeTrack, track]);
  const trackUnits = useMemo(() => activeTrack === 'software'
    ? [...BLOCKS_UNITS, ...track.units]
    : track.units, [activeTrack, track]);

  const handled    = trackLessons.filter((lesson) => isComplete(lesson.id)).length;
  const skipped    = trackLessons.filter((lesson) => isSkipped(lesson.id)).length;
  const completed  = handled - skipped;
  const total      = trackLessons.length;
  const percentage = Math.round((handled / total) * 100);
  const lastOpenLesson = progress?.lastLesson
    ? trackLessons.find(
        (lesson) => lesson.id === progress.lastLesson && !isComplete(lesson.id),
      )
    : undefined;
  const nextLesson = lastOpenLesson
    ?? trackLessons.find((lesson) => !isComplete(lesson.id));
  const fallbackUnit = trackUnits[trackUnits.length - 1];
  const units = useMemo(() => {
    return trackUnits.map((unit) => {
      const lessons = trackLessons.filter((lesson) => lesson.unitSlug === unit.slug);
      const completedCount = lessons.filter((lesson) => isComplete(lesson.id)).length;
      const skippedCount = lessons.filter((lesson) => isSkipped(lesson.id)).length;
      const reviewing = isReviewingUnit(unit.slug);
      const status =
        reviewing
          ? 'reviewing'
          : skippedCount === lessons.length
            ? 'skipped'
            : completedCount === lessons.length
          ? 'complete'
          : completedCount === 0
            ? 'untouched'
            : 'in-progress';
      const unitNextLesson = lessons.find((lesson) => !isComplete(lesson.id));

      return {
        ...unit,
        lessons,
        completedCount,
        skippedCount,
        reviewing,
        status,
        unitNextLesson,
      };
    });
  }, [isComplete, isSkipped, isReviewingUnit, trackUnits, trackLessons]);

  useEffect(() => {
    if (!openActionMenu) return undefined;

    function closeMenu(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-progress-action-menu]')) {
        setOpenActionMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenActionMenu(null);
    }

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openActionMenu]);

  useEffect(() => {
    setExpandedUnits((prev) => {
      const next = {...prev};

      units.forEach((unit) => {
        const previousStatus = previousStatusesRef.current[unit.slug];
        if (
          previousStatus
          && previousStatus !== unit.status
          && next[unit.slug] !== true
        ) {
          delete next[unit.slug];
        }
      });

      previousStatusesRef.current = Object.fromEntries(
        units.map((unit) => [unit.slug, unit.status]),
      );

      return next;
    });
  }, [units]);

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

  function toggleUnit(unitSlug: string, nextValue: boolean) {
    setExpandedUnits((prev) => ({
      ...prev,
      [unitSlug]: nextValue,
    }));
  }

  async function handleUnitAction(
    unit: (typeof units)[number],
    action: 'complete' | 'skip' | 'review' | 'unmark',
  ) {
    const lessonIds = unit.lessons.map((lesson) => lesson.id);
    setSavingUnit(unit.slug);
    setActionError(null);

    try {
      if (action === 'complete') await markManyComplete(lessonIds);
      if (action === 'skip') await markManySkipped(lessonIds);
      if (action === 'review') await reviewMany(lessonIds);
      if (action === 'unmark') await unmarkMany(lessonIds);
      setOpenActionMenu(null);
      setExpandedUnits((prev) => ({...prev, [unit.slug]: action === 'review' || action === 'unmark'}));
    } catch (error) {
      console.error(`Telemark ${action} action failed:`, error);
      setActionError(`Could not update ${unit.label}. Please try again.`);
    } finally {
      setSavingUnit(null);
    }
  }

  if (
    loading
    || (user && profileStatus === 'loading')
    || progressLoading
  ) {
    return (
      <Layout title="Dashboard · Telemark" noFooter>
        <main className={styles.page}>
          <div className={styles.loading}>
            <span className={styles.loadingText}>Loading your curriculum progress...</span>
          </div>
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
              <Link to={nextLesson?.path ?? fallbackUnit.overviewPath} className={styles.resumeBtn}>
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
                  <Link to="/personalize" className={styles.signOutBtn}>
                    Edit learning path
                  </Link>
                )}
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

          {/* ── Track switcher ── */}
          <div className={styles.trackSwitcher} role="group" aria-label="Choose a track">
            {MAIN_TRACKS.map((option) => {
              const optionLessons = option.id === 'software'
                ? [...BLOCKS_LESSONS, ...option.lessons]
                : option.lessons;
              const optionHandled = optionLessons.filter((lesson) =>
                isComplete(lesson.id),
              ).length;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${styles.trackTab} ${
                    activeTrack === option.id ? styles.trackTabActive : ''
                  }`}
                  aria-pressed={activeTrack === option.id}
                  onClick={() => setActiveTrack(option.id)}
                >
                  <span className={styles.trackTabName}>{option.shortLabel}</span>
                  <span className={styles.trackTabMeta}>
                    {optionHandled} / {optionLessons.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Progress overview ── */}
          <div className={styles.overviewGrid}>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{completed}</span>
              <span className={styles.statLabel}>Lessons Complete</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{skipped}</span>
              <span className={styles.statLabel}>Skipped</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{total - handled}</span>
              <span className={styles.statLabel}>Remaining</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNum}>{percentage}%</span>
              <span className={styles.statLabel}>Overall Progress</span>
            </div>
          </div>

          {/* ── Progress bar ── */}
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>
                {trackUnits.length}{' '}
                {activeTrack === 'mechanical' ? 'modules' : 'units'} ·{' '}
                {total} lessons
              </span>
              <span className={styles.progressPct}>{percentage}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* ── Lesson list ── */}
          <div className={styles.lessonList}>
            <p className={styles.listLabel}>// progress.byUnit</p>
            {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
            {activeTrack === 'software' && (
              <button
                type="button"
                className={styles.blocksSectionToggle}
                aria-expanded={blocksSectionOpen}
                onClick={() => setBlocksSectionOpen((current) => !current)}
              >
                <span aria-hidden="true">{blocksSectionOpen ? '▾' : '▸'}</span>
                <span>
                  <strong>Blocks Foundations</strong>
                  <small>
                    {BLOCKS_LESSONS.filter((lesson) => isComplete(lesson.id)).length}
                    {' / '}{BLOCKS_LESSONS.length} lessons complete
                  </small>
                </span>
              </button>
            )}
            {units.map((unit) => {
              if (unit.slug.startsWith('blocks-unit-') && !blocksSectionOpen) return null;
              const isExpanded = expandedUnits[unit.slug]
                ?? (unit.status === 'in-progress' || unit.status === 'reviewing');
              const statusLabel =
                unit.status === 'reviewing'
                  ? 'Reviewing'
                  : unit.status === 'skipped'
                    ? 'Skipped'
                    : unit.status === 'complete'
                  ? 'Unit Complete'
                  : unit.status === 'untouched'
                    ? 'Not Started'
                    : 'In Progress';
              const unitBusy = savingUnit === unit.slug;

              return (
                <section
                  key={unit.slug}
                  className={`${styles.unitGroup} ${unit.status === 'skipped' ? styles.unitSkipped : ''} ${unit.status === 'reviewing' ? styles.unitReviewing : ''}`}
                >
                  <div className={styles.unitHeader}>
                    <button
                      type="button"
                      className={styles.unitToggle}
                      onClick={() => toggleUnit(unit.slug, !isExpanded)}
                    >
                      <span className={styles.unitToggleIcon} aria-hidden="true">
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      <span className={styles.unitHeaderInfo}>
                        <span className={styles.unitHeaderTitle}>
                          {unit.label}: {unit.title}
                        </span>
                        <span className={styles.unitHeaderMeta}>
                          {unit.completedCount}/{unit.lessons.length} handled
                          {unit.skippedCount > 0 && ` · ${unit.skippedCount} skipped`}
                          {' · '}
                          <span className={styles.unitState}>{statusLabel}</span>
                        </span>
                      </span>
                    </button>

                    <div className={styles.unitHeaderActions}>
                      <Link to={unit.overviewPath} className={styles.unitHeaderLink}>
                        Overview
                      </Link>
                      <Link
                        to={unit.unitNextLesson?.path ?? unit.startPath}
                        className={styles.unitHeaderLink}
                      >
                        {unit.status === 'reviewing'
                          ? 'Resume review'
                          : unit.unitNextLesson
                            ? 'Resume'
                            : 'Open'}
                      </Link>
                      <div className={styles.actionMenu} data-progress-action-menu>
                        <button
                          type="button"
                          className={styles.actionMenuTrigger}
                          aria-haspopup="menu"
                          aria-expanded={openActionMenu === unit.slug}
                          aria-label={`Progress options for ${unit.label}`}
                          onClick={() => setOpenActionMenu((current) => current === unit.slug ? null : unit.slug)}
                          disabled={unitBusy}
                        >
                          <span aria-hidden="true">•••</span>
                          <span>{unitBusy ? 'Saving' : 'Options'}</span>
                        </button>
                        {openActionMenu === unit.slug && (
                          <div className={styles.actionMenuPopover} role="menu">
                            <p className={styles.actionMenuLabel}>{unit.label} progress</p>
                            {(unit.completedCount < unit.lessons.length || unit.skippedCount > 0) && (
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.actionMenuItem}
                                onClick={() => handleUnitAction(unit, 'complete')}
                                disabled={unitBusy}
                              >
                                <span className={styles.actionMenuIcon} aria-hidden="true">✓</span>
                                <span><strong>Mark done</strong><small>Count every lesson as completed.</small></span>
                              </button>
                            )}
                            {unit.status !== 'skipped' && (
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.actionMenuItem}
                                onClick={() => handleUnitAction(unit, 'skip')}
                                disabled={unitBusy}
                              >
                                <span className={`${styles.actionMenuIcon} ${styles.skipIcon}`} aria-hidden="true">→</span>
                                <span><strong>Skip unit</strong><small>Treat it as done, with a skipped indicator.</small></span>
                              </button>
                            )}
                            {(unit.completedCount > 0 || unit.reviewing) && (
                              <button
                                type="button"
                                role="menuitem"
                                className={styles.actionMenuItem}
                                onClick={() => handleUnitAction(unit, 'review')}
                                disabled={unitBusy}
                              >
                                <span className={`${styles.actionMenuIcon} ${styles.reviewIcon}`} aria-hidden="true">↺</span>
                                <span><strong>{unit.reviewing ? 'Restart review' : 'Review unit'}</strong><small>Reopen it while remembering it was done before.</small></span>
                              </button>
                            )}
                            {(unit.completedCount > 0 || unit.reviewing) && (
                              <button
                                type="button"
                                role="menuitem"
                                className={`${styles.actionMenuItem} ${styles.unmarkItem}`}
                                onClick={() => handleUnitAction(unit, 'unmark')}
                                disabled={unitBusy}
                              >
                                <span className={styles.actionMenuIcon} aria-hidden="true">○</span>
                                <span><strong>Unmark unit</strong><small>Clear its progress and make it current.</small></span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.unitProgressTrack} aria-hidden="true">
                    <div
                      className={styles.unitProgressFill}
                      data-skipped={unit.status === 'skipped' ? 'true' : undefined}
                      style={{width: `${Math.round((unit.completedCount / unit.lessons.length) * 100)}%`}}
                    />
                  </div>

                  {isExpanded && (
                    <div className={styles.unitLessonRows}>
                      {unit.lessons.map((lesson) => {
                        const done = isComplete(lesson.id);
                        const lessonSkipped = isSkipped(lesson.id);
                        return (
                          <Link
                            key={lesson.id}
                            to={lesson.path}
                            className={`${styles.lessonRow} ${done ? styles.lessonDone : ''} ${lessonSkipped ? styles.lessonSkipped : ''} ${unit.reviewing && !done ? styles.lessonReviewing : ''}`}
                          >
                            <div className={styles.lessonCheck} aria-hidden="true">
                              {lessonSkipped ? '→' : done ? '✓' : unit.reviewing ? '↺' : '○'}
                            </div>
                            <div className={styles.lessonInfo}>
                              <span className={styles.lessonLabel}>{lesson.label}</span>
                              <span className={styles.lessonUnit}>{lesson.title}</span>
                            </div>
                            <span className={styles.lessonStatus}>
                              {lessonSkipped ? 'Skipped' : done ? 'Complete' : unit.reviewing ? 'Review' : 'Incomplete'}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
            {activeTrack === 'software' && (
              <section className={styles.unitGroup}>
                <div className={styles.unitHeader}>
                  <div className={styles.unitHeaderInfo}>
                    <span className={styles.unitHeaderTitle}>Optional: FLL Challenge Extension</span>
                    <span className={styles.unitHeaderMeta}>
                      {FLL_LESSONS.filter((lesson) => isComplete(lesson.id)).length}/{FLL_LESSONS.length} complete · excluded from Software percentage
                    </span>
                  </div>
                  <div className={styles.unitHeaderActions}><Link to="/blocks/fll" className={styles.unitHeaderLink}>Overview</Link></div>
                </div>
                <div className={styles.unitLessonRows}>
                  {FLL_UNITS.map((unit) => {
                    const lessons = FLL_LESSONS.filter((lesson) => lesson.unitSlug === unit.slug);
                    const done = lessons.filter((lesson) => isComplete(lesson.id)).length;
                    return <Link key={unit.id} to={unit.overviewPath} className={styles.lessonRow}><div className={styles.lessonCheck} aria-hidden="true">{done === lessons.length ? '✓' : '○'}</div><div className={styles.lessonInfo}><span className={styles.lessonLabel}>{unit.label}: {unit.title}</span><span className={styles.lessonUnit}>{done} of {lessons.length} complete</span></div><span className={styles.lessonStatus}>Open</span></Link>;
                  })}
                </div>
              </section>
            )}
          </div>

        </div>
      </main>
    </Layout>
  );
}
