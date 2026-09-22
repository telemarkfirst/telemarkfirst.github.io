import React from 'react';
import Layout from '@theme/Layout';
import {CHANGELOG} from '@site/src/telemark/changelog';
import styles from './changelog.module.css';

export default function Changelog(): React.JSX.Element {
  return (
    <Layout
      title="Changelog"
      description="Additions to the Telemark curriculum, simulators, and learning tools."
    >
      <main className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>Changelog</h1>
        </header>

        <ol className={styles.list}>
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className={styles.entry}>
              <h2 className={styles.entryTitle}>
                {entry.version}: {entry.title}
              </h2>
              <p className={styles.body}>{entry.body}</p>
            </li>
          ))}
        </ol>
      </main>
    </Layout>
  );
}
