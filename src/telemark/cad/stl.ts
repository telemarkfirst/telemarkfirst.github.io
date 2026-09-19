/**
 * STL reading and mesh measurement.
 *
 * STL is the one export format whose geometry can be measured in a browser
 * without a solid modelling kernel: it is a bag of triangles, so volume, area,
 * and whether the surface closes are all direct sums. What it cannot carry is
 * design intent, which is why hole sizes are read from STEP instead.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Triangle {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly c: Vec3;
}

export interface Bounds {
  readonly min: Vec3;
  readonly max: Vec3;
  /** Overall size along each axis, in the file's own units. */
  readonly size: Vec3;
}

export interface StlModel {
  readonly format: 'binary' | 'ascii';
  readonly triangleCount: number;
  readonly bounds: Bounds;
  readonly volume: number;
  readonly area: number;
  /**
   * Edges used by anything other than exactly two triangles. A solid that came
   * out of CAD correctly has none; a nonzero count means the export is torn,
   * and every volume derived from it is wrong.
   */
  readonly openEdges: number;
  readonly degenerateTriangles: number;
}

const HEADER_BYTES = 80;
const COUNT_BYTES = 4;
const TRIANGLE_BYTES = 50;

/** Vertices closer than this are the same point. Well below any real feature. */
const WELD_TOLERANCE = 1e-3;

export class StlParseError extends Error {}

function sub(p: Vec3, q: Vec3): Vec3 {
  return {x: p.x - q.x, y: p.y - q.y, z: p.z - q.z};
}

function cross(p: Vec3, q: Vec3): Vec3 {
  return {
    x: p.y * q.z - p.z * q.y,
    y: p.z * q.x - p.x * q.z,
    z: p.x * q.y - p.y * q.x,
  };
}

function dot(p: Vec3, q: Vec3): number {
  return p.x * q.x + p.y * q.y + p.z * q.z;
}

function length(p: Vec3): number {
  return Math.sqrt(dot(p, p));
}

/**
 * The size field is authoritative: a binary STL is exactly a header, a count,
 * and that many fixed-width records. Sniffing for the word "solid" is not,
 * because binary exporters write it into the header too.
 */
function isBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < HEADER_BYTES + COUNT_BYTES) return false;
  const count = new DataView(buffer).getUint32(HEADER_BYTES, true);
  return buffer.byteLength === HEADER_BYTES + COUNT_BYTES + count * TRIANGLE_BYTES;
}

function parseBinary(buffer: ArrayBuffer): Triangle[] {
  const view = new DataView(buffer);
  const count = view.getUint32(HEADER_BYTES, true);
  const triangles: Triangle[] = [];
  for (let i = 0; i < count; i += 1) {
    // Each record is a normal we ignore, three vertices, and an attribute word.
    // The normal is skipped deliberately: exporters disagree about it, and it
    // is recoverable from the winding anyway.
    const base = HEADER_BYTES + COUNT_BYTES + i * TRIANGLE_BYTES + 12;
    const at = (n: number): Vec3 => ({
      x: view.getFloat32(base + n * 12, true),
      y: view.getFloat32(base + n * 12 + 4, true),
      z: view.getFloat32(base + n * 12 + 8, true),
    });
    triangles.push({a: at(0), b: at(1), c: at(2)});
  }
  return triangles;
}

const VERTEX_PATTERN = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;

function parseAscii(text: string): Triangle[] {
  const points: Vec3[] = [];
  for (const match of text.matchAll(VERTEX_PATTERN)) {
    points.push({
      x: Number.parseFloat(match[1]),
      y: Number.parseFloat(match[2]),
      z: Number.parseFloat(match[3]),
    });
  }
  if (points.length === 0) {
    throw new StlParseError('No vertices found. This does not look like an STL file.');
  }
  if (points.length % 3 !== 0) {
    throw new StlParseError(
      `Found ${points.length} vertices, which is not a whole number of triangles.`,
    );
  }
  const triangles: Triangle[] = [];
  for (let i = 0; i < points.length; i += 3) {
    triangles.push({a: points[i], b: points[i + 1], c: points[i + 2]});
  }
  return triangles;
}

function boundsOf(triangles: readonly Triangle[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const t of triangles) {
    for (const v of [t.a, t.b, t.c]) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
      if (v.z > maxZ) maxZ = v.z;
    }
  }
  const min = {x: minX, y: minY, z: minZ};
  const max = {x: maxX, y: maxY, z: maxZ};
  return {min, max, size: sub(max, min)};
}

function vertexKey(v: Vec3): string {
  const q = (n: number): number => Math.round(n / WELD_TOLERANCE);
  return `${q(v.x)},${q(v.y)},${q(v.z)}`;
}

/**
 * Counts edges that are not shared by exactly two triangles.
 *
 * STL stores every triangle independently, so shared vertices are only equal by
 * coordinate. Welding on a tolerance recovers the connectivity the format threw
 * away, which is what makes closure checkable at all.
 */
function countOpenEdges(triangles: readonly Triangle[]): number {
  const uses = new Map<string, number>();
  for (const t of triangles) {
    const keys = [vertexKey(t.a), vertexKey(t.b), vertexKey(t.c)];
    for (let i = 0; i < 3; i += 1) {
      const p = keys[i];
      const q = keys[(i + 1) % 3];
      const edge = p < q ? `${p}|${q}` : `${q}|${p}`;
      uses.set(edge, (uses.get(edge) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const count of uses.values()) {
    if (count !== 2) open += 1;
  }
  return open;
}

export function parseStl(buffer: ArrayBuffer): StlModel {
  if (buffer.byteLength === 0) throw new StlParseError('The file is empty.');
  const binary = isBinary(buffer);
  const triangles = binary
    ? parseBinary(buffer)
    : parseAscii(new TextDecoder().decode(buffer));
  if (triangles.length === 0) throw new StlParseError('The file contains no triangles.');

  let volume = 0;
  let area = 0;
  let degenerate = 0;
  for (const t of triangles) {
    // Signed tetrahedron volumes taken to the origin cancel everywhere the
    // surface folds back on itself, so the sum is the enclosed volume for any
    // closed mesh regardless of where it sits in space.
    volume += dot(t.a, cross(t.b, t.c)) / 6;
    const faceArea = length(cross(sub(t.b, t.a), sub(t.c, t.a))) / 2;
    area += faceArea;
    if (faceArea === 0) degenerate += 1;
  }

  return {
    format: binary ? 'binary' : 'ascii',
    triangleCount: triangles.length,
    bounds: boundsOf(triangles),
    volume: Math.abs(volume),
    area,
    openEdges: countOpenEdges(triangles),
    degenerateTriangles: degenerate,
  };
}
