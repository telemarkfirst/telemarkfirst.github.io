import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'set-position'
  | 'scale-range'
  | 'servo-direction'
  | 'cr-servo'
  | 'dual-servo-challenge';

const LESSON_PATH: Record<LessonKey, string> = {
  'set-position': '/simulator/unit9.1.html',
  'scale-range': '/simulator/unit9.2.html',
  'servo-direction': '/simulator/unit9.3.html',
  'cr-servo': '/simulator/unit9.4.html',
  'dual-servo-challenge': '/simulator/unit9.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'set-position': 'Telemark Unit 9.1 Simulator',
  'scale-range': 'Telemark Unit 9.2 Simulator',
  'servo-direction': 'Telemark Unit 9.3 Simulator',
  'cr-servo': 'Telemark Unit 9.4 Simulator',
  'dual-servo-challenge': 'Telemark Unit 9.5 Simulator',
};

type Unit9SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit9Simulator({lesson}: Unit9SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit9-simulator-wrapper"
        iframeClassName="telemark-simulator unit9-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark servo challenge with starter code for students to complete.</div>
        <div>Includes live mechanism feedback, telemetry checks, and gamepad input for each servo-control concept.</div>
      </Admonition>

      <style>{`
        .unit9-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit9-telemark-simulator {
          width: 100%;
          height: 820px;
          min-height: 620px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit9-telemark-simulator {
            height: 860px;
            max-height: 86vh;
          }
        }
        @media (max-width: 640px) {
          .unit9-telemark-simulator {
            height: 680px;
            min-height: 560px;
          }
        }
      `}</style>
    </>
  );
}
