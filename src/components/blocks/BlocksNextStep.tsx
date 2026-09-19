import React, {useState} from 'react';
import {useHistory} from '@docusaurus/router';
import {useAuth} from '@site/src/telemark/useAuth';
import {useLearnerProfile} from '@site/src/telemark/useLearnerProfile';
import {useProgress} from '@site/src/telemark/useProgress';
import {CURRICULUM_LESSONS} from '@site/src/telemark/curriculum';
import {trackEvent} from '@site/src/telemark/analytics';
import {useBasePath} from '@site/src/telemark/useBasePath';
import styles from './BlocksNextStep.module.css';

export default function BlocksNextStep(): React.JSX.Element {
  const {user} = useAuth();
  const {profile, saveProfile} = useLearnerProfile();
  const {isComplete} = useProgress(user);
  const history = useHistory();
  const basePath = useBasePath();
  const [saving, setSaving] = useState<'python' | 'java' | 'fll' | null>(null);
  const firstJavaLesson = CURRICULUM_LESSONS.find((lesson) => !isComplete(lesson.id))
    ?? CURRICULUM_LESSONS[0];

  async function choose(choice: 'python' | 'java' | 'fll') {
    if (saving) return;
    setSaving(choice);
    try {
      if (user && profile) await saveProfile({...profile, postBlocksChoice: choice});
      trackEvent('blocks_exit_choice', {choice});
    } catch (error) {
      console.warn('Telemark could not save the blocks exit choice:', error);
    } finally {
      setSaving(null);
      history.push(basePath(choice === 'java'
        ? firstJavaLesson.path
        : choice === 'fll' ? '/blocks/fll' : '/blocks/python-resources'));
    }
  }

  return (
    <div className={styles.choices}>
      <section className={styles.choice}>
        <p className={styles.label}>Robotics extension</p>
        <h2>Program an FLL robot</h2>
        <p>Apply these blocks to SPIKE Prime movement, sensors, attachments, and autonomous missions in a 3D practice field.</p>
        <button className={styles.secondary} type="button" disabled={saving !== null} onClick={() => void choose('fll')}>
          {saving === 'fll' ? 'Saving...' : 'Open FLL Challenge'}
        </button>
      </section>
      <section className={styles.choice}>
        <p className={styles.label}>Telemark path</p>
        <h2>Start FTC Java</h2>
        <p>Use the same ideas with Java syntax, the FTC SDK, and robot simulators.</p>
        <button className={styles.primary} type="button" disabled={saving !== null} onClick={() => void choose('java')}>
          {saving === 'java' ? 'Saving...' : 'Continue to Java'}
        </button>
      </section>
      <section className={styles.choice}>
        <p className={styles.label}>Optional practice</p>
        <h2>Try Python first</h2>
        <p>Practice text-based programming in a general-purpose language, then return when you are ready for FTC Java.</p>
        <button className={styles.secondary} type="button" disabled={saving !== null} onClick={() => void choose('python')}>
          {saving === 'python' ? 'Saving...' : 'Compare Python resources'}
        </button>
      </section>
    </div>
  );
}

export function BlocksJavaContinue(): React.JSX.Element {
  const {user} = useAuth();
  const {profile, saveProfile} = useLearnerProfile();
  const {isComplete} = useProgress(user);
  const history = useHistory();
  const basePath = useBasePath();
  const [saving, setSaving] = useState(false);
  const firstJavaLesson = CURRICULUM_LESSONS.find((lesson) => !isComplete(lesson.id))
    ?? CURRICULUM_LESSONS[0];

  async function continueToJava() {
    if (saving) return;
    setSaving(true);
    try {
      if (user && profile) await saveProfile({...profile, postBlocksChoice: 'java'});
      trackEvent('blocks_exit_choice', {choice: 'java'});
    } catch (error) {
      console.warn('Telemark could not save the blocks exit choice:', error);
    } finally {
      setSaving(false);
      history.push(basePath(firstJavaLesson.path));
    }
  }

  return (
    <button className={styles.primary} type="button" disabled={saving} onClick={() => void continueToJava()}>
      {saving ? 'Saving...' : 'Continue to FTC Java'}
    </button>
  );
}
