import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {useHistory, useLocation} from '@docusaurus/router';
import Layout from '@theme/Layout';
import {signOut} from 'firebase/auth';
import {auth} from '@site/src/telemark/firebase';
import {useAuth} from '@site/src/telemark/useAuth';
import {useLearnerProfile} from '@site/src/telemark/useLearnerProfile';
import {
  profileDestination,
  type LearnerProfile,
  type SoftwareLevel,
} from '@site/src/telemark/profile';
import type {MainTrackId} from '@site/src/telemark/tracks';
import {BLOCKS_LESSONS} from '@site/src/telemark/blocksCurriculum';
import {useProgress} from '@site/src/telemark/useProgress';
import {trackEvent} from '@site/src/telemark/analytics';
import {useBasePath} from '@site/src/telemark/useBasePath';
import {personalizationBypassKey} from '@site/src/components/PersonalizationGate';
import styles from './personalize.module.css';

const LEVELS: Array<{id: SoftwareLevel; title: string; description: string}> = [
  {
    id: 'complete_beginner',
    title: 'Complete beginner',
    description: 'I have not built a program yet, or I do not know variables, decisions, and loops.',
  },
  {
    id: 'block_experience',
    title: 'Block coding experience',
    description: 'I have built projects with blocks and know variables, conditions, and loops.',
  },
  {
    id: 'text_experience',
    title: 'Text-code experience',
    description: 'I can write a small program in Python, JavaScript, Java, or another language.',
  },
];

function safeNext(search: string): string | null {
  const value = new URLSearchParams(search).get('next');
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export default function PersonalizePage(): React.JSX.Element {
  const {user, loading: authLoading} = useAuth();
  const {profile, status, error: profileError, saveProfile} = useLearnerProfile();
  const {markManyAutoComplete, clearAutoCompleted} = useProgress(user);
  const [tracks, setTracks] = useState<MainTrackId[]>([]);
  const [softwareLevel, setSoftwareLevel] = useState<SoftwareLevel | null>(null);
  const [blockExperienceChoice, setBlockExperienceChoice] = useState<'python' | 'java' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const history = useHistory();
  const location = useLocation();
  const basePath = useBasePath();
  const next = safeNext(location.search);

  useEffect(() => {
    if (initialized.current || status !== 'ready' || !profile) return;
    initialized.current = true;
    setTracks(profile.selectedTracks);
    setSoftwareLevel(profile.softwareLevel ?? null);
    setBlockExperienceChoice(
      profile.softwareLevel === 'block_experience'
        && (profile.postBlocksChoice === 'python' || profile.postBlocksChoice === 'java')
        ? profile.postBlocksChoice
        : null,
    );
  }, [profile, status]);

  function toggleTrack(track: MainTrackId) {
    setTracks((current) => current.includes(track)
      ? current.filter((item) => item !== track)
      : [...current, track]);
    if (track === 'software' && tracks.includes('software')) setSoftwareLevel(null);
    setError(null);
  }

  async function save() {
    if (!user) return;
    if (tracks.length === 0) {
      setError('Choose Software, Mechanical, or both.');
      return;
    }
    if (tracks.includes('software') && !softwareLevel) {
      setError('Choose the software level that best matches your current experience.');
      return;
    }
    if (softwareLevel === 'block_experience' && !blockExperienceChoice) {
      setError('Choose the optional Python bridge or continue directly to FTC Java.');
      return;
    }

    const nextProfile: LearnerProfile = {
      version: 1,
      selectedTracks: tracks,
      ...(tracks.includes('software') ? {
        softwareLevel: softwareLevel!,
        blocksPlacement: softwareLevel === 'complete_beginner'
          ? 'required' as const
          : 'auto_completed' as const,
      } : {}),
      ...(softwareLevel === 'block_experience'
        ? {postBlocksChoice: blockExperienceChoice!}
        : profile?.postBlocksChoice ? {postBlocksChoice: profile.postBlocksChoice} : {}),
      onboardingComplete: true,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile(nextProfile);
      const blockIds = BLOCKS_LESSONS.map((lesson) => lesson.id);
      if (saved.blocksPlacement === 'auto_completed') {
        await markManyAutoComplete(blockIds);
      } else if (saved.blocksPlacement === 'required') {
        await clearAutoCompleted(blockIds);
      }
      window.sessionStorage.removeItem(personalizationBypassKey(user.uid));
      trackEvent('personalization_complete', {
        tracks: saved.selectedTracks.join(','),
        software_level: saved.softwareLevel ?? 'not_selected',
        blocks_exit_choice: saved.softwareLevel === 'block_experience'
          ? saved.postBlocksChoice ?? 'not_selected'
          : 'not_applicable',
      });
      history.push(basePath(profileDestination(saved)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your learning path.');
    } finally {
      setSaving(false);
    }
  }

  function continueWithoutProfile() {
    if (!user) return;
    window.sessionStorage.setItem(personalizationBypassKey(user.uid), '1');
    const baseRoot = basePath('/').replace(/\/$/, '');
    const destination = next && baseRoot && next.startsWith(`${baseRoot}/`)
      ? next.slice(baseRoot.length)
      : next ?? '/dashboard';
    history.push(basePath(destination));
  }

  if (authLoading || status === 'loading') {
    return <Layout title="Personalize · Telemark"><main className={styles.page}>Loading your account...</main></Layout>;
  }

  if (!user) {
    return (
      <Layout title="Personalize · Telemark">
        <main className={styles.page}>
          <section className={styles.card}>
            <h1>Sign in to save a learning path</h1>
            <p>The same lessons and local progress remain available without an account.</p>
            <Link className={styles.primary} to="/login">Sign in with Google</Link>
          </section>
        </main>
      </Layout>
    );
  }

  return (
    <Layout title="Your Learning Path · Telemark" description="Choose the Telemark curricula that match your role and experience.">
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>{profile ? 'Edit your learning path' : 'Set up your learning path'}</h1>
          <p className={styles.intro}>Choose the work you want to learn. You can change this later without losing completed lessons.</p>

          <fieldset className={styles.fieldset}>
            <legend>Which areas do you want to learn?</legend>
            <div className={styles.options}>
              {([
                ['software', 'Software', 'Programming, the FTC SDK, sensors, and autonomous code.'],
                ['mechanical', 'Mechanical', 'Design, CAD, fabrication, mechanisms, wiring, and testing.'],
              ] as const).map(([id, title, description]) => (
                <label key={id} className={`${styles.option} ${tracks.includes(id) ? styles.selected : ''}`}>
                  <input type="checkbox" checked={tracks.includes(id)} onChange={() => toggleTrack(id)} />
                  <span><strong>{title}</strong><small>{description}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          {tracks.includes('software') && (
            <fieldset className={styles.fieldset}>
              <legend>What programming experience do you have?</legend>
              <div className={styles.options}>
                {LEVELS.map((level) => (
                  <label key={level.id} className={`${styles.option} ${softwareLevel === level.id ? styles.selected : ''}`}>
                    <input type="radio" name="software-level" checked={softwareLevel === level.id} onChange={() => { setSoftwareLevel(level.id); setError(null); }} />
                    <span><strong>{level.title}</strong><small>{level.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {softwareLevel === 'block_experience' && (
            <fieldset className={`${styles.fieldset} ${styles.bridge}`}>
              <legend>How confident are you about moving to text code?</legend>
              <p className={styles.bridgeIntro}>Python is an optional bridge. It can make the change from blocks easier, but FTC robot programs still use Java.</p>
              <div className={styles.options}>
                <label className={`${styles.option} ${blockExperienceChoice === 'python' ? styles.selected : ''}`}>
                  <input type="radio" name="blocks-next-step" checked={blockExperienceChoice === 'python'} onChange={() => { setBlockExperienceChoice('python'); setError(null); }} />
                  <span>
                    <strong>Optional Python bridge <span className={styles.recommended}>Recommended if unsure</span></strong>
                    <small>Choose this if you understand blocks but are not completely confident typing variables, conditions, loops, and functions.</small>
                  </span>
                </label>
                <label className={`${styles.option} ${blockExperienceChoice === 'java' ? styles.selected : ''}`}>
                  <input type="radio" name="blocks-next-step" checked={blockExperienceChoice === 'java'} onChange={() => { setBlockExperienceChoice('java'); setError(null); }} />
                  <span><strong>Go directly to FTC Java</strong><small>Choose this if you are ready to learn Java syntax while building robot programs.</small></span>
                </label>
              </div>
            </fieldset>
          )}

          {(error || profileError) && <p className={styles.error} role="alert">{error ?? profileError}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving...' : profile ? 'Save learning path' : 'Start learning'}
            </button>
            {profile ? (
              <Link className={styles.secondary} to="/dashboard">Cancel</Link>
            ) : (
              <button type="button" className={styles.secondary} onClick={continueWithoutProfile}>Not now</button>
            )}
            <button type="button" className={styles.secondary} onClick={() => void signOut(auth)}>Sign out</button>
          </div>
        </section>
      </main>
    </Layout>
  );
}
