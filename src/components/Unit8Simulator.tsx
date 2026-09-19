import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'set-power'
  | 'set-direction'
  | 'zero-power-behavior'
  | 'coast-vs-stop'
  | 'linear-slide-challenge';

const LESSON_PATH: Record<LessonKey, string> = {
  'set-power': '/simulator/unit8.1.html',
  'set-direction': '/simulator/unit8.2.html',
  'zero-power-behavior': '/simulator/unit8.3.html',
  'coast-vs-stop': '/simulator/unit8.4.html',
  'linear-slide-challenge': '/simulator/unit8.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'set-power': 'Telemark Unit 8.1 Simulator',
  'set-direction': 'Telemark Unit 8.2 Simulator',
  'zero-power-behavior': 'Telemark Unit 8.3 Simulator',
  'coast-vs-stop': 'Telemark Unit 8.4 Simulator',
  'linear-slide-challenge': 'Telemark Unit 8.5 Simulator',
};

type Unit8SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit8Simulator({lesson}: Unit8SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame src={simulatorSrc} title={simulatorTitle} />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark motor challenge with starter code instead of a completed solution.</div>
        <div>Includes live hardware feedback, telemetry checks, and gamepad input for each motor-control concept.</div>
        <div>Best for practicing power, direction, braking, stopping behavior, and limit-switch safety in context.</div>
      </Admonition>

      <style>{`
        .simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .telemark-simulator {
          width: 100%;
          height: 720px;
          min-height: 540px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .telemark-simulator {
            height: 780px;
            max-height: 80vh;
          }
        }
        @media (max-width: 640px) {
          .telemark-simulator {
            height: 560px;
            min-height: 480px;
          }
        }
      `}</style>
    </>
  );
}
