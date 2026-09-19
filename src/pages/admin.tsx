import React, {useCallback, useEffect, useMemo, useState} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import {signOut} from 'firebase/auth';
import {auth} from '../telemark/firebase';
import {useAuth} from '../telemark/useAuth';
import {signInWithGoogle} from '../telemark/googleAuth';
import {
  fetchAdminMetrics,
  type AdminMetrics,
  type MetricsRange,
} from '../telemark/adminMetrics';
import styles from './admin.module.css';

const RANGES: MetricsRange[] = ['7d', '28d', '90d'];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function formatDateKey(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  const date = new Date(
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
    ),
  );
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'}).format(date);
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}): React.JSX.Element {
  return (
    <article className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      {detail && <span className={styles.statDetail}>{detail}</span>}
    </article>
  );
}

function TrendChart({metrics}: {metrics: AdminMetrics}): React.JSX.Element {
  const maximum = Math.max(
    1,
    ...metrics.trend.flatMap((day) => [
      day.visitors,
      day.sessions,
      day.signUps,
      day.lessonCompletions,
    ]),
  );

  return (
    <div className={styles.chartScroller}>
      <div className={styles.chart} style={{minWidth: `${Math.max(680, metrics.trend.length * 25)}px`}}>
        {metrics.trend.map((day, index) => (
          <div className={styles.chartDay} key={day.date} title={`${formatDateKey(day.date)}
Visitors: ${day.visitors}
Sessions: ${day.sessions}
Sign-ups: ${day.signUps}
Lesson completions: ${day.lessonCompletions}`}>
            <div className={styles.chartBars}>
              <span
                className={`${styles.chartBar} ${styles.visitorsBar}`}
                style={{height: `${Math.max(2, (day.visitors / maximum) * 100)}%`}}
              />
              <span
                className={`${styles.chartBar} ${styles.sessionsBar}`}
                style={{height: `${Math.max(2, (day.sessions / maximum) * 100)}%`}}
              />
              <span
                className={`${styles.chartBar} ${styles.signupsBar}`}
                style={{height: `${Math.max(2, (day.signUps / maximum) * 100)}%`}}
              />
              <span
                className={`${styles.chartBar} ${styles.completionsBar}`}
                style={{height: `${Math.max(2, (day.lessonCompletions / maximum) * 100)}%`}}
              />
            </div>
            {(index === 0 || index === metrics.trend.length - 1 || index % 7 === 0) && (
              <span className={styles.chartDate}>{formatDateKey(day.date)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958C4.672 5.163 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}

export default function AdminPage(): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const {user, loading: authLoading} = useAuth();
  const [range, setRange] = useState<MetricsRange>('28d');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configuredAdmin = typeof siteConfig.customFields?.adminEmail === 'string'
    ? siteConfig.customFields.adminEmail.trim().toLowerCase()
    : '';
  const isAdmin = Boolean(
    configuredAdmin
    && user?.email?.trim().toLowerCase() === configuredAdmin
    && user.emailVerified,
  );

  const loadMetrics = useCallback(async () => {
    if (!isAdmin) return;
    setMetricsLoading(true);
    setError(null);
    try {
      setMetrics(await fetchAdminMetrics(range));
    } catch (caught) {
      console.error('Admin metrics request failed:', caught);
      setError('The metrics service could not be reached. Check the function configuration and try again.');
    } finally {
      setMetricsLoading(false);
    }
  }, [isAdmin, range]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const engagedActionCount = useMemo(() => {
    if (!metrics) return 0;
    return (
      metrics.actions.logins +
      metrics.actions.signUps +
      metrics.actions.curriculumStarts +
      metrics.actions.lessonCompletions +
      metrics.actions.unitCompletions +
      metrics.actions.simulatorLaunches +
      metrics.actions.simulatorFullscreen
    );
  }, [metrics]);

  async function handleAdminSignIn() {
    setError(null);
    try {
      await signInWithGoogle({trackAnalytics: false, syncProgress: false});
    } catch (caught) {
      console.error('Admin sign-in failed:', caught);
      setError('Google sign-in did not complete. Please try again.');
    }
  }

  const shell = (content: React.ReactNode) => (
    <Layout title="Admin Analytics · Telemark" noFooter>
      <main className={styles.page}>
        {content}
      </main>
    </Layout>
  );

  if (authLoading) {
    return shell(<div className={styles.centerCard}>Checking authorization…</div>);
  }

  if (!configuredAdmin) {
    return shell(
      <section className={styles.loginCard}>
        <h1>Analytics Console Unavailable</h1>
        <p>Administrator access has not been configured for this deployment.</p>
      </section>,
    );
  }

  if (!user) {
    return shell(
      <section className={styles.loginCard}>
        <h1>Analytics Console</h1>
        <p>Sign in with the authorized Telemark administrator account.</p>
        <button className={styles.googleButton} onClick={handleAdminSignIn}>
          <GoogleIcon />
          Continue with Google
        </button>
        {error && <p className={styles.errorText}>{error}</p>}
      </section>,
    );
  }

  if (!isAdmin) {
    return shell(
      <section className={styles.loginCard}>
        <h1>Not Authorized</h1>
        <p>This Google account does not have access to Telemark analytics.</p>
        <button className={styles.secondaryButton} onClick={() => signOut(auth)}>
          Sign out and try another account
        </button>
      </section>,
    );
  }

  return shell(
    <div className={styles.content}>
      <header className={styles.header}>
        <div>
          <h1>Usage Intelligence</h1>
          <p className={styles.headerSub}>
            Anonymous traffic and aggregate curriculum progress. No learner identities are exposed.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.rangePicker} aria-label="Reporting range">
            {RANGES.map((option) => (
              <button
                type="button"
                key={option}
                className={range === option ? styles.rangeActive : ''}
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <button className={styles.secondaryButton} onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>

      {metrics?.warnings.map((warning) => (
        <div className={styles.warning} key={warning}>{warning}</div>
      ))}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => void loadMetrics()}>Retry</button>
        </div>
      )}

      {metricsLoading && !metrics ? (
        <div className={styles.centerCard}>Loading aggregate reports…</div>
      ) : metrics ? (
        <>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>01</span><h2>Audience</h2></div>
              <p>People who viewed and used the website during this range.</p>
            </div>
            <div className={styles.statGrid}>
              <StatCard label="Estimated visitors" value={formatNumber(metrics.traffic.totalUsers)} detail="GA4 browser identities" />
              <StatCard label="Curriculum users" value={formatNumber(metrics.traffic.curriculumUsers)} detail="Opened curriculum content" />
              <StatCard label="Active visitors" value={formatNumber(metrics.traffic.activeUsers)} detail="Viewed and engaged" />
              <StatCard label="New visitors" value={formatNumber(metrics.traffic.newUsers)} />
              <StatCard label="Sessions" value={formatNumber(metrics.traffic.sessions)} />
              <StatCard label="Page views" value={formatNumber(metrics.traffic.pageViews)} />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>02</span><h2>Engagement</h2></div>
              <p>Meaningful sessions and tracked actions across Telemark.</p>
            </div>
            <div className={styles.statGrid}>
              <StatCard label="Engaged sessions" value={formatNumber(metrics.traffic.engagedSessions)} />
              <StatCard label="Engagement rate" value={formatPercent(metrics.traffic.engagementRate)} />
              <StatCard label="Average session" value={formatDuration(metrics.traffic.averageSessionDuration)} />
              <StatCard label="Tracked actions" value={formatNumber(engagedActionCount)} />
              <StatCard label="Simulator launches" value={formatNumber(metrics.actions.simulatorLaunches)} />
              <StatCard label="Lesson completions" value={formatNumber(metrics.actions.lessonCompletions)} />
            </div>
          </section>

          <section className={styles.splitSection}>
            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div><span>03</span><h2>Verified Accounts</h2></div>
              </div>
              <div className={styles.statGridCompact}>
                <StatCard label="Google accounts" value={formatNumber(metrics.accounts.totalAccounts)} />
                <StatCard label={`Created in ${range}`} value={formatNumber(metrics.accounts.newAccounts)} />
                <StatCard label="Cloud progress" value={formatNumber(metrics.learning.accountsWithProgress)} />
              </div>
            </div>
            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div><span>04</span><h2>Synced Learning</h2></div>
              </div>
              <div className={styles.statGridCompact}>
                <StatCard label="Started learners" value={formatNumber(metrics.learning.startedLearners)} />
                <StatCard label="Average completion" value={formatPercent(metrics.learning.averageCompletionRate)} />
                <StatCard label="Finished curriculum" value={formatNumber(metrics.learning.fullyCompletedLearners)} />
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div><span>05</span><h2>Daily Trends</h2></div>
              <div className={styles.legend}>
                <i className={styles.visitorsDot} />Visitors
                <i className={styles.sessionsDot} />Sessions
                <i className={styles.signupsDot} />Accounts
                <i className={styles.completionsDot} />Completions
              </div>
            </div>
            <TrendChart metrics={metrics} />
          </section>

          <section className={styles.tableGrid}>
            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div><span>06</span><h2>Top Content</h2></div>
              </div>
              {metrics.topPages.length === 0 ? (
                <p className={styles.empty}>No page data is available for this range.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead><tr><th>Page</th><th>Views</th><th>Users</th></tr></thead>
                    <tbody>
                      {metrics.topPages.map((page) => (
                        <tr key={`${page.path}-${page.title}`}>
                          <td><strong>{page.title || page.path}</strong><small>{page.path}</small></td>
                          <td>{formatNumber(page.pageViews)}</td>
                          <td>{formatNumber(page.activeUsers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div><span>07</span><h2>Unit Completion</h2></div>
              </div>
              <div className={styles.unitList}>
                {metrics.learning.units.map((unit) => (
                  <div className={styles.unitRow} key={unit.slug}>
                    <div>
                      <strong>{unit.label}</strong>
                      <span>{unit.learnersCompleted} learners completed</span>
                    </div>
                    <div className={styles.unitTrack}>
                      <span style={{width: `${Math.min(100, unit.averageCompletionRate * 100)}%`}} />
                    </div>
                    <b>{formatPercent(unit.averageCompletionRate)}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className={styles.reportFooter}>
            Generated {new Date(metrics.generatedAt).toLocaleString()} · Aggregate reporting only
          </footer>
        </>
      ) : null}
    </div>,
  );
}
