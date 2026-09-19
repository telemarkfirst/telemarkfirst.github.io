export const ACCOUNT_ROLES = ['student', 'coach'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export interface ClassroomProgress {
  completedLessons: string[];
  skippedLessons: string[];
  autoCompletedLessons: string[];
  reviewingUnits: string[];
  lastLesson: string | null;
  updatedAt: string | null;
}

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const LESSON_ID_PATTERN = /^(?:unit|module|blocks-unit|fll-unit)-\d{2}\/[a-z0-9][a-z0-9-]{0,79}$/;
const UNIT_ID_PATTERN = /^(?:unit|module|blocks-unit|fll-unit)-\d{2}$/;
const MAX_PROGRESS_ITEMS = 256;
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'coach',
  'help',
  'moderator',
  'root',
  'student',
  'support',
  'telemark',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringArray(value: unknown, pattern: RegExp): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string' && pattern.test(item)
  )))].slice(0, MAX_PROGRESS_ITEMS);
}

/**
 * Usernames are deliberately ASCII and lowercase. That makes the document key
 * itself the canonical, case-insensitive identity and avoids lookalike names.
 */
export function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Enter a username.');
  }
  const username = value.trim().replace(/^@/, '').toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Use 3 to 20 lowercase letters, numbers, underscores, or hyphens.');
  }
  if (RESERVED_USERNAMES.has(username)) {
    throw new Error('That username is reserved.');
  }
  return username;
}

export function normalizeClassroomName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a classroom name.');
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) {
    throw new Error('Classroom names must be between 2 and 60 characters.');
  }
  return name;
}

export function parseAccountRole(value: unknown): AccountRole {
  if (value === 'student' || value === 'coach') return value;
  throw new Error('Choose student or coach.');
}

/** Preserve the progress distinctions used by both coach and peer views. */
export function normalizeClassroomProgress(
  value: unknown,
  updatedAt: string | null = null,
): ClassroomProgress {
  const source = record(value);
  const skippedLessons = stringArray(source?.skippedLessons, LESSON_ID_PATTERN);
  const autoCompletedLessons = stringArray(source?.autoCompletedLessons, LESSON_ID_PATTERN);
  return {
    completedLessons: [
      ...new Set([
        ...stringArray(source?.completedLessons, LESSON_ID_PATTERN),
        ...skippedLessons,
        ...autoCompletedLessons,
      ]),
    ],
    skippedLessons,
    autoCompletedLessons,
    reviewingUnits: stringArray(source?.reviewingUnits, UNIT_ID_PATTERN),
    lastLesson: typeof source?.lastLesson === 'string' && LESSON_ID_PATTERN.test(source.lastLesson)
      ? source.lastLesson
      : null,
    updatedAt,
  };
}
