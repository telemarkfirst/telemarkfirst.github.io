export const ALLOWED_RANGES = ['7d', '28d', '90d'] as const;

export type MetricsRange = (typeof ALLOWED_RANGES)[number];

export interface ProgressRecord {
  completedLessons?: unknown;
}

export interface UnitDefinition {
  slug: string;
  label: string;
  lessonCount: number;
}

export interface UnitProgressMetric extends UnitDefinition {
  completedLessonSlots: number;
  learnersCompleted: number;
  averageCompletionRate: number;
}

export interface LearningMetrics {
  accountsWithProgress: number;
  startedLearners: number;
  fullyCompletedLearners: number;
  averageCompletionRate: number;
  totalLessonCompletions: number;
  units: UnitProgressMetric[];
}

export const CURRICULUM_UNITS: UnitDefinition[] = [
  {slug: 'unit-01', label: 'Unit 1', lessonCount: 10},
  {slug: 'unit-02', label: 'Unit 2', lessonCount: 7},
  {slug: 'unit-03', label: 'Unit 3', lessonCount: 6},
  {slug: 'unit-04', label: 'Unit 4', lessonCount: 6},
  {slug: 'unit-05', label: 'Unit 5', lessonCount: 6},
  {slug: 'unit-06', label: 'Unit 6', lessonCount: 6},
  {slug: 'unit-07', label: 'Unit 7', lessonCount: 6},
  {slug: 'unit-08', label: 'Unit 8', lessonCount: 6},
  {slug: 'unit-09', label: 'Unit 9', lessonCount: 6},
  {slug: 'unit-10', label: 'Unit 10', lessonCount: 6},
  {slug: 'unit-11', label: 'Unit 11', lessonCount: 6},
  {slug: 'unit-12', label: 'Unit 12', lessonCount: 6},
  {slug: 'unit-13', label: 'Unit 13', lessonCount: 6},
  {slug: 'unit-14', label: 'Unit 14', lessonCount: 6},
  {slug: 'unit-15', label: 'Unit 15', lessonCount: 6},
];

export const TOTAL_LESSONS = CURRICULUM_UNITS.reduce(
  (total, unit) => total + unit.lessonCount,
  0,
);

export function parseRange(value: unknown): MetricsRange {
  if (typeof value === 'string' && ALLOWED_RANGES.includes(value as MetricsRange)) {
    return value as MetricsRange;
  }
  throw new Error('Range must be one of 7d, 28d, or 90d.');
}

export function isAuthorizedAdmin(
  email: unknown,
  emailVerified: unknown,
  configuredAdmin = process.env.TELEMARK_ADMIN_EMAIL,
): boolean {
  return (
    typeof configuredAdmin === 'string' &&
    configuredAdmin.trim().length > 0 &&
    emailVerified === true &&
    typeof email === 'string' &&
    email.trim().toLowerCase() === configuredAdmin.trim().toLowerCase()
  );
}

export function rangeDays(range: MetricsRange): number {
  return Number.parseInt(range, 10);
}

export function toDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

export function buildDateKeys(range: MetricsRange, now = new Date()): string[] {
  const days = rangeDays(range);
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    keys.push(toDateKey(date));
  }

  return keys;
}

export function aggregateProgress(records: ProgressRecord[]): LearningMetrics {
  const unitTotals = new Map(
    CURRICULUM_UNITS.map((unit) => [
      unit.slug,
      {completedLessonSlots: 0, learnersCompleted: 0},
    ]),
  );

  let startedLearners = 0;
  let fullyCompletedLearners = 0;
  let totalLessonCompletions = 0;

  records.forEach((record) => {
    const completed = Array.isArray(record.completedLessons)
      ? [...new Set(record.completedLessons.filter((value): value is string => typeof value === 'string'))]
      : [];

    const countsByUnit = new Map<string, number>();
    completed.forEach((lessonId) => {
      const unitSlug = lessonId.split('/')[0];
      const unit = CURRICULUM_UNITS.find((candidate) => candidate.slug === unitSlug);
      if (!unit) return;
      countsByUnit.set(unitSlug, Math.min((countsByUnit.get(unitSlug) ?? 0) + 1, unit.lessonCount));
    });

    const learnerTotal = [...countsByUnit.values()].reduce((sum, count) => sum + count, 0);
    if (learnerTotal > 0) startedLearners += 1;
    if (learnerTotal >= TOTAL_LESSONS) fullyCompletedLearners += 1;
    totalLessonCompletions += learnerTotal;

    CURRICULUM_UNITS.forEach((unit) => {
      const count = countsByUnit.get(unit.slug) ?? 0;
      const metric = unitTotals.get(unit.slug)!;
      metric.completedLessonSlots += count;
      if (count >= unit.lessonCount) metric.learnersCompleted += 1;
    });
  });

  const averageCompletionRate =
    startedLearners === 0
      ? 0
      : totalLessonCompletions / (startedLearners * TOTAL_LESSONS);

  return {
    accountsWithProgress: records.length,
    startedLearners,
    fullyCompletedLearners,
    averageCompletionRate,
    totalLessonCompletions,
    units: CURRICULUM_UNITS.map((unit) => {
      const totals = unitTotals.get(unit.slug)!;
      return {
        ...unit,
        ...totals,
        averageCompletionRate:
          startedLearners === 0
            ? 0
            : totals.completedLessonSlots / (startedLearners * unit.lessonCount),
      };
    }),
  };
}
