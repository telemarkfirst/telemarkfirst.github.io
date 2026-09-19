import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import {getTrack, type TrackId} from '@site/src/telemark/tracks';
import type {Tier} from '@site/src/telemark/curriculum';
import {useLearnerProfile} from '@site/src/telemark/useLearnerProfile';
import {BLOCKS_LESSONS, BLOCKS_UNITS} from '@site/src/telemark/blocksCurriculum';
import {FLL_LESSONS, FLL_UNITS} from '@site/src/telemark/fllCurriculum';
import styles from './TrackOverview.module.css';

const MOBILE_UNIT_PREVIEW_COUNT = 5;

const TIER_CLASS: Record<Tier, string> = {
  Beginner: styles.tagBeginner,
  Intermediate: styles.tagIntermediate,
  Advanced: styles.tagAdvanced,
};

interface TrackOverviewProps {
  trackId: TrackId;
  /** Optional pointer to the other track, rendered at the bottom of the page. */
  companionTrackId?: TrackId;
  companionNote?: string;
}

/**
 * Landing grid for an entire track, rendered inside the docs layout so the
 * sidebar stays available. Progress comes from the browser for guests and is
 * also synchronized for a signed-in learner.
 */
export default function TrackOverview({
  trackId,
  companionTrackId,
  companionNote,
}: TrackOverviewProps): React.JSX.Element {
  const track = getTrack(trackId);
  const companion = companionTrackId ? getTrack(companionTrackId) : null;
  const {user} = useAuth();
  const {isComplete} = useProgress(user);
  const {profile, status: profileStatus} = useLearnerProfile();
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [blocksOpen, setBlocksOpen] = useState(true);

  useEffect(() => {
    if (trackId !== 'software' || profileStatus !== 'ready' || !profile) return;
    setBlocksOpen(profile.blocksPlacement !== 'auto_completed');
  }, [trackId, profileStatus, profile]);

  const noun = trackId === 'mechanical' ? 'Module' : 'Unit';

  const completedLessons = track.lessons.filter((lesson) =>
    isComplete(lesson.id),
  ).length;

  const firstIncomplete = track.lessons.find((lesson) => !isComplete(lesson.id));

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.title}>{track.label}</h1>
        <p className={styles.subtitle}>{track.tagline}</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{track.unitCount}</span>
            <span className={styles.statLabel}>{noun}s</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{track.lessonCount}</span>
            <span className={styles.statLabel}>Lessons</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedLessons}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
        </div>

        <div className={styles.actions}>
          <Link
            to={firstIncomplete?.path ?? track.units[0].startPath}
            className={styles.primaryAction}
          >
            {firstIncomplete && completedLessons > 0
              ? `Resume ${firstIncomplete.label}`
              : `Start ${track.units[0].label}`}
          </Link>
          <Link to="/dashboard" className={styles.secondaryAction}>
            Open Dashboard
          </Link>
        </div>
      </section>

      {trackId === 'software' && (
        <section className={styles.foundations}>
          <button
            type="button"
            className={styles.foundationsToggle}
            aria-expanded={blocksOpen}
            onClick={() => setBlocksOpen((current) => !current)}
          >
            <span aria-hidden="true">{blocksOpen ? '▾' : '▸'}</span>
            <span className={styles.foundationsText}>
              <strong>Blocks Foundations</strong>
              <small>
                {BLOCKS_LESSONS.filter((lesson) => isComplete(lesson.id)).length}
                {' / '}{BLOCKS_LESSONS.length} lessons complete
              </small>
            </span>
          </button>
          {blocksOpen && (
            <div className={styles.grid}>
              {BLOCKS_UNITS.map((unit) => {
                const unitLessons = BLOCKS_LESSONS.filter((lesson) => lesson.unitSlug === unit.slug);
                const done = unitLessons.filter((lesson) => isComplete(lesson.id)).length;
                return (
                  <Link key={unit.id} to={unit.overviewPath} className={styles.card}>
                    <span className={styles.cardNum}>Blocks {unit.label}</span>
                    <span className={styles.cardTitle}>{unit.title}</span>
                    <span className={styles.cardDesc}>{unit.desc}</span>
                    <span className={styles.cardMeta}>
                      <span className={`${styles.tag} ${done === unitLessons.length ? styles.tagDone : styles.tagProgress}`}>
                        {done} of {unitLessons.length} complete
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      <h2 className={styles.sectionTitle}>{noun}s</h2>

      <div className={styles.grid} id={`${track.id}-unit-list`}>
        {track.units.map((unit, index) => {
          const unitLessons = track.lessons.filter(
            (lesson) => lesson.unitSlug === unit.slug,
          );
          const done = unitLessons.filter((lesson) =>
            isComplete(lesson.id),
          ).length;
          const status =
            done === 0
              ? null
              : done === unitLessons.length
                ? 'Complete'
                : `${done} of ${unitLessons.length} done`;

          const body = (
            <>
              <span className={styles.cardNum}>{unit.label}</span>
              <span className={styles.cardTitle}>{unit.title}</span>
              <span className={styles.cardDesc}>{unit.desc}</span>
              <span className={styles.cardMeta}>
                <span className={`${styles.tag} ${TIER_CLASS[unit.tier]}`}>
                  {unit.tier}
                </span>
                <span className={`${styles.tag} ${styles.tagProgress}`}>
                  {unit.lessonCount} lessons
                </span>
                {status && (
                  <span
                    className={`${styles.tag} ${
                      status === 'Complete' ? styles.tagDone : styles.tagProgress
                    }`}
                  >
                    {status}
                  </span>
                )}
              </span>
            </>
          );

          return (
            <div
              key={unit.id}
              className={
                index >= MOBILE_UNIT_PREVIEW_COUNT && !showAllMobile
                  ? styles.mobileCurriculumExtra
                  : ''
              }
            >
              <Link
                to={unit.overviewPath}
                className={styles.card}
              >
                {body}
              </Link>
            </div>
          );
        })}
      </div>
      {track.units.length > MOBILE_UNIT_PREVIEW_COUNT && (
        <button
          type="button"
          className={styles.mobileCurriculumToggle}
          aria-expanded={showAllMobile}
          aria-controls={`${track.id}-unit-list`}
          onClick={() => setShowAllMobile((current) => !current)}
        >
          {showAllMobile
            ? `Show fewer ${noun.toLowerCase()}s`
            : `Show all ${track.unitCount} ${noun.toLowerCase()}s`}
        </button>
      )}

      {trackId === 'blocks' && (
        <section className={styles.foundations}>
          <div className={styles.foundationsText}>
            <strong>FLL Challenge Extension</strong>
            <small>
              {FLL_LESSONS.filter((lesson) => isComplete(lesson.id)).length}
              {' / '}{FLL_LESSONS.length} optional lessons complete
            </small>
          </div>
          <div className={styles.grid}>
            {FLL_UNITS.map((unit) => {
              const lessons = FLL_LESSONS.filter((lesson) => lesson.unitSlug === unit.slug);
              const done = lessons.filter((lesson) => isComplete(lesson.id)).length;
              return (
                <Link key={unit.id} to={unit.overviewPath} className={styles.card}>
                  <span className={styles.cardNum}>{unit.label}</span>
                  <span className={styles.cardTitle}>{unit.title}</span>
                  <span className={styles.cardDesc}>{unit.desc}</span>
                  <span className={styles.cardMeta}><span className={`${styles.tag} ${done === lessons.length ? styles.tagDone : styles.tagProgress}`}>{done} of {lessons.length} complete</span></span>
                </Link>
              );
            })}
          </div>
          <div className={styles.actions}><Link to="/blocks/fll" className={styles.secondaryAction}>Open FLL Challenge extension</Link></div>
        </section>
      )}

      {companion && (
        <div className={styles.switcher}>
          <p className={styles.switcherTitle}>Looking for the {companion.shortLabel.toLowerCase()} side?</p>
          <p className={styles.switcherDesc}>
            {companionNote ?? companion.tagline}
          </p>
          <Link to={companion.indexPath} className={styles.secondaryAction}>
            Open the {companion.label}
          </Link>
        </div>
      )}
    </>
  );
}
