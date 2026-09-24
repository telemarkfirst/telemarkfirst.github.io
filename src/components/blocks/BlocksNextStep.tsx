import React from 'react';
import {useHistory} from '@docusaurus/router';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import {CURRICULUM_LESSONS} from '@site/src/telemark/curriculum';
import {trackEvent} from '@site/src/telemark/analytics';
import {useBasePath} from '@site/src/telemark/useBasePath';
import styles from './BlocksNextStep.module.css';

export default function BlocksNextStep(): React.JSX.Element {
  const {user} = useAuth();
  const {isComplete} = useProgress(user);
  const history = useHistory();
  const basePath = useBasePath();
  const firstJavaLesson = CURRICULUM_LESSONS.find((lesson) => !isComplete(lesson.id))
    ?? CURRICULUM_LESSONS[0];

  function choose(choice: 'python' | 'java' | 'fll') {
    trackEvent('blocks_exit_choice', {choice});
    history.push(basePath(choice === 'java'
      ? firstJavaLesson.path
      : choice === 'fll' ? '/blocks/fll' : '/blocks/python-resources'));
  }

  return (
    <div className={styles.choices}>
      <section className={styles.choice}>
        <p className={styles.label}>Robotics extension</p>
        <h2>Program an FLL robot</h2>
        <p>Apply these blocks to SPIKE Prime movement, sensors, attachments, and autonomous missions in a 3D practice field.</p>
        <button className={styles.secondary} type="button" onClick={() => choose('fll')}>
          Open FLL Challenge
        </button>
      </section>
      <section className={styles.choice}>
        <p className={styles.label}>Telemark path</p>
        <h2>Start FTC Java</h2>
        <p>Use the same ideas with Java syntax, the FTC SDK, and robot simulators.</p>
        <button className={styles.primary} type="button" onClick={() => choose('java')}>
          Continue to Java
        </button>
      </section>
      <section className={styles.choice}>
        <p className={styles.label}>Optional practice</p>
        <h2>Try Python first</h2>
        <p>Practice text-based programming in a general-purpose language, then return when you are ready for FTC Java.</p>
        <button className={styles.secondary} type="button" onClick={() => choose('python')}>
          Compare Python resources
        </button>
      </section>
    </div>
  );
}

export function BlocksJavaContinue(): React.JSX.Element {
  const {user} = useAuth();
  const {isComplete} = useProgress(user);
  const history = useHistory();
  const basePath = useBasePath();
  const firstJavaLesson = CURRICULUM_LESSONS.find((lesson) => !isComplete(lesson.id))
    ?? CURRICULUM_LESSONS[0];

  function continueToJava() {
    trackEvent('blocks_exit_choice', {choice: 'java'});
    history.push(basePath(firstJavaLesson.path));
  }

  return (
    <button className={styles.primary} type="button" onClick={continueToJava}>
      Continue to FTC Java
    </button>
  );
}
