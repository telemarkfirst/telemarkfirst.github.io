/** Matches a blocks unit, software unit, or engineering module. */
const TRACK_SEGMENT = /(?:^|\/)(blocks-unit|fll-unit|unit|module)-(\d{1,2})(?:\/|$)/i;

export function getUnitNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(TRACK_SEGMENT);
  if (!match) return null;
  const unitNumber = Number.parseInt(match[2], 10);
  return Number.isFinite(unitNumber) ? unitNumber : null;
}

/** Returns a canonical slug such as `unit-03` or `module-07`. */
export function getUnitSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(TRACK_SEGMENT);
  if (!match) return null;
  return `${match[1].toLowerCase()}-${match[2].padStart(2, '0')}`;
}

/** Curriculum and simulator access is public; Sharp AI authenticates itself. */
export function isProtectedUnit(_unitNumber: number): boolean {
  return false;
}

export function isProtectedLessonPath(_value: string | null | undefined): boolean {
  return false;
}
