/**
 * STEP (ISO 10303-21) reading, limited to what a hole check needs.
 *
 * Evaluating STEP properly means building a boundary representation, which is a
 * geometry kernel and not a thing to ship to a browser. But the entities that
 * answer "what size are the holes" are written out literally: a CIRCLE carries
 * its radius as a number, and a CYLINDRICAL_SURFACE carries the radius of the
 * hole it wraps. Reading those is parsing, not modelling, and it is enough to
 * tell a 3.2 mm clearance hole from a 3.0 mm mistake.
 *
 * Everything this file reports is therefore about sizes and positions of
 * circular features, plus the units they are expressed in. It deliberately
 * claims nothing about solidity, mass, or whether faces are trimmed.
 */

import type {Vec3, Bounds} from './stl';

export interface StepCircle {
  readonly radius: number;
  readonly diameter: number;
  /** Null when the placement could not be resolved to a point. */
  readonly center: Vec3 | null;
  /** Cylindrical surfaces are through features; circles may be edges or arcs. */
  readonly source: 'circle' | 'cylinder';
}

export interface StepModel {
  readonly schema: string;
  readonly units: 'mm' | 'inch' | 'unknown';
  readonly circles: readonly StepCircle[];
  /** Bounds of every explicit point, which brackets the part. */
  readonly bounds: Bounds | null;
  readonly entityCount: number;
  readonly faceCount: number;
}

export class StepParseError extends Error {}

interface Entity {
  readonly type: string;
  readonly args: readonly string[];
  readonly raw: string;
}

/**
 * Splits on a delimiter that is not inside a quoted string or nested parens.
 *
 * STEP strings can contain semicolons and commas, so a plain split corrupts
 * roughly one real-world file in ten. Tracking quote and paren depth costs a
 * single pass and removes the whole class of failure.
 */
function splitTop(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      // Doubled quotes are an escaped quote inside the string, not its end.
      if (ch === "'") {
        if (text[i + 1] === "'") i += 1;
        else quoted = false;
      }
      continue;
    }
    if (ch === "'") quoted = true;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === delimiter && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function sectionBetween(text: string, open: RegExp, close: string): string | null {
  const start = text.search(open);
  if (start < 0) return null;
  const from = text.indexOf(';', start) + 1;
  const end = text.indexOf(close, from);
  return text.slice(from, end < 0 ? text.length : end);
}

const ENTITY_PATTERN = /^#(\d+)\s*=\s*([\s\S]*)$/;

function parseEntities(data: string): Map<number, Entity> {
  const entities = new Map<number, Entity>();
  for (const statement of splitTop(data, ';')) {
    const trimmed = statement.trim();
    if (trimmed === '') continue;
    const match = ENTITY_PATTERN.exec(trimmed);
    if (!match) continue;
    const id = Number.parseInt(match[1], 10);
    const body = match[2].trim();
    const paren = body.indexOf('(');
    if (paren < 0) continue;
    const type = body.slice(0, paren).trim().toUpperCase();
    const inner = body.slice(paren + 1, body.lastIndexOf(')'));
    entities.set(id, {
      type,
      args: splitTop(inner, ',').map((a) => a.trim()),
      raw: body,
    });
  }
  return entities;
}

function reference(arg: string | undefined): number | null {
  if (!arg || arg[0] !== '#') return null;
  const id = Number.parseInt(arg.slice(1), 10);
  return Number.isNaN(id) ? null : id;
}

function pointOf(entities: Map<number, Entity>, id: number | null): Vec3 | null {
  if (id === null) return null;
  const entity = entities.get(id);
  if (!entity) return null;
  if (entity.type === 'CARTESIAN_POINT') {
    const coords = entity.args[1];
    if (!coords) return null;
    const numbers = splitTop(coords.replace(/^\(|\)$/g, ''), ',')
      .map((n) => Number.parseFloat(n));
    if (numbers.length < 3 || numbers.some((n) => Number.isNaN(n))) return null;
    return {x: numbers[0], y: numbers[1], z: numbers[2]};
  }
  // An AXIS2_PLACEMENT_3D holds its origin in the first reference argument.
  if (entity.type.startsWith('AXIS2_PLACEMENT')) {
    return pointOf(entities, reference(entity.args[1]));
  }
  return null;
}

/**
 * Length unit from the header block.
 *
 * Nearly every FTC export is millimetres, but an inch file whose numbers are
 * read as millimetres produces a part 25 times too small and a checker that
 * confidently reports nonsense, so this is worth getting right rather than
 * assuming.
 */
function unitsOf(text: string): StepModel['units'] {
  const upper = text.toUpperCase();
  // Matched against the unit entity only. A bare search for the word would
  // fire on any file that happens to be named "inch_plate.step".
  if (/CONVERSION_BASED_UNIT\s*\(\s*'INCH/.test(upper)) return 'inch';
  if (/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\./.test(upper)) return 'mm';
  return 'unknown';
}

function boundsOfPoints(points: readonly Vec3[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  const min = {x: minX, y: minY, z: minZ};
  const max = {x: maxX, y: maxY, z: maxZ};
  return {min, max, size: {x: maxX - minX, y: maxY - minY, z: maxZ - minZ}};
}

export function parseStep(text: string): StepModel {
  const data = sectionBetween(text, /\bDATA\s*;/i, 'ENDSEC');
  if (data === null) {
    throw new StepParseError(
      'No DATA section found. This does not look like a STEP file.',
    );
  }
  const header = sectionBetween(text, /\bHEADER\s*;/i, 'ENDSEC') ?? '';
  const schemaMatch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(header);

  const entities = parseEntities(data);
  const circles: StepCircle[] = [];
  const points: Vec3[] = [];
  let faceCount = 0;

  for (const entity of entities.values()) {
    if (entity.type === 'ADVANCED_FACE' || entity.type === 'FACE_SURFACE') {
      faceCount += 1;
      continue;
    }
    if (entity.type === 'CIRCLE' || entity.type === 'CYLINDRICAL_SURFACE') {
      const radius = Number.parseFloat(entity.args[2] ?? '');
      if (Number.isNaN(radius) || radius <= 0) continue;
      circles.push({
        radius,
        diameter: radius * 2,
        center: pointOf(entities, reference(entity.args[1])),
        source: entity.type === 'CIRCLE' ? 'circle' : 'cylinder',
      });
    }
  }

  for (const [id, entity] of entities) {
    if (entity.type === 'CARTESIAN_POINT') {
      const p = pointOf(entities, id);
      if (p) points.push(p);
    }
  }

  return {
    schema: schemaMatch ? schemaMatch[1] : 'unknown',
    units: unitsOf(header + data.slice(0, 20000)),
    circles,
    bounds: boundsOfPoints(points),
    entityCount: entities.size,
    faceCount,
  };
}
