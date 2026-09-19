import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeClassroomName,
  normalizeClassroomProgress,
  normalizeUsername,
  parseAccountRole,
} from './classroom';

test('usernames have one case-insensitive canonical representation', () => {
  assert.equal(normalizeUsername('  @Drive_Team-7  '), 'drive_team-7');
  assert.throws(() => normalizeUsername('ab'), /3 to 20/);
  assert.throws(() => normalizeUsername('two words'), /3 to 20/);
  assert.throws(() => normalizeUsername('téam'), /3 to 20/);
  assert.throws(() => normalizeUsername('Telemark'), /reserved/);
});

test('account roles and classroom names are validated', () => {
  assert.equal(parseAccountRole('student'), 'student');
  assert.equal(parseAccountRole('coach'), 'coach');
  assert.throws(() => parseAccountRole('admin'));
  assert.equal(normalizeClassroomName('  Team   11115  '), 'Team 11115');
  assert.throws(() => normalizeClassroomName('x'));
});

test('shared progress preserves skipped and placement distinctions', () => {
  assert.deepEqual(normalizeClassroomProgress({
    completedLessons: ['unit-01/a', 'unit-01/a', 7],
    skippedLessons: ['unit-01/b'],
    autoCompletedLessons: ['blocks-unit-00/a'],
    reviewingUnits: ['unit-02', 'unit-02'],
    lastLesson: 'unit-01/b',
  }, '2026-09-14T12:00:00.000Z'), {
    completedLessons: ['unit-01/a', 'unit-01/b', 'blocks-unit-00/a'],
    skippedLessons: ['unit-01/b'],
    autoCompletedLessons: ['blocks-unit-00/a'],
    reviewingUnits: ['unit-02'],
    lastLesson: 'unit-01/b',
    updatedAt: '2026-09-14T12:00:00.000Z',
  });
});

test('shared progress drops arbitrary user-authored strings', () => {
  const many = Array.from({length: 600}, (_, index) => `unit-01/lesson-${index}`);
  const progress = normalizeClassroomProgress({
    completedLessons: [...many, '<script>peer data</script>', 'not-a-lesson'],
    reviewingUnits: ['unit-01', 'anything'],
    lastLesson: '<script>peer data</script>',
  });
  assert.equal(progress.completedLessons.length, 256);
  assert.deepEqual(progress.reviewingUnits, ['unit-01']);
  assert.equal(progress.lastLesson, null);
});
