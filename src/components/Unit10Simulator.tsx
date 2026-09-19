import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'get-current-position'
  | 'ticks-to-distance'
  | 'run-to-position'
  | 'run-using-encoder'
  | 'drive-and-stop';

const LESSON_PATH: Record<LessonKey, string> = {
  'get-current-position': '/simulator/unit10.1.html',
  'ticks-to-distance': '/simulator/unit10.2.html',
  'run-to-position': '/simulator/unit10.3.html',
  'run-using-encoder': '/simulator/unit10.4.html',
  'drive-and-stop': '/simulator/unit10.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'get-current-position': 'Telemark Unit 10.1 Simulator',
  'ticks-to-distance': 'Telemark Unit 10.2 Simulator',
  'run-to-position': 'Telemark Unit 10.3 Simulator',
  'run-using-encoder': 'Telemark Unit 10.4 Simulator',
  'drive-and-stop': 'Telemark Unit 10.5 Simulator',
};

type Unit10SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit10Simulator({lesson}: Unit10SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit10-simulator-wrapper"
        iframeClassName="telemark-simulator unit10-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark encoder challenge with incomplete starter code for students to finish.</div>
        <div>Includes live mechanism feedback, telemetry checks, and encoder-state validation for each lesson concept.</div>
      </Admonition>

      <style>{`
        .unit10-simulator-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          margin: 1.5rem 0;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        .unit10-telemark-simulator {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-height: 0;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (max-width: 640px) {
          .unit10-simulator-wrapper {
            aspect-ratio: 1 / 1;
          }
        }
      `}</style>
    </>
  );
}
