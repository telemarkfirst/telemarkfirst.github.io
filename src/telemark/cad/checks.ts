/**
 * Checks run against a parsed model.
 *
 * Every check here answers a question a mentor would ask while holding the
 * part: is it the size you said, are the holes real clearance holes, does the
 * solid actually close, will it fit in the box. None of them can tell you the
 * mechanism works, and the report says so rather than implying a pass means the
 * design is good.
 */

import type {Bounds, StlModel} from './stl';
import type {StepModel} from './step';

export type Severity = 'pass' | 'warn' | 'fail' | 'info';

export interface Finding {
  readonly id: string;
  readonly label: string;
  readonly severity: Severity;
  readonly detail: string;
}

export interface FastenerStandard {
  readonly name: string;
  /** Screw diameter. A hole at this size is the mistake, not the target. */
  readonly nominal: number;
  readonly tap: number;
  readonly close: number;
  readonly free: number;
}

/**
 * The sizes taught in Module 12. Tap sizes are the screw diameter less one
 * thread pitch; clearance sizes come from the standard drill series that
 * bracket the 0.15 mm per side rule of thumb.
 */
export const FASTENER_STANDARDS: readonly FastenerStandard[] = [
  {name: 'M3', nominal: 3.0, tap: 2.5, close: 3.2, free: 3.4},
  {name: 'M4', nominal: 4.0, tap: 3.3, close: 4.3, free: 4.5},
  {name: 'M5', nominal: 5.0, tap: 4.2, close: 5.3, free: 5.5},
];

/** Half of the smallest step between any two standard sizes above. */
const SIZE_TOLERANCE = 0.05;

export const MATERIAL_DENSITIES: Readonly<Record<string, number>> = {
  '6061 aluminum': 2.70,
  'Delrin (POM)': 1.41,
  Polycarbonate: 1.20,
  'PLA print': 1.24,
  'PETG print': 1.27,
  'ABS print': 1.04,
  'Mild steel': 7.85,
};

/** FTC starting envelope, an 18 inch cube. */
export const ENVELOPE_MM = 18 * 25.4;

function near(a: number, b: number, tolerance = SIZE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

function mm(n: number): string {
  return `${n.toFixed(2)} mm`;
}

function sortedSize(bounds: Bounds): [number, number, number] {
  const dims = [bounds.size.x, bounds.size.y, bounds.size.z];
  dims.sort((a, b) => b - a);
  return [dims[0], dims[1], dims[2]];
}

export interface HoleTally {
  readonly diameter: number;
  readonly count: number;
  readonly verdict: 'clearance' | 'tapped' | 'interference' | 'other';
  readonly standard: string;
}

/**
 * Groups circular features by diameter and names each group.
 *
 * Grouping first matters because a single hole is drawn as several circles (two
 * edges plus the cylindrical face), so raw counts overstate the hole count by a
 * factor that depends on the exporter. Counting distinct diameters is stable
 * where counting circles is not.
 */
export function tallyHoles(diameters: readonly number[]): readonly HoleTally[] {
  const groups = new Map<string, number>();
  for (const d of diameters) {
    const key = d.toFixed(2);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const tallies: HoleTally[] = [];
  for (const [key, count] of groups) {
    const diameter = Number.parseFloat(key);
    let verdict: HoleTally['verdict'] = 'other';
    let standard = 'bore or bearing seat, not a fastener hole';
    for (const s of FASTENER_STANDARDS) {
      if (near(diameter, s.nominal)) {
        verdict = 'interference';
        standard = `${s.name} screw diameter with no clearance`;
      } else if (near(diameter, s.tap)) {
        verdict = 'tapped';
        standard = `${s.name} tap drill`;
      } else if (near(diameter, s.close)) {
        verdict = 'clearance';
        standard = `${s.name} close clearance`;
      } else if (near(diameter, s.free)) {
        verdict = 'clearance';
        standard = `${s.name} free clearance`;
      } else {
        continue;
      }
      break;
    }
    tallies.push({diameter, count, verdict, standard});
  }
  return tallies.sort((a, b) => a.diameter - b.diameter);
}

export function checkHoleStandards(tallies: readonly HoleTally[]): Finding {
  const bad = tallies.filter((t) => t.verdict === 'interference');
  if (bad.length > 0) {
    const list = bad.map((t) => mm(t.diameter)).join(', ');
    return {
      id: 'holes',
      label: 'Hole sizes',
      severity: 'fail',
      detail:
        `${list} matches the screw diameter exactly, so the screw cannot pass ` +
        'through. Clearance holes are drilled larger than the screw on purpose: ' +
        'about 0.15 mm per side, which is why the standard sizes are 3.2 mm for ' +
        'M3 and 4.3 mm for M4 rather than 3.0 and 4.0.',
    };
  }
  const clearance = tallies.filter((t) => t.verdict === 'clearance');
  const tapped = tallies.filter((t) => t.verdict === 'tapped');
  if (clearance.length === 0 && tapped.length === 0) {
    return {
      id: 'holes',
      label: 'Hole sizes',
      severity: 'info',
      detail:
        'No holes at standard fastener sizes. That is expected for a part with ' +
        'only bores and bearing seats, and a problem if you meant to bolt it to ' +
        'something.',
    };
  }
  const plural = (n: number, word: string): string =>
    `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts = [
    clearance.length > 0 ? plural(clearance.length, 'clearance size') : '',
    tapped.length > 0 ? plural(tapped.length, 'tap size') : '',
  ].filter(Boolean);
  return {
    id: 'holes',
    label: 'Hole sizes',
    severity: 'pass',
    detail: `${parts.join(' and ')} found, all at standard sizes.`,
  };
}

export function checkEnvelope(bounds: Bounds, limit = ENVELOPE_MM): Finding {
  const [longest] = sortedSize(bounds);
  if (longest > limit) {
    return {
      id: 'envelope',
      label: 'Starting envelope',
      severity: 'fail',
      detail:
        `Longest dimension is ${mm(longest)}, past the ${mm(limit)} envelope. ` +
        'A part alone being oversize is only fatal if it cannot fold or retract.',
    };
  }
  return {
    id: 'envelope',
    label: 'Starting envelope',
    severity: 'pass',
    detail: `Longest dimension is ${mm(longest)}, inside the ${mm(limit)} cube.`,
  };
}

export function checkClosed(model: StlModel): Finding {
  if (model.openEdges > 0) {
    return {
      id: 'closed',
      label: 'Watertight solid',
      severity: 'fail',
      detail:
        `${model.openEdges} edge${model.openEdges === 1 ? ' is' : 's are'} not shared by exactly two faces, so the ` +
        'surface does not close. Volume and mass below are meaningless until ' +
        'that is fixed, and most printers and simulators will refuse the file.',
    };
  }
  return {
    id: 'closed',
    label: 'Watertight solid',
    severity: 'pass',
    detail: 'Every edge is shared by exactly two faces, so the solid closes.',
  };
}

export function checkMass(
  model: StlModel,
  material: string,
  budgetGrams: number | null,
): Finding {
  const density = MATERIAL_DENSITIES[material];
  // Volume arrives in cubic millimetres; density is quoted per cubic centimetre.
  const grams = (model.volume / 1000) * density;
  const detail = `About ${grams.toFixed(1)} g as ${material}, from ${
    (model.volume / 1000).toFixed(1)
  } cm3 of material.`;
  if (budgetGrams !== null && grams > budgetGrams) {
    return {
      id: 'mass',
      label: 'Mass estimate',
      severity: 'warn',
      detail: `${detail} That is over the ${budgetGrams} g you budgeted for it.`,
    };
  }
  return {id: 'mass', label: 'Mass estimate', severity: 'info', detail};
}

/**
 * Tessellation is a measurement question, not a looks question: a coarse export
 * turns a 3.2 mm hole into a polygon that measures small, so a student can fail
 * a size check for a part that is modelled correctly.
 */
export function checkTessellation(model: StlModel): Finding {
  const [longest] = sortedSize(model.bounds);
  const perMm = model.triangleCount / Math.max(longest, 1);
  if (perMm < 0.5) {
    return {
      id: 'mesh',
      label: 'Export resolution',
      severity: 'warn',
      detail:
        `${model.triangleCount} triangles across ${mm(longest)} is a coarse ` +
        'export. Curved features will measure smaller than you modelled them. ' +
        'Re-export at a finer deviation, or send STEP so sizes are exact.',
    };
  }
  return {
    id: 'mesh',
    label: 'Export resolution',
    severity: 'pass',
    detail: `${model.triangleCount} triangles is fine enough to measure.`,
  };
}

export function checkUnits(model: StepModel): Finding {
  if (model.units === 'inch') {
    return {
      id: 'units',
      label: 'File units',
      severity: 'warn',
      detail:
        'This file is in inches. Sizes below are shown as written, so compare ' +
        'them against inch standards, not the metric ones taught in Module 12.',
    };
  }
  if (model.units === 'unknown') {
    return {
      id: 'units',
      label: 'File units',
      severity: 'warn',
      detail: 'No length unit found in the header. Sizes are assumed millimetres.',
    };
  }
  return {
    id: 'units',
    label: 'File units',
    severity: 'pass',
    detail: 'Millimetres, which is what the standards below assume.',
  };
}
