import type {CurriculumLesson, CurriculumUnit} from './curriculum';
import type {MainTrackId} from './tracks';

export interface CoachAssessmentBrief {
  unitSlug: string;
  track: MainTrackId;
  format: string;
  timebox: string;
  extension: string;
  evidence: readonly [string, string, string];
  reviewCriteria: readonly [string, string, string];
}

export interface CoachAssessment extends CoachAssessmentBrief {
  unit: CurriculumUnit;
  masteryLesson: CurriculumLesson;
}

/**
 * Coach-led extensions for every Advanced unit in the two main tracks.
 *
 * The existing mastery lesson remains the graded source of truth. These briefs
 * add the live explanation, artifact review, and failure reasoning that a
 * simulator or multiple-choice check cannot observe on its own.
 */
export const COACH_ASSESSMENT_BRIEFS: readonly CoachAssessmentBrief[] = [
  {
    unitSlug: 'unit-13',
    track: 'software',
    format: 'Coding simulator + architecture review',
    timebox: '45 to 60 minutes',
    extension:
      'Ask the student to add one mechanism to the cumulative robot project, expose only the commands TeleOp and autonomous need, and explain why each hardware field belongs in that class.',
    evidence: [
      'A passing result from the Unit 13 mastery challenge.',
      'A runnable multi-file project with the new mechanism mapped in one place.',
      'A short walkthrough that traces one driver input to one hardware write.',
    ],
    reviewCriteria: [
      'Hardware ownership is clear, and OpModes do not reach into private device state.',
      'Update and stop behavior leaves every actuator in a safe state.',
      'The student can defend when composition is preferable to inheritance.',
    ],
  },
  {
    unitSlug: 'unit-14',
    track: 'software',
    format: 'Coding simulator + vision test review',
    timebox: '45 to 60 minutes',
    extension:
      'Have the student define three vision trials: a clear target, a partly occluded target, and changed lighting. They should predict each result, state the safe fallback for invalid data, and explain how they would tune the system from the observations.',
    evidence: [
      'A passing result from the Unit 14 mastery challenge.',
      'A small trial table containing the condition, prediction, observation, and next change.',
      'The code path that validates detections and closes vision resources.',
    ],
    reviewCriteria: [
      'No pose or zone result is used before its validity is checked.',
      'The proposed zones or thresholds are tied to measured image conditions.',
      'Processor and camera lifecycle decisions preserve robot resources safely.',
    ],
  },
  {
    unitSlug: 'unit-15',
    track: 'software',
    format: 'Coding simulator + autonomous defense',
    timebox: '60 to 90 minutes',
    extension:
      'Give the student a mid-route vision-loss scenario. Ask them to show where the Ivy command routine continues, waits, or falls back, then defend how the scheduler avoids blocking follower and subsystem updates.',
    evidence: [
      'A passing result from the Unit 15 mastery challenge.',
      'A state diagram that names motion, mechanism, and recovery transitions.',
      'A walkthrough of the vision-loss path from the failed result to cleanup.',
    ],
    reviewCriteria: [
      'Follower and robot updates continue on every active loop.',
      'Vision corrections are validated before they change the global pose.',
      'Every terminal path stops mechanisms and releases vision resources.',
    ],
  },
  {
    unitSlug: 'module-08',
    track: 'mechanical',
    format: 'Design quiz + mechanism review',
    timebox: '45 to 60 minutes',
    extension:
      'Provide a payload, reach, and cycle-time target. Ask the student to choose an arm or slide architecture, size its transmission with stated assumptions, and sketch how compliance or counterbalance changes the design.',
    evidence: [
      'A completed Module 8 mastery quiz.',
      'An annotated mechanism sketch with force paths and critical dimensions.',
      'Torque or spool calculations that show units, assumptions, and design margin.',
    ],
    reviewCriteria: [
      'Sizing uses the worst operating position instead of the easiest one.',
      'The student accounts for the force cost of gaining speed or extension.',
      'Compliance, hard stops, and stored energy are handled intentionally.',
    ],
  },
  {
    unitSlug: 'module-10',
    track: 'mechanical',
    format: 'Test plan + evidence review',
    timebox: 'Two working sessions',
    extension:
      'Ask the student to write and run a repeatable test plan for an available prototype or mechanism. The success criterion must be set before trials begin, and one design change must follow from the collected evidence.',
    evidence: [
      'A completed Module 10 mastery quiz.',
      'A dated test sheet with conditions, repeated trials, and pass or fail results.',
      'A before-and-after design note connecting one change to the observed failure.',
    ],
    reviewCriteria: [
      'The test isolates one useful question and defines success before running.',
      'Trials use consistent conditions and preserve inconvenient results.',
      'The proposed change addresses a supported root cause, not only a symptom.',
    ],
  },
  {
    unitSlug: 'module-11',
    track: 'mechanical',
    format: 'Readiness quiz + pit drill',
    timebox: '30 to 45 minutes',
    extension:
      'Run a timed inspection and repair drill with one safe, non-energized fault chosen by the coach. The student should find it, document the repair, reassemble the system, and name the test required before the robot can return to service.',
    evidence: [
      'A completed Module 11 mastery quiz.',
      'The inspection checklist with the discovered fault and elapsed time.',
      'A repair record that includes reassembly checks and a post-repair test.',
    ],
    reviewCriteria: [
      'Inspection follows a repeatable order instead of relying on memory.',
      'The repair preserves fits, fastener retention, and serviceability.',
      'The student refuses to return an untested mechanism to service.',
    ],
  },
  {
    unitSlug: 'module-13',
    track: 'mechanical',
    format: 'Design quiz + oral defense',
    timebox: '45 to 60 minutes',
    extension:
      'Give the student a scoring task and ask for two viable mechanism architectures. They should select one using geometry, load path, reliability, and serviceability, then defend what would make the rejected concept the better choice.',
    evidence: [
      'A completed Module 13 mastery quiz.',
      'Two concept sketches with motion and force paths marked.',
      'A trade table plus a short oral defense of the selected architecture.',
    ],
    reviewCriteria: [
      'The choice follows physical principles instead of copying a past robot.',
      'Geometry and loading support the claimed reach, orientation, and traction.',
      'Likely failure modes have practical detection or mitigation plans.',
    ],
  },
];

/**
 * Resolve briefs against live curriculum data so labels, titles, and links do
 * not drift into a second curriculum model.
 */
export function getCoachAssessments(
  units: readonly CurriculumUnit[],
  lessons: readonly CurriculumLesson[],
): CoachAssessment[] {
  return COACH_ASSESSMENT_BRIEFS.map((brief) => {
    const unit = units.find((candidate) => candidate.slug === brief.unitSlug);
    if (!unit) throw new Error(`Coach assessment references missing unit ${brief.unitSlug}.`);
    if (unit.tier !== 'Advanced') {
      throw new Error(`Coach assessment ${brief.unitSlug} must reference an Advanced unit.`);
    }

    const masterySuffix = brief.track === 'software'
      ? '/mastery-coding-challenge'
      : '/mastery-quiz';
    const masteryLesson = lessons.find(
      (lesson) => lesson.unitSlug === brief.unitSlug && lesson.id.endsWith(masterySuffix),
    );
    if (!masteryLesson) {
      throw new Error(`Coach assessment ${brief.unitSlug} has no mastery lesson.`);
    }

    return {...brief, unit, masteryLesson};
  });
}
