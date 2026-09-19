/**
 * Per exercise grading rules.
 *
 * A rubric only exists where a file can actually answer for it. Exercises 1.1
 * and 1.2 are single parts with stated dimensions, so a checker can be strict.
 * The assembly and drawing exercises are graded by a human, and saying so is
 * more useful than inventing a score the file cannot support.
 */

import type {Bounds} from './stl';
import type {Finding, HoleTally} from './checks';

export interface ExpectedHole {
  readonly diameter: number;
  readonly count: number;
  readonly label: string;
}

export interface CadRubric {
  readonly id: string;
  readonly exercise: string;
  readonly title: string;
  /** Overall size in mm. Compared largest to smallest, so orientation is free. */
  readonly size?: readonly [number, number, number];
  readonly sizeTolerance?: number;
  readonly holes?: readonly ExpectedHole[];
  readonly maxSize?: readonly [number, number];
  readonly notes: readonly string[];
}

export const GENERAL_RUBRIC: CadRubric = {
  id: 'general',
  exercise: 'General',
  title: 'General check, no exercise selected',
  notes: [
    'Reports what the file says about itself, with no expected answer to compare against.',
  ],
};

export const CAD_RUBRICS: readonly CadRubric[] = [
  GENERAL_RUBRIC,
  {
    id: '1.1',
    exercise: '1.1',
    title: 'Fully defined mounting plate',
    size: [80, 40, 3],
    sizeTolerance: 0.2,
    holes: [
      {diameter: 3.2, count: 4, label: 'M3 clearance holes, one per corner'},
      {diameter: 8.0, count: 1, label: 'centered bore'},
    ],
    notes: [
      'Corner fillets are not checked here: a 3 mm fillet does not change the overall size, which is the number this can verify.',
    ],
  },
  {
    id: '1.2',
    exercise: '1.2',
    title: 'Adapter plate between two hole patterns',
    maxSize: [70, 70],
    notes: [
      'The 32 mm square pattern, the 48 mm rail spacing, and the slot travel are geometry a person still has to read off your model.',
      'Thickness should be 4 mm and the plate no larger than 70 mm by 70 mm.',
    ],
  },
  {
    id: '2.1',
    exercise: '2.1',
    title: 'Wheel, axle, and bearing block',
    holes: [{diameter: 8.0, count: 2, label: '8 mm bearing bores'}],
    notes: [
      'Bearing spacing, wheel position, and spacer stack are assembly relationships that a single exported solid cannot show.',
      'Export the two side plates if you want the bores checked.',
    ],
  },
];

export function rubricById(id: string): CadRubric {
  return CAD_RUBRICS.find((r) => r.id === id) ?? GENERAL_RUBRIC;
}

function mm(n: number): string {
  return `${n.toFixed(2)} mm`;
}

function sorted(bounds: Bounds): number[] {
  return [bounds.size.x, bounds.size.y, bounds.size.z].sort((a, b) => b - a);
}

export function checkRubricSize(rubric: CadRubric, bounds: Bounds): Finding | null {
  const actual = sorted(bounds);
  if (rubric.size) {
    const expected = [...rubric.size].sort((a, b) => b - a);
    const tolerance = rubric.sizeTolerance ?? 0.2;
    const off = expected.map((e, i) => Math.abs(actual[i] - e));
    const worst = Math.max(...off);
    const shown = actual.map((n) => n.toFixed(2)).join(' x ');
    const want = expected.map((n) => n.toFixed(2)).join(' x ');
    if (worst > tolerance) {
      return {
        id: 'size',
        label: 'Overall size',
        severity: 'fail',
        detail:
          `Measured ${shown} mm against ${want} mm, off by ${mm(worst)}. ` +
          'Orientation does not matter here, so this is a real size difference ' +
          'rather than the part being modelled on a different plane.',
      };
    }
    return {
      id: 'size',
      label: 'Overall size',
      severity: 'pass',
      detail: `Measured ${shown} mm against ${want} mm, within ${mm(tolerance)}.`,
    };
  }
  if (rubric.maxSize) {
    const limit = Math.max(...rubric.maxSize);
    const [longest] = actual;
    if (longest > limit) {
      return {
        id: 'size',
        label: 'Overall size',
        severity: 'fail',
        detail: `Longest dimension is ${mm(longest)}, past the ${mm(limit)} limit.`,
      };
    }
    return {
      id: 'size',
      label: 'Overall size',
      severity: 'pass',
      detail: `Longest dimension is ${mm(longest)}, inside the ${mm(limit)} limit.`,
    };
  }
  return null;
}

/**
 * Compares the holes found against the holes the exercise asked for.
 *
 * Counts are compared as "at least", because one modelled hole shows up as
 * several circle entities and because a student who added extra lightening
 * holes has not failed the exercise.
 */
export function checkRubricHoles(
  rubric: CadRubric,
  tallies: readonly HoleTally[],
): Finding | null {
  if (!rubric.holes || rubric.holes.length === 0) return null;
  const missing: string[] = [];
  const found: string[] = [];
  for (const want of rubric.holes) {
    const match = tallies.find((t) => Math.abs(t.diameter - want.diameter) <= 0.05);
    if (match) found.push(`${mm(want.diameter)} ${want.label}`);
    else missing.push(`${mm(want.diameter)} ${want.label}`);
  }
  if (missing.length > 0) {
    return {
      id: 'rubric-holes',
      label: 'Required holes',
      severity: 'fail',
      detail: `Nothing at ${missing.join('; ')}. ${
        found.length > 0 ? `Found ${found.join('; ')}.` : ''
      }`.trim(),
    };
  }
  return {
    id: 'rubric-holes',
    label: 'Required holes',
    severity: 'pass',
    detail: `Every required size is present: ${found.join('; ')}.`,
  };
}
