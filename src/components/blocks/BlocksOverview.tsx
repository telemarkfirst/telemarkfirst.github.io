import React from 'react';
import Link from '@docusaurus/Link';
import {BLOCKS_LESSONS, BLOCKS_UNITS} from '@site/src/telemark/blocksCurriculum';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import styles from './BlocksOverview.module.css';

export default function BlocksOverview(): React.JSX.Element {
  const {user} = useAuth();
  const {isComplete} = useProgress(user);
  const completed = BLOCKS_LESSONS.filter((lesson) => isComplete(lesson.id)).length;
  const nextLesson = BLOCKS_LESSONS.find((lesson) => !isComplete(lesson.id));

  return <>
    <section className={styles.hero}>
      <h1 className={styles.title}>Programming Foundations with Blocks</h1>
      <p className={styles.subtitle}>Learn core programming skills before FTC Java.</p>
      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statValue}>{BLOCKS_UNITS.length}</span><span className={styles.statLabel}>Units</span></div>
        <div className={styles.stat}><span className={styles.statValue}>{BLOCKS_LESSONS.length}</span><span className={styles.statLabel}>Lessons</span></div>
        <div className={styles.stat}><span className={styles.statValue}>{completed}</span><span className={styles.statLabel}>Completed</span></div>
      </div>
      <div className={styles.actions}>
        <Link className={styles.primaryAction} to={nextLesson?.path ?? BLOCKS_UNITS[0].startPath}>
          {completed ? 'Resume Blocks' : 'Start Unit 0'}
        </Link>
        <Link className={styles.secondaryAction} to="/docs/unit-00/classes-and-objects">Start FTC Java</Link>
      </div>
    </section>
    <h2 className={styles.sectionTitle}>Units</h2>
    <div className={styles.grid}>
      {BLOCKS_UNITS.map((unit) => {
        const lessons = BLOCKS_LESSONS.filter((lesson) => lesson.unitSlug === unit.slug);
        const done = lessons.filter((lesson) => isComplete(lesson.id)).length;
        return <Link key={unit.id} to={unit.startPath} className={styles.card}>
          <span className={styles.cardNum}>{unit.label}</span>
          <span className={styles.cardTitle}>{unit.title}</span>
          <span className={styles.cardDesc}>{unit.desc}</span>
          <span className={styles.cardMeta}>
            <span className={`${styles.tag} ${done === lessons.length ? styles.tagDone : styles.tagProgress}`}>
              {done} of {lessons.length} complete
            </span>
          </span>
        </Link>;
      })}
    </div>
  </>;
}
