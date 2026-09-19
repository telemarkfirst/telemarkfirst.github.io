import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {CHANGELOG, formatChangeDate} from '@site/src/telemark/changelog';
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
              <div className={styles.meta}>
                <p className={styles.version}>Version {entry.version}</p>
                <time dateTime={entry.date} className={styles.date}>
                  {formatChangeDate(entry.date)}
                </time>
                <span className={styles.kind}>{entry.kind}</span>
              </div>

              <div>
                <h2 className={styles.entryTitle}>{entry.title}</h2>
                <p className={styles.body}>{entry.body}</p>
                <ul className={styles.additions}>
                  {entry.additions.map((addition) => (
                    <li key={addition}>{addition}</li>
                  ))}
                </ul>
                {entry.href && (
                  <Link className={styles.go} to={entry.href}>
                    Open this addition
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </main>
    </Layout>
  );
}
