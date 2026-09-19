import React, { useEffect, useState } from 'react';
import Link from '@docusaurus/Link';
import { useAuth } from '@site/src/telemark/useAuth';
import { useProgress } from '@site/src/telemark/useProgress';
import { getAnyLessonsForUnit, getAnyUnitBySlug } from '@site/src/telemark/tracks';
import styles from '@site/src/components/HomepageFeatures/MarkComplete.module.css';

interface MarkUnitCompleteProps {
  unitSlug: string;
}

export default function MarkUnitComplete({
  unitSlug,
}: MarkUnitCompleteProps): React.JSX.Element | null {
  const unit = getAnyUnitBySlug(unitSlug);
  const lessons = getAnyLessonsForUnit(unitSlug);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const codingChallenge = lessons.find((lesson) => lesson.label.includes('Coding Challenge'));

  const { user } = useAuth();
  const { isComplete, markManyComplete, unmarkMany } = useProgress(user);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(lessonIds.every((lessonId) => isComplete(lessonId)));

  useEffect(() => {
    setDone(lessonIds.every((lessonId) => isComplete(lessonId)));
  }, [isComplete, lessonIds]);

  if (!unit) {
    return null;
  }

  async function handleMarkAllComplete() {
    setSaving(true);
    try {
      await markManyComplete(lessonIds);
      setDone(true);
    } catch (e) {
      console.error('Telemark unit save failed:', e);
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnmarkUnit() {
    setSaving(true);
    try {
      await unmarkMany(lessonIds);
      setDone(false);
    } catch (e) {
      console.error('Telemark unit unmark failed:', e);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successHeader}>
          <span className={styles.successIcon} aria-hidden="true">✓</span>
          <span className={styles.successTitle}>{unit.label} Complete</span>
          <span className={styles.savedBadge}>
            {user ? 'synced to your account' : 'saved on this device'}
          </span>
        </div>
        <p className={styles.successMsg}>
          This unit is marked complete. Move on when you are ready.
        </p>
        <div className={styles.successActions}>
          <Link to={unit.nextPath} className={styles.nextBtn}>
            Proceed to {unit.nextLabel} →
          </Link>
          <button
            type="button"
            className={styles.unmarkBtn}
            onClick={handleUnmarkUnit}
            disabled={saving}
          >
            {saving ? 'Updating...' : 'Unmark unit'}
          </button>
        </div>
      </div>
    );
  }

  if (codingChallenge) {
    return (
      <div className={styles.completeBox}>
        <div className={styles.completeInner}>
          <div className={styles.completeText}>
            <p className={styles.completeTitle}>Already know this unit?</p>
            <p className={styles.completeDesc}>
              Complete the comprehensive coding challenge to prove every unit objective and jump directly to {unit.nextLabel}.
            </p>
          </div>
          <Link to={codingChallenge.path} className={styles.nextBtn}>
            Take the Coding Challenge →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.completeBox}>
      <div className={styles.completeInner}>
        <div className={styles.completeText}>
          <p className={styles.completeTitle}>Need to move faster?</p>
          <p className={styles.completeDesc}>
            Mark every lesson in {unit.label} complete, save it {user ? 'to your account' : 'on this device'}, and jump straight to {unit.nextLabel}.
          </p>
        </div>
        <button
          className={styles.completeBtn}
          onClick={handleMarkAllComplete}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Mark All Complete'}
        </button>
      </div>
    </div>
  );
}
