import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {signOut, type User} from 'firebase/auth';
import {
  cancelClassroomInvite,
  createTelemarkClassroom,
  getTelemarkClassroomDashboard,
  inviteStudentToClassroom,
  leaveTelemarkClassroom,
  removeStudentFromClassroom,
  respondToClassroomInvite,
  type CoachAccount,
  type CoachClassroomDashboard,
  type CoachClassroomView,
  type ClassroomProgress,
  type StudentAccount,
  type StudentClassroomDashboard,
  type StudentClassroomView,
} from '../../telemark/classroom';
import {
  summarizeClassroomProgress,
  type ClassroomTrackId,
} from '../../telemark/classroomProgress';
import {auth} from '../../telemark/firebase';
import styles from './ClassroomDashboard.module.css';

function errorMessage(reason: unknown, fallback: string): string {
  if (!(reason instanceof Error) || !reason.message.trim()) return fallback;
  return reason.message.replace(/^Firebase:\s*/i, '').replace(/^Functions:\s*/i, '');
}

function formatDate(value: string | null): string {
  if (!value) return 'Recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ProgressMeter({
  progress,
  track = 'overall',
  compact = false,
}: {
  progress: Pick<ClassroomProgress, 'completedLessons' | 'skippedLessons' | 'autoCompletedLessons'>;
  track?: ClassroomTrackId;
  compact?: boolean;
}): React.JSX.Element {
  const summary = summarizeClassroomProgress(progress, track);
  return (
    <div className={`${styles.progressMeter} ${compact ? styles.progressMeterCompact : ''}`}>
      <div className={styles.progressMeta}>
        <span>{summary.handled} / {summary.total} handled</span>
        <strong>{summary.percentage}%</strong>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={`${track} curriculum progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.percentage}
      >
        <span style={{width: `${summary.percentage}%`}} />
      </div>
      {!compact && (
        <p className={styles.progressBreakdown}>
          {summary.completed} completed
          {' · '}{summary.skipped} skipped
          {' · '}{summary.placement} placement
        </p>
      )}
    </div>
  );
}

function InviteForm({
  classroomId,
  onChanged,
}: {
  classroomId: string;
  onChanged: (message: string) => Promise<void>;
}): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError('Enter a student username.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const invited = await inviteStudentToClassroom(classroomId, username);
      setUsername('');
      await onChanged(`Invitation sent to @${invited.username}.`);
    } catch (reason) {
      setError(errorMessage(reason, 'The invitation could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.inviteForm} onSubmit={(event) => void invite(event)}>
      <label htmlFor={`invite-${classroomId}`}>Invite a student by username</label>
      <div className={styles.inlineForm}>
        <div className={styles.atInput}>
          <span aria-hidden="true">@</span>
          <input
            id={`invite-${classroomId}`}
            type="text"
            value={username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="student_username"
            onChange={(event) => {
              setUsername(event.target.value.replace(/^@/, '').toLowerCase());
              setError(null);
            }}
          />
        </div>
        <button type="submit" className={styles.primaryButton} disabled={saving}>
          {saving ? 'Sending' : 'Send invitation'}
        </button>
      </div>
      <p className={styles.formHint}>
        You can see the student's progress only after they accept.
      </p>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
    </form>
  );
}

function CoachClassroomCard({
  classroom,
  onChanged,
}: {
  classroom: CoachClassroomView;
  onChanged: (message: string) => Promise<void>;
}): React.JSX.Element {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelInvite(studentId: string, username: string) {
    setBusyKey(`invite:${studentId}`);
    setError(null);
    try {
      await cancelClassroomInvite(classroom.classroomId, studentId);
      await onChanged(`Invitation to @${username} cancelled.`);
    } catch (reason) {
      setError(errorMessage(reason, 'The invitation could not be cancelled.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function removeStudent(studentId: string, username: string) {
    if (!window.confirm(`Remove @${username} from ${classroom.name}? They can be invited again later.`)) {
      return;
    }
    setBusyKey(`student:${studentId}`);
    setError(null);
    try {
      await removeStudentFromClassroom(classroom.classroomId, studentId);
      await onChanged(`@${username} removed from ${classroom.name}.`);
    } catch (reason) {
      setError(errorMessage(reason, 'The student could not be removed.'));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className={styles.classroomCard} aria-labelledby={`classroom-${classroom.classroomId}`}>
      <header className={styles.classroomHeader}>
        <div>
          <p className={styles.eyebrow}>// classroom</p>
          <h2 id={`classroom-${classroom.classroomId}`}>{classroom.name}</h2>
          <p>
            {classroom.students.length} accepted
            {' · '}{classroom.pendingInvites.length} pending
            {' · '}created {formatDate(classroom.createdAt)}
          </p>
        </div>
      </header>

      <InviteForm classroomId={classroom.classroomId} onChanged={onChanged} />

      {classroom.pendingInvites.length > 0 && (
        <div className={styles.pendingBlock}>
          <h3>Pending invitations</h3>
          <div className={styles.pendingList}>
            {classroom.pendingInvites.map((invite) => (
              <div className={styles.pendingRow} key={invite.studentId}>
                <div>
                  <strong>@{invite.username}</strong>
                  <span>Sent {formatDate(invite.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={busyKey === `invite:${invite.studentId}`}
                  onClick={() => void cancelInvite(invite.studentId, invite.username)}
                >
                  {busyKey === `invite:${invite.studentId}` ? 'Cancelling' : 'Cancel'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.rosterBlock}>
        <h3>Student progress</h3>
        {classroom.students.length === 0 ? (
          <p className={styles.emptyState}>
            No students have accepted yet. Pending accounts remain private until they do.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.rosterTable}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Overall</th>
                  <th>Software</th>
                  <th>Mechanical</th>
                  <th><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {classroom.students.map((student) => (
                  <tr key={student.studentId}>
                    <th scope="row">
                      <strong>@{student.username}</strong>
                      <span>Joined {formatDate(student.joinedAt)}</span>
                    </th>
                    <td><ProgressMeter progress={student.progress} /></td>
                    <td><ProgressMeter progress={student.progress} track="software" compact /></td>
                    <td><ProgressMeter progress={student.progress} track="mechanical" compact /></td>
                    <td>
                      <button
                        type="button"
                        className={styles.textButton}
                        disabled={busyKey === `student:${student.studentId}`}
                        onClick={() => void removeStudent(student.studentId, student.username)}
                      >
                        {busyKey === `student:${student.studentId}` ? 'Removing' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
    </section>
  );
}

export function CoachDashboard({
  user,
  account,
}: {
  user: User;
  account: CoachAccount;
}): React.JSX.Element {
  const [dashboard, setDashboard] = useState<CoachClassroomDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classroomName, setClassroomName] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async (nextMessage?: string) => {
    try {
      const result = await getTelemarkClassroomDashboard();
      if (result.role !== 'coach') throw new Error('This account is not configured as a coach.');
      setDashboard(result);
      setError(null);
      if (nextMessage) setMessage(nextMessage);
    } catch (reason) {
      setError(errorMessage(reason, 'Your classrooms could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    const students = dashboard?.classrooms.flatMap((classroom) => classroom.students) ?? [];
    const pending = dashboard?.classrooms.reduce(
      (sum, classroom) => sum + classroom.pendingInvites.length,
      0,
    ) ?? 0;
    const average = students.length === 0 ? 0 : Math.round(
      students.reduce((sum, student) => (
        sum + summarizeClassroomProgress(student.progress).percentage
      ), 0) / students.length,
    );
    return {students: students.length, pending, average};
  }, [dashboard]);

  async function createClassroom(event: React.FormEvent) {
    event.preventDefault();
    if (!classroomName.trim()) {
      setError('Enter a classroom name.');
      return;
    }
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createTelemarkClassroom(classroomName);
      setClassroomName('');
      await refresh(`${created.name} created.`);
    } catch (reason) {
      setError(errorMessage(reason, 'The classroom could not be created.'));
    } finally {
      setCreating(false);
    }
  }

  async function handleChanged(nextMessage: string) {
    setMessage(null);
    await refresh(nextMessage);
  }

  return (
    <Layout title="Classroom Dashboard · Telemark" noFooter>
      <main className={styles.page}>
        <div className={styles.content}>
          <header className={styles.coachHero}>
            <div>
              <p className={styles.eyebrow}>// telemark.classroom</p>
              <h1>Coach dashboard</h1>
              <p className={styles.heroLead}>
                Signed in as <strong>@{account.username}</strong>. Invite students by
                username and monitor progress after they accept.
              </p>
              <p className={styles.verifiedEmail}>
                Verified email: {user.email ?? 'Google account'}
              </p>
            </div>
            <div className={styles.heroActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => void refresh()}>
                Refresh
              </button>
              <Link className={styles.secondaryLink} to="/personalize">Edit account</Link>
              <button className={styles.secondaryButton} type="button" onClick={() => void signOut(auth)}>
                Sign out
              </button>
            </div>
          </header>

          {loading ? (
            <div className={styles.loading} role="status">Loading classrooms</div>
          ) : (
            <>
              <section className={styles.stats} aria-label="Classroom summary">
                <div><strong>{dashboard?.classrooms.length ?? 0}</strong><span>Classrooms</span></div>
                <div><strong>{totals.students}</strong><span>Accepted students</span></div>
                <div><strong>{totals.pending}</strong><span>Pending invitations</span></div>
                <div><strong>{totals.average}%</strong><span>Average handled</span></div>
              </section>

              <section className={styles.createBlock} aria-labelledby="create-classroom-title">
                <div>
                  <p className={styles.eyebrow}>// classroom.new</p>
                  <h2 id="create-classroom-title">Create a classroom</h2>
                  <p>Use a team, class, or season name students will recognize.</p>
                </div>
                <form className={styles.inlineForm} onSubmit={(event) => void createClassroom(event)}>
                  <input
                    type="text"
                    value={classroomName}
                    maxLength={60}
                    placeholder="Team 30450 · Fall"
                    aria-label="Classroom name"
                    onChange={(event) => { setClassroomName(event.target.value); setError(null); }}
                  />
                  <button className={styles.primaryButton} type="submit" disabled={creating}>
                    {creating ? 'Creating' : 'Create'}
                  </button>
                </form>
              </section>

              {message && <p className={styles.successMessage} role="status">{message}</p>}
              {error && (
                <div className={styles.errorMessage} role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => void refresh()}>Retry</button>
                </div>
              )}

              {dashboard && dashboard.classrooms.length > 0 ? (
                <div className={styles.classroomList}>
                  {dashboard.classrooms.map((classroom) => (
                    <CoachClassroomCard
                      key={classroom.classroomId}
                      classroom={classroom}
                      onChanged={handleChanged}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.emptyPage}>
                  Create a classroom, then invite students using the usernames they chose during setup.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}

function StudentClassroomCard({
  classroom,
  onLeave,
  leaving,
}: {
  classroom: StudentClassroomView;
  onLeave: (classroom: StudentClassroomView) => Promise<void>;
  leaving: boolean;
}): React.JSX.Element {
  const ordered = [...classroom.students].sort((left, right) => {
    const difference = summarizeClassroomProgress(right.progress).handled
      - summarizeClassroomProgress(left.progress).handled;
    return difference || left.username.localeCompare(right.username);
  });

  return (
    <section className={styles.studentClassroom}>
      <header>
        <div>
          <h3>{classroom.name}</h3>
          <p>Coach @{classroom.coachUsername}. {classroom.students.length} students.</p>
        </div>
        <button
          type="button"
          className={styles.textButton}
          disabled={leaving}
          onClick={() => void onLeave(classroom)}
        >
          {leaving ? 'Leaving' : 'Leave classroom'}
        </button>
      </header>
      <div className={styles.classmateList}>
        {ordered.map((student) => {
          const summary = summarizeClassroomProgress(student.progress);
          return (
            <div
              className={`${styles.classmateRow} ${student.isCurrentUser ? styles.currentStudent : ''}`}
              key={student.username}
            >
              <div className={styles.classmateName}>
                <strong>@{student.username}</strong>
                {student.isCurrentUser && <span>You</span>}
              </div>
              <ProgressMeter progress={student.progress} compact />
              <span className={styles.classmateCount}>{summary.completed} completed</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StudentClassroomPanel({
  account,
}: {
  account: StudentAccount;
}): React.JSX.Element {
  const [dashboard, setDashboard] = useState<StudentClassroomDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (nextMessage?: string) => {
    try {
      const result = await getTelemarkClassroomDashboard();
      if (result.role !== 'student') throw new Error('This account is not configured as a student.');
      setDashboard(result);
      setError(null);
      if (nextMessage) setMessage(nextMessage);
    } catch (reason) {
      setError(errorMessage(reason, 'Classroom progress could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function respond(classroomId: string, response: 'accept' | 'decline') {
    setBusyKey(`invite:${classroomId}`);
    setError(null);
    setMessage(null);
    try {
      await respondToClassroomInvite(classroomId, response);
      await refresh(response === 'accept' ? 'Classroom joined.' : 'Invitation declined.');
    } catch (reason) {
      setError(errorMessage(reason, 'The invitation response could not be saved.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function leave(classroom: StudentClassroomView) {
    if (!window.confirm(`Leave ${classroom.name}? Your progress stays in your account.`)) return;
    setBusyKey(`classroom:${classroom.classroomId}`);
    setError(null);
    setMessage(null);
    try {
      await leaveTelemarkClassroom(classroom.classroomId);
      await refresh(`You left ${classroom.name}.`);
    } catch (reason) {
      setError(errorMessage(reason, 'The classroom could not be left.'));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className={styles.studentPanel} aria-labelledby="student-classroom-title">
      <header className={styles.studentPanelHeader}>
        <div>
          <p className={styles.eyebrow}>// classroom.progress</p>
          <h2 id="student-classroom-title">Your classrooms</h2>
          <p>Coaches find you as <strong>@{account.username}</strong>.</p>
        </div>
        <button className={styles.textButton} type="button" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </header>

      {loading && <p className={styles.panelStatus} role="status">Checking classroom invitations</p>}
      {message && <p className={styles.successMessage} role="status">{message}</p>}
      {error && <p className={styles.inlineError} role="alert">{error}</p>}

      {dashboard && dashboard.pendingInvites.length > 0 && (
        <div className={styles.studentInvites}>
          <h3>Invitations waiting for you</h3>
          {dashboard.pendingInvites.map((invite) => (
            <article className={styles.studentInvite} key={invite.classroomId}>
              <div>
                <strong>{invite.classroomName}</strong>
                <span>Coach @{invite.coachUsername}</span>
                <p>
                  If you accept, this coach and every accepted student in the classroom
                  can see your username and Telemark progress. This includes lessons marked
                  completed, skipped, or completed by placement.
                </p>
              </div>
              <div className={styles.inviteActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={busyKey === `invite:${invite.classroomId}`}
                  onClick={() => void respond(invite.classroomId, 'accept')}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={busyKey === `invite:${invite.classroomId}`}
                  onClick={() => void respond(invite.classroomId, 'decline')}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {dashboard && dashboard.classrooms.length > 0 ? (
        <div className={styles.studentClassroomList}>
          {dashboard.classrooms.map((classroom) => (
            <StudentClassroomCard
              key={classroom.classroomId}
              classroom={classroom}
              leaving={busyKey === `classroom:${classroom.classroomId}`}
              onLeave={leave}
            />
          ))}
        </div>
      ) : dashboard && dashboard.pendingInvites.length === 0 ? (
        <p className={styles.panelStatus}>
          You are not in a classroom yet. Give a coach your username. You must approve every invitation.
        </p>
      ) : null}
    </section>
  );
}
