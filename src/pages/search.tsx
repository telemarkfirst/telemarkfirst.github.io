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

type TrackFilter = 'all' | 'software' | 'mechanical';

const TRACK_FILTERS: {value: TrackFilter; label: string}[] = [
  {value: 'all', label: 'All'},
  {value: 'software', label: 'Software'},
  {value: 'mechanical', label: 'Mechanical'},
];

export default function SearchPage(): React.JSX.Element {
  const entries = usePluginData('telemark-search') as SearchEntry[];
  const location = useLocation();
  const [query, setQuery] = useState(
    () => new URLSearchParams(location.search).get('q') ?? '',
  );
  const [track, setTrack] = useState<TrackFilter>('all');
  const normalized = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (normalized.length < 2) return [];
    return entries
      .filter((entry) => track === 'all'
        || entry.track === track
        || (track === 'software' && entry.track === 'blocks'))
      .filter((entry) => (
        `${entry.title} ${entry.label} ${entry.excerpt}`.toLowerCase().includes(normalized)
      ))
      .slice(0, 30);
  }, [entries, normalized, track]);

  return (
    <Layout title="Search · Telemark" description="Search Telemark FTC software and engineering lessons.">
      <main className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.title}>Find a Telemark lesson</h1>
          <p className={styles.intro}>
            Search lesson titles and text across every open Telemark curriculum.
          </p>

          <label htmlFor="telemark-search" className="sr-only">Search lessons</label>
          <input
            id="telemark-search"
            className={styles.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “encoder”, “hardwareMap”, or “field centric”"
            autoComplete="off"
            autoFocus
          />

          <div className={styles.trackFilter} role="group" aria-label="Filter by track">
            {TRACK_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.trackButton} ${
                  track === option.value ? styles.trackButtonActive : ''
                }`}
                aria-pressed={track === option.value}
                onClick={() => setTrack(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className={styles.status} role="status" aria-live="polite">
            {normalized.length < 2
              ? 'Enter at least two characters.'
              : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </p>

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
