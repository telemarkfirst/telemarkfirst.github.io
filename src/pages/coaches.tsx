import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {CURRICULUM_LESSONS, CURRICULUM_UNITS} from '../telemark/curriculum';
import {MECHANICAL_LESSONS, MECHANICAL_UNITS} from '../telemark/mechanical';
import {
  getCoachAssessments,
  type CoachAssessment,
} from '../telemark/coachAssessments';
import type {MainTrackId} from '../telemark/tracks';
import styles from './coaches.module.css';

const ASSESSMENTS = getCoachAssessments(
  [...CURRICULUM_UNITS, ...MECHANICAL_UNITS],
  [...CURRICULUM_LESSONS, ...MECHANICAL_LESSONS],
);

const GROUPS: Array<{
  id: MainTrackId;
  label: string;
  note: string;
  assessments: CoachAssessment[];
}> = [
  {
    id: 'software',
    label: 'Advanced Software',
    note: 'Architecture, computer vision, and full autonomous integration.',
    assessments: ASSESSMENTS.filter((assessment) => assessment.track === 'software'),
  },
  {
    id: 'mechanical',
    label: 'Advanced Mechanical',
    note: 'Mechanism design, evidence-based iteration, readiness, and design defense.',
    assessments: ASSESSMENTS.filter((assessment) => assessment.track === 'mechanical'),
  },
];

function AssessmentCard({assessment}: {assessment: CoachAssessment}): React.JSX.Element {
  const {unit, masteryLesson} = assessment;

  return (
    <article className={styles.assessmentCard} id={`coach-${unit.slug}`}>
      <header className={styles.assessmentHeader}>
        <div>
          <p className={styles.unitLabel}>{unit.label}</p>
          <h3>{unit.title}</h3>
          <p className={styles.unitDescription}>{unit.desc}</p>
        </div>
        <div className={styles.assessmentMeta} aria-label="Assessment details">
          <span>Advanced</span>
          <span>{assessment.timebox}</span>
          <span>{assessment.format}</span>
        </div>
      </header>

      <div className={styles.assignRow}>
        <div>
          <strong>Start with the existing mastery assessment</strong>
          <span>{masteryLesson.title}</span>
        </div>
        <div className={styles.assignActions}>
          <Link to={masteryLesson.path} className={styles.primaryAction}>
            Open student test
          </Link>
          <Link to={unit.overviewPath} className={styles.secondaryAction}>
            Review objectives
          </Link>
        </div>
      </div>

      <section className={styles.extension} aria-labelledby={`${unit.slug}-extension`}>
        <p className={styles.sectionLabel}>// coach.extension</p>
        <h4 id={`${unit.slug}-extension`}>Ask for one step beyond the built-in check</h4>
        <p>{assessment.extension}</p>
      </section>

      <div className={styles.reviewGrid}>
        <section aria-labelledby={`${unit.slug}-evidence`}>
          <h4 id={`${unit.slug}-evidence`}>Collect this evidence</h4>
          <ul>
            {assessment.evidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section aria-labelledby={`${unit.slug}-criteria`}>
          <h4 id={`${unit.slug}-criteria`}>Review for</h4>
          <ul>
            {assessment.reviewCriteria.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>
    </article>
  );
}

export default function CoachesPage(): React.JSX.Element {
  return (
    <Layout
      title="Coach Assessments · Telemark"
      description="Advanced FTC software and mechanical assessment briefs for coaches."
    >
      <main className={styles.page}>
        <div className={styles.content}>
          <section className={styles.hero}>
            <div>
              <h1>Advanced assessment library</h1>
              <p className={styles.heroLead}>
                Assign a current Telemark mastery test, then use a coach-led
                extension to hear the reasoning that an automatic check cannot
                see. Each brief names the evidence to collect and the decisions
                worth discussing with the student.
              </p>
              <div className={styles.heroActions}>
                <a href="#software-assessments" className={styles.primaryAction}>
                  Software tests
                </a>
                <a href="#mechanical-assessments" className={styles.secondaryAction}>
                  Mechanical tests
                </a>
                <button
                  type="button"
                  className={styles.printAction}
                  onClick={() => window.print()}
                >
                  Print briefs
                </button>
              </div>
            </div>
            <aside className={styles.heroNote}>
              <strong>One assessment, two kinds of evidence</strong>
              <p>
                Built-in mastery checks remain the source of truth for lesson
                completion. Coach extensions add demonstrations, artifacts,
                and technical explanations without inventing a separate score.
              </p>
            </aside>
          </section>

          <section className={styles.workflow} aria-labelledby="coach-workflow-title">
            <div>
              <p className={styles.sectionLabel}>// assignment.workflow</p>
              <h2 id="coach-workflow-title">Run a focused check</h2>
              <p>
                The student does the work. The coach chooses the evidence that
                makes understanding visible.
              </p>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div><strong>Assign</strong><p>Open the student test and share its lesson URL.</p></div>
              </li>
              <li>
                <span>02</span>
                <div><strong>Observe</strong><p>Use the extension prompt after the built-in check.</p></div>
              </li>
              <li>
                <span>03</span>
                <div><strong>Review</strong><p>Compare the submitted evidence with the three review criteria.</p></div>
              </li>
            </ol>
          </section>

          {GROUPS.map((group) => (
            <section
              key={group.id}
              className={styles.trackSection}
              id={`${group.id}-assessments`}
              aria-labelledby={`${group.id}-assessments-title`}
            >
              <header className={styles.trackHeader}>
                <div>
                  <p className={styles.sectionLabel}>// {group.id}.advanced[]</p>
                  <h2 id={`${group.id}-assessments-title`}>{group.label}</h2>
                  <p>{group.note}</p>
                </div>
                <span className={styles.trackCount}>
                  {group.assessments.length} assessment{group.assessments.length === 1 ? '' : 's'}
                </span>
              </header>

              <div className={styles.assessmentList}>
                {group.assessments.map((assessment) => (
                  <AssessmentCard key={assessment.unitSlug} assessment={assessment} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </Layout>
  );
}
