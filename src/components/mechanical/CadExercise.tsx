import React, {useState} from 'react';
import styles from './CadExercise.module.css';

export interface CadExerciseProps {
  number: string;
  title: string;
  difficulty: 'Starter' | 'Intermediate' | 'Advanced';
  minutes: number;
  brief: string;
  /** Hard numbers the model must hit, so the result is checkable. */
  requirements: string[];
  /** Self-check items the student ticks off. State is local and not saved. */
  acceptance: string[];
  /** The mistake this exercise is designed to provoke and teach. */
  trap: string;
}

/**
 * A CAD practice exercise with a checkable acceptance list.
 *
 * The exercises are written so that a student can tell for themselves whether
 * they succeeded, which is the property a practice problem needs and a vague
 * "model a bracket" prompt lacks.
 */
export default function CadExercise({
  number,
  title,
  difficulty,
  minutes,
  brief,
  requirements,
  acceptance,
  trap,
}: CadExerciseProps): React.JSX.Element {
  const [checked, setChecked] = useState<boolean[]>(() => acceptance.map(() => false));
  const done = checked.filter(Boolean).length;
  const complete = done === acceptance.length && acceptance.length > 0;

  const difficultyClass =
    difficulty === 'Starter'
      ? styles.starter
      : difficulty === 'Intermediate'
        ? styles.intermediate
        : styles.advanced;

  return (
    <section className={styles.exercise}>
      <div className={styles.header}>
        <span className={styles.number}>Exercise {number}</span>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.meta}>
          <span className={`${styles.badge} ${difficultyClass}`}>{difficulty}</span>
          <span className={`${styles.badge} ${styles.time}`}>{minutes} min</span>
        </span>
      </div>

      <div className={styles.body}>
        <p className={styles.brief}>{brief}</p>

        <p className={styles.sectionLabel}>Requirements</p>
        <ul className={styles.list}>
          {requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className={styles.sectionLabel}>Check your own work</p>
        <div className={styles.checkList}>
          {acceptance.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`${styles.checkItem} ${checked[index] ? styles.checkItemDone : ''}`}
              aria-pressed={checked[index]}
              onClick={() =>
                setChecked((current) =>
                  current.map((value, i) => (i === index ? !value : value)),
                )
              }
            >
              <span className={styles.box} aria-hidden="true">
                {checked[index] ? '✓' : ''}
              </span>
              <span>{item}</span>
            </button>
          ))}
        </div>

        <p className={`${styles.progress} ${complete ? styles.progressDone : ''}`}>
          {done} of {acceptance.length} checks passed
          {complete ? ' // exercise complete' : ''}
        </p>

        <p className={styles.trap}>
          <strong>What this exercise is really testing: </strong>
          {trap}
        </p>
      </div>
    </section>
  );
}
