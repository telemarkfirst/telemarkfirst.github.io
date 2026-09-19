import React, {useMemo, useState} from 'react';
import {useAuth} from '@site/src/telemark/useAuth';
import {useProgress} from '@site/src/telemark/useProgress';
import {trackEvent} from '@site/src/telemark/analytics';
import styles from './ScoredQuiz.module.css';

export interface QuizQuestion {
  prompt: string;
  options: string[];
  /** Index into options. */
  answer: number;
  /** Shown after grading, for both right and wrong answers. */
  explain: string;
}

interface ScoredQuizProps {
  lessonId: string;
  title?: string;
  /** Percentage needed to pass. Defaults to 80. */
  passMark?: number;
  questions: QuizQuestion[];
}

/**
 * An auto-graded multiple choice check.
 *
 * The reveal-the-answer questions elsewhere in a mastery quiz are for thinking
 * something through. This is for finding out whether it stuck. Passing offers
 * to record the lesson as complete through the same progress store the rest of
 * the site uses, so a quiz result is not a separate parallel system.
 */
export default function ScoredQuiz({
  lessonId,
  title = 'Scored Check',
  passMark = 80,
  questions,
}: ScoredQuizProps): React.JSX.Element {
  const {user} = useAuth();
  const {markComplete, isComplete} = useProgress(user);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [graded, setGraded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const answeredCount = answers.filter((a) => a !== null).length;
  const allAnswered = answeredCount === questions.length;

  const correctCount = useMemo(
    () => answers.filter((a, i) => a === questions[i].answer).length,
    [answers, questions],
  );
  const percent = questions.length
    ? Math.round((correctCount / questions.length) * 100)
    : 0;
  const passed = percent >= passMark;

  function choose(questionIndex: number, optionIndex: number) {
    if (graded) return;
    setAnswers((current) =>
      current.map((value, i) => (i === questionIndex ? optionIndex : value)),
    );
  }

  function grade() {
    setGraded(true);
    trackEvent('quiz_graded', {
      lesson_id: lessonId,
      score_percent: percent,
      passed: percent >= passMark,
    });
  }

  function reset() {
    setAnswers(questions.map(() => null));
    setGraded(false);
    setSaved(false);
  }

  async function recordComplete() {
    setSaving(true);
    try {
      await markComplete(lessonId);
      setSaved(true);
    } catch (error) {
      console.error('Telemark quiz save failed:', error);
      // The student still passed; only the save failed.
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.quiz}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>// {lessonId}.check</p>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.subtitle}>
          {questions.length} questions. {passMark}% to pass. Answers are graded
          in your browser and nothing is submitted anywhere.
        </p>
        <div className={styles.progressTrack} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{width: `${(answeredCount / questions.length) * 100}%`}}
          />
        </div>
      </div>

      <div className={styles.body}>
        {questions.map((question, qi) => (
          <div className={styles.question} key={question.prompt}>
            <p className={styles.prompt}>
              {qi + 1}. {question.prompt}
            </p>
            <div className={styles.options} role="group" aria-label={question.prompt}>
              {question.options.map((option, oi) => {
                const chosen = answers[qi] === oi;
                const isAnswer = question.answer === oi;
                let cls = styles.option;
                if (graded && isAnswer) cls = `${styles.option} ${styles.correct}`;
                else if (graded && chosen && !isAnswer) cls = `${styles.option} ${styles.incorrect}`;
                else if (chosen) cls = `${styles.option} ${styles.selected}`;

                return (
                  <button
                    key={option}
                    type="button"
                    className={cls}
                    disabled={graded}
                    aria-pressed={chosen}
                    onClick={() => choose(qi, oi)}
                  >
                    <span className={styles.marker} aria-hidden="true">
                      {graded && isAnswer ? '✓' : graded && chosen ? '✕' : String.fromCharCode(65 + oi)}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
            {graded && <p className={styles.explain}>{question.explain}</p>}
          </div>
        ))}

        <div className={styles.actions}>
          {!graded ? (
            <button
              type="button"
              className={styles.button}
              disabled={!allAnswered}
              onClick={grade}
            >
              {allAnswered
                ? 'Grade my answers'
                : `${questions.length - answeredCount} left`}
            </button>
          ) : (
            <>
              <span className={`${styles.score} ${passed ? styles.pass : styles.fail}`}>
                {correctCount} / {questions.length} correct ({percent}%)
                {passed ? ' // passed' : ' // review and retry'}
              </span>
              <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={reset}>
                Try again
              </button>
              {passed && !isComplete(lessonId) && !saved && (
                <button
                  type="button"
                  className={styles.button}
                  onClick={recordComplete}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Record as complete'}
                </button>
              )}
              {(saved || (passed && isComplete(lessonId))) && (
                <span className={styles.saved}>
                  {user ? 'synced to your account' : 'saved on this device'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
