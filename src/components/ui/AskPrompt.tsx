import React from 'react';
import styles from './AskPanel.module.css';

/** Event the launcher listens for, so the footer opens the existing chat. */
export const OPEN_ASK = 'telemark:open-ask';

/**
 * The invitation at the foot of a lesson.
 *
 * This used to be a second copy of the chat panel, which meant a lesson page
 * carried two independent conversations: type in one and the other never saw
 * it, and both wrote their own entries into the history. It opens the one in
 * the corner instead, so there is a single thread per lesson.
 */
export default function AskPrompt(): React.JSX.Element {
  return (
    <section className={styles.panel}>
      <p className={styles.title}>Stuck on this lesson?</p>
      <p className={styles.blurb}>
        Ask about anything on this page. It can see which lesson you have open
        and which part you are reading.
      </p>
      <button
        type="button"
        className={styles.signIn}
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_ASK))}
      >
        Ask about this lesson
      </button>
    </section>
  );
}
