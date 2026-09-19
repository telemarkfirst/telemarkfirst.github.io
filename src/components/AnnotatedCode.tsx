import React, {useState} from 'react';
import CodeBlock from '@theme/CodeBlock';
import styles from './AnnotatedCode.module.css';

export type AnnotatedCodeProps = {
  java: string;
  python?: string;
  title?: string;
  pythonNote?: string;
};

export default function AnnotatedCode({
  java,
  python,
  title,
  pythonNote = 'Concept comparison only. FTC robot programs still use Java.',
}: AnnotatedCodeProps): React.JSX.Element {
  const [showPython, setShowPython] = useState(false);
  const language = showPython && python ? 'python' : 'java';
  const source = showPython && python ? python : java;

  return (
    <section className={styles.shell} aria-label={title ?? 'Annotated code example'}>
      {(title || python) && (
        <div className={styles.bar}>
          <span className={styles.title}>{title}</span>
          {python && (
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={showPython}
              aria-label={showPython ? 'Show the Java example' : 'Compare this example with Python'}
              title={showPython ? 'Show Java' : 'Conceptual Python comparison'}
              onClick={() => setShowPython((current) => !current)}
            >
              {showPython ? 'Show Java' : 'Compare Python'}
            </button>
          )}
        </div>
      )}
      <CodeBlock language={language}>{source}</CodeBlock>
      {showPython && python && <p className={styles.note}>{pythonNote}</p>}
    </section>
  );
}
