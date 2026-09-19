import React, { useEffect, useState } from 'react';
import Link from '@docusaurus/Link';
import { useAuth } from '@site/src/telemark/useAuth';
import { useProgress } from '@site/src/telemark/useProgress';
import { getAnyLessonsForUnit } from '@site/src/telemark/tracks';
import styles from './MarkComplete.module.css';

interface MarkCompleteProps {
  lessonId: string;       // e.g. 'unit-01/prerequisites'
  nextUnit: string;       // e.g. '/docs/unit-01/install-jdk'
  nextUnitName: string;   // e.g. 'Section 2: Installing JDK 17'
  completesUnit?: string; // e.g. 'unit-08' for a comprehensive coding challenge
}

export default function MarkComplete({
  lessonId,
  nextUnit,
  nextUnitName,
  completesUnit,
}: MarkCompleteProps): React.JSX.Element {
  const { user }                     = useAuth();
  const {
    isComplete,
    isSkipped,
    markComplete,
    markManyComplete,
    markSkipped,
    unmarkComplete,
    unmarkMany,
    unskip,
  } = useProgress(user);
  const [saving, setSaving]          = useState(false);
  const [done, setDone]              = useState(isComplete(lessonId));
  const [skipped, setSkipped]        = useState(isSkipped(lessonId));
  const unitLessonIds = completesUnit
    ? getAnyLessonsForUnit(completesUnit).map((lesson) => lesson.id)
    : [];

  useEffect(() => {
    setDone(isComplete(lessonId));
    setSkipped(isSkipped(lessonId));
  }, [isComplete, isSkipped, lessonId]);

  async function handleComplete() {
    setSaving(true);
    try {
      if (completesUnit) {
        await markManyComplete(unitLessonIds);
      } else {
        await markComplete(lessonId);
      }
      setDone(true);
    } catch (e) {
      console.error('Telemark save failed:', e);
      // Still let the user proceed even if save fails
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmark() {
    setSaving(true);
    try {
      if (completesUnit) {
        await unmarkMany(unitLessonIds);
      } else {
        await unmarkComplete(lessonId);
      }
      setDone(false);
    } catch (e) {
      console.error('Telemark unmark failed:', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await markSkipped(lessonId);
      setSkipped(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnskip() {
    setSaving(true);
    try {
      await unskip(lessonId);
      setSkipped(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Completed ─────────────────────────────────────────────
  if (done) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successHeader}>
          <span className={styles.successIcon} aria-hidden="true">✓</span>
          <span className={styles.successTitle}>
            {completesUnit ? 'Unit Mastered' : 'Lesson Complete'}
          </span>
          <span className={styles.savedBadge}>
            {user ? 'synced to your account' : 'saved on this device'}
          </span>
        </div>
        <p className={styles.successMsg}>
          {completesUnit
            ? 'Every unit objective is covered. Your full unit progress is complete.'
            : 'Nice work. Hold yourself to it: there are no shortcuts in competition.'}
        </p>
        <div className={styles.successActions}>
          <Link to={nextUnit} className={styles.nextBtn}>Proceed to {nextUnitName} →</Link>
          <button className={styles.actionBtn} onClick={handleUnmark} disabled={saving}>
            {completesUnit ? 'Reset unit progress' : 'Unmark'}
          </button>
        </div>
      </div>
    );
  }

  if (skipped) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successHeader}>
          <span className={styles.successTitle}>Section Skipped</span>
          <span className={styles.savedBadge}>
            {user ? 'synced to your account' : 'saved on this device'}
          </span>
        </div>
        <p className={styles.successMsg}>You can come back to this section whenever you are ready.</p>
        <div className={styles.successActions}>
          <Link to={nextUnit} className={styles.nextBtn}>Continue to {nextUnitName} →</Link>
          <button className={styles.actionBtn} onClick={handleUnskip} disabled={saving}>Resume section</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.completeBox}>
      <div className={styles.completeInner}>
        <div className={styles.completeText}>
          <p className={styles.completeTitle}>
            {completesUnit ? 'Passed every challenge check?' : 'Ready to move on?'}
          </p>
          <p className={styles.completeDesc}>
            {completesUnit
              ? 'Mark the unit mastered to record every lesson objective and continue directly to the next unit. '
              : 'Only mark complete if you genuinely understand the material. '}
            Your progress will be {user ? 'synced to your account' : 'saved in this browser'}.
          </p>
        </div>
        <button
          className={styles.completeBtn}
          onClick={handleComplete}
          disabled={saving}
        >
          {saving ? 'Saving...' : completesUnit ? 'Mark Unit Mastered' : 'Mark as Complete'}
        </button>
        {!completesUnit && (
          <button className={styles.actionBtn} onClick={handleSkip} disabled={saving}>
            Skip section
          </button>
        )}
      </div>
    </div>
  );
}
