/**
 * Turns a parsed file plus a rubric into the report the student reads.
 *
 * The two formats answer different questions and the report says which is
 * which: STL measures the solid but rounds every curve, STEP carries exact hole
 * sizes but no volume. Pretending one file answers both is how a checker starts
 * lying to a student.
 */

import {parseStl, StlParseError, type StlModel} from './stl';
import {parseStep, StepParseError, type StepModel} from './step';
import {
  checkClosed,
  checkEnvelope,
  checkHoleStandards,
  checkMass,
  checkTessellation,
  checkUnits,
  tallyHoles,
  type Finding,
  type HoleTally,
} from './checks';
import {checkRubricHoles, checkRubricSize, type CadRubric} from './rubrics';

export type FileKind = 'stl' | 'step';

export interface CadReport {
  readonly kind: FileKind;
  readonly fileName: string;
  readonly rubric: CadRubric;
  readonly findings: readonly Finding[];
  readonly holes: readonly HoleTally[];
  readonly stl: StlModel | null;
  readonly step: StepModel | null;
  readonly limits: readonly string[];
}

export class CadCheckError extends Error {}

const STL_LIMITS = [
  'An STL is triangles only, so hole diameters are polygon approximations and read slightly under the modelled size.',
  'Nothing here knows what the part is for. A watertight plate of the right size can still be the wrong plate.',
];

const STEP_LIMITS = [
  'Sizes come from the circle entities in the file, which is exact, but this does not evaluate the solid, so there is no volume or mass.',
  'A circle in the file is not proof of a hole through the part: an arc used to build a fillet is also a circle.',
];

export function kindFromName(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.stl')) return 'stl';
  if (lower.endsWith('.step') || lower.endsWith('.stp')) return 'step';
  return null;
}

export interface CheckOptions {
  readonly fileName: string;
  readonly rubric: CadRubric;
  readonly material: string;
  readonly massBudgetGrams: number | null;
}

export function checkFile(buffer: ArrayBuffer, options: CheckOptions): CadReport {
  const kind = kindFromName(options.fileName);
  if (kind === null) {
    throw new CadCheckError(
      'Only STL and STEP files can be checked. Export as STEP for exact hole ' +
      'sizes, or STL for volume and watertightness.',
    );
  }

  const findings: Finding[] = [];

  if (kind === 'stl') {
    let stl: StlModel;
    try {
      stl = parseStl(buffer);
    } catch (error) {
      throw new CadCheckError(
        error instanceof StlParseError ? error.message : 'The STL could not be read.',
      );
    }
    const size = checkRubricSize(options.rubric, stl.bounds);
    if (size) findings.push(size);
    findings.push(checkEnvelope(stl.bounds));
    findings.push(checkClosed(stl));
    findings.push(checkTessellation(stl));
    findings.push(checkMass(stl, options.material, options.massBudgetGrams));
    return {
      kind,
      fileName: options.fileName,
      rubric: options.rubric,
      findings,
      holes: [],
      stl,
      step: null,
      limits: STL_LIMITS,
    };
  }

  let step: StepModel;
  try {
    step = parseStep(new TextDecoder().decode(buffer));
  } catch (error) {
    throw new CadCheckError(
      error instanceof StepParseError ? error.message : 'The STEP file could not be read.',
    );
  }
  // Cylindrical surfaces are the through features; plain circles include arcs
  // used for fillets and rounds, which would inflate every count.
  const holeDiameters = step.circles
    .filter((c) => c.source === 'cylinder')
    .map((c) => c.diameter);
  const holes = tallyHoles(holeDiameters);

  findings.push(checkUnits(step));
  if (step.bounds) {
    const size = checkRubricSize(options.rubric, step.bounds);
    if (size) findings.push(size);
    findings.push(checkEnvelope(step.bounds));
  }
  findings.push(checkHoleStandards(holes));
  const rubricHoles = checkRubricHoles(options.rubric, holes);
  if (rubricHoles) findings.push(rubricHoles);

  return {
    kind,
    fileName: options.fileName,
    rubric: options.rubric,
    findings,
    holes,
    stl: null,
    step,
    limits: STEP_LIMITS,
  };
}

export function worstSeverity(findings: readonly Finding[]): Finding['severity'] {
  if (findings.some((f) => f.severity === 'fail')) return 'fail';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  return 'pass';
}
