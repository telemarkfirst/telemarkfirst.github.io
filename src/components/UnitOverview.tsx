import React from 'react';
import Link from '@docusaurus/Link';
import { useAuth } from '@site/src/telemark/useAuth';
import { useProgress } from '@site/src/telemark/useProgress';
import {
  getAnyLessonsForUnit,
  getAnyUnitBySlug,
} from '@site/src/telemark/tracks';
import MarkUnitComplete from './MarkUnitComplete';
import styles from './UnitOverview.module.css';

interface UnitOverviewProps {
  unitSlug: string;
}

export default function UnitOverview({
  unitSlug,
}: UnitOverviewProps): React.JSX.Element | null {
  const unit = getAnyUnitBySlug(unitSlug);
  const lessons = getAnyLessonsForUnit(unitSlug);
  const { user } = useAuth();
  const { isComplete } = useProgress(user);

  if (!unit) {
    return null;
  }

  const completedCount = lessons.filter((lesson) => isComplete(lesson.id)).length;
  const nextLesson = lessons.find((lesson) => !isComplete(lesson.id));
  const progressPercent = Math.round((completedCount / lessons.length) * 100);
  const status =
    completedCount === lessons.length
      ? 'Complete'
      : completedCount === 0
        ? 'Not Started'
        : 'In Progress';

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>
              {unit.label}: {unit.title}
            </h1>
            <p className={styles.subtitle}>
              {unit.overview}
            </p>
          </div>
          <span className={styles.tag}>{unit.tier}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{lessons.length}</span>
            <span className={styles.statLabel}>Lessons</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedCount}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{status}</span>
            <span className={styles.statLabel}>Current Status</span>
          </div>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{width: `${progressPercent}%`}} />
        </div>

        <div className={styles.actions}>
          <Link
            to={nextLesson?.path ?? unit.startPath}
            className={styles.primaryAction}
          >
            {nextLesson ? `Resume ${nextLesson.label}` : 'Review Unit'}
          </Link>
          <Link to="/dashboard" className={styles.secondaryAction}>
            Open Dashboard
          </Link>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Lesson Roadmap</h2>
          <div className={styles.lessonList}>
            {lessons.map((lesson) => {
              const done = isComplete(lesson.id);
              const lessonBadge = lesson.label.includes('Coding Challenge')
                ? 'CC'
                : lesson.label.split(' ·')[0];
              return (
                <Link
                  key={lesson.id}
                  to={lesson.path}
                  className={`${styles.lessonCard} ${done ? styles.lessonCardDone : ''}`}
                >
                  <span className={styles.lessonIndex} aria-hidden="true">
                    {done ? '✓' : lessonBadge}
                  </span>
                  <span className={styles.lessonText}>
                    <span className={styles.lessonLabel}>{lesson.label}</span>
                    <span className={styles.lessonTitle}>{lesson.title}</span>
                  </span>
                  <span className={styles.lessonStatus}>
                    {done ? 'Complete' : 'Open'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>What This Unit Covers</h2>
          <div className={styles.outcomeList}>
            {unit.outcomes.map((outcome) => (
              <div key={outcome} className={styles.outcomeItem}>
                {outcome}
              </div>
            ))}
          </div>

          <div className={styles.coachNote}>
            Review the sequence and goals here, then resume at your first
            incomplete lesson.
          </div>
        </div>
      </section>

      <MarkUnitComplete unitSlug={unitSlug} />
    </>
  );
}
