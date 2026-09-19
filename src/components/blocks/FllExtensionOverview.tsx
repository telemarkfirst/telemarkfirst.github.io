import React from 'react';
import Link from '@docusaurus/Link';
import {FLL_LESSONS, FLL_UNITS} from '@site/src/telemark/fllCurriculum';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import styles from '../TrackOverview.module.css';

export default function FllExtensionOverview(): React.JSX.Element {
  const {user} = useAuth();
  const {isComplete} = useProgress(user);
  const completed = FLL_LESSONS.filter((lesson) => isComplete(lesson.id)).length;
  const firstIncomplete = FLL_LESSONS.find((lesson) => !isComplete(lesson.id));
  return <>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>// blocks.extension.fll</p>
      <h1 className={styles.title}>FLL Challenge with SPIKE Prime</h1>
      <p className={styles.subtitle}>Apply Blocks foundations to movement, sensors, attachments, and reliable autonomous missions.</p>
      <div className={styles.stats}><div className={styles.stat}><span className={styles.statValue}>3</span><span className={styles.statLabel}>Units</span></div><div className={styles.stat}><span className={styles.statValue}>15</span><span className={styles.statLabel}>Lessons</span></div><div className={styles.stat}><span className={styles.statValue}>{completed}</span><span className={styles.statLabel}>Completed</span></div></div>
      <div className={styles.actions}><Link className={styles.primaryAction} to={firstIncomplete?.path ?? FLL_UNITS[0].startPath}>{completed ? 'Resume FLL extension' : 'Start FLL Unit 0'}</Link><Link className={styles.secondaryAction} to="/blocks">Blocks Foundations</Link></div>
    </section>
    <h2 className={styles.sectionTitle}>FLL extension units</h2>
    <div className={styles.grid}>{FLL_UNITS.map((unit) => { const lessons = FLL_LESSONS.filter((lesson) => lesson.unitSlug === unit.slug); const done = lessons.filter((lesson) => isComplete(lesson.id)).length; return <Link key={unit.id} to={unit.overviewPath} className={styles.card}><span className={styles.cardNum}>{unit.label}</span><span className={styles.cardTitle}>{unit.title}</span><span className={styles.cardDesc}>{unit.desc}</span><span className={styles.cardMeta}><span className={`${styles.tag} ${done === lessons.length ? styles.tagDone : styles.tagProgress}`}>{done} of {lessons.length} complete</span></span></Link>; })}</div>
  </>;
}
