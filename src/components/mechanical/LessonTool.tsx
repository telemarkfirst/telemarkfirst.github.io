import React from 'react';
import Link from '@docusaurus/Link';
import styles from './LessonTool.module.css';

/**
 * Frames a calculator inside a lesson.
 *
 * The Java simulators get a run guide telling the student what to do before
 * they touch the editor. The calculators had nothing: a lesson simply dropped
 * one into the page. This gives them the same three-part framing, and a link
 * out to the workbench where the tool can be used fullscreen alongside the
 * other eleven.
 */
export default function LessonTool({
  bring,
  change,
  read,
  toolId,
  children,
}: {
  /** What to measure or look up before entering anything. */
  bring: string;
  /** The input worth moving to see the relationship. */
  change: string;
  /** What the output actually tells them. */
  read: string;
  /** Catalogue id, so the workbench opens on this tool. */
  toolId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const steps: [string, string][] = [
    ['Bring', bring],
    ['Change', change],
    ['Read', read],
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.guide}>
        {steps.map(([title, body], index) => (
          <div className={styles.step} key={title}>
            <span className={styles.stepNum} aria-hidden="true">{index + 1}</span>
            <span className={styles.stepBody}>
              <strong className={styles.stepTitle}>{title}</strong>
              {body}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.tool}>{children}</div>

      <p className={styles.footerRow}>
        <span>Values are not saved. Nothing is sent anywhere.</span>
        <Link to={`/simulator#${toolId}`}>Open in the workbench</Link>
      </p>
    </div>
  );
}
