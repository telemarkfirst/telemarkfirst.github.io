import React from 'react';
import styles from './SimulatorRunGuide.module.css';

export default function SimulatorRunGuide(): React.JSX.Element {
  return (
    <aside className={styles.guide} aria-label="How to run this simulator">
      <div className={styles.step}>
        <strong><span className={styles.number}>1.</span>Complete the code</strong>
        Work in fullscreen when you need more room for the editor and visualizer.
        {' '}Where file tabs are available, hover over the tab strip and choose + to create a file or reuse saved code.
      </div>
      <div className={styles.step}>
        <strong><span className={styles.number}>2.</span>Run the lifecycle</strong>
        Press Init, then Start. Use the available gamepad or scene controls.
      </div>
      <div className={styles.step}>
        <strong><span className={styles.number}>3.</span>Debug the behavior</strong>
        Check telemetry, motion, requirements, and hints before opening the answer.
      </div>
    </aside>
  );
}
