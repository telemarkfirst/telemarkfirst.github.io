import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import styles from './search.module.css';

interface SearchEntry {
  title: string;
  label: string;
  path: string;
  track: 'blocks' | 'software' | 'mechanical';
  unit: number | null;
  excerpt: string;
}

export default function SearchPage(): React.JSX.Element {
  const entries = usePluginData('telemark-search') as SearchEntry[];
  const location = useLocation();
  const [query, setQuery] = useState(
    () => new URLSearchParams(location.search).get('q') ?? '',
  );
  const normalized = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalized.length < 2) return [];
    return entries
      .filter((entry) => (
        `${entry.title} ${entry.label} ${entry.excerpt}`.toLowerCase().includes(normalized)
      ))
      .slice(0, 30);
  }, [entries, normalized]);

  return (
    <Layout title="Search · Telemark" description="Search Telemark FTC software, Blocks, and mechanical lessons.">
      <main className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Search lessons</h1>

          <label htmlFor="telemark-search" className={styles.searchLabel}>
            Topic or term
          </label>
          <input
            id="telemark-search"
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “encoder”, “hardwareMap”, or “field-centric drive”"
            autoComplete="off"
          />

          {normalized.length >= 2 && (
            <p className={styles.status} role="status" aria-live="polite">
              {results.length === 0
                ? 'No lessons found.'
                : `${results.length} result${results.length === 1 ? '' : 's'}`}
            </p>
          )}

          {normalized.length >= 2 && results.length === 0 && (
            <p className={styles.empty}>
              Try a broader term.
            </p>
          )}

          <div className={styles.results}>
            {results.map((entry) => {
              return (
                <Link className={styles.result} to={entry.path} key={entry.path}>
                  <div className={styles.resultHeader}>
                    <h2 className={styles.resultTitle}>{entry.title}</h2>
                    <span className={styles.badge}>
                      {entry.track === 'mechanical'
                        ? 'Mechanical'
                        : entry.track === 'blocks' ? 'Software · Blocks' : 'Software'}
                    </span>
                  </div>
                  <p className={styles.path}>{entry.path}</p>
                  {entry.excerpt && (
                    <p className={styles.excerpt}>{entry.excerpt}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </Layout>
  );
}
