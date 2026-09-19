import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'encapsulation'
  | 'inheritance'
  | 'override'
  | 'static-constants'
  | 'robot-class';

const LESSON_PATH: Record<LessonKey, string> = {
  encapsulation: '/simulator/unit13.1.html',
  inheritance: '/simulator/unit13.2.html',
  override: '/simulator/unit13.3.html',
  'static-constants': '/simulator/unit13.4.html',
  'robot-class': '/simulator/unit13.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  encapsulation: 'Telemark Unit 13.1 Simulator',
  inheritance: 'Telemark Unit 13.2 Simulator',
  override: 'Telemark Unit 13.3 Simulator',
  'static-constants': 'Telemark Unit 13.4 Simulator',
  'robot-class': 'Telemark Unit 13.5 Simulator',
};

type Unit13SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit13Simulator({lesson}: Unit13SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit13-simulator-wrapper"
        iframeClassName="telemark-simulator unit13-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark object oriented programming challenge with incomplete starter code for students to complete.</div>
        <div>The simulator editor contains the starter code; use the answer below only after trying the challenge.</div>
      </Admonition>

      <style>{`
        .unit13-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit13-telemark-simulator {
          width: 100%;
          height: 900px;
          min-height: 700px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit13-telemark-simulator {
            height: 920px;
            max-height: 88vh;
          }
        }
        @media (max-width: 640px) {
          .unit13-telemark-simulator {
            height: 720px;
            min-height: 620px;
          }
        }
      `}</style>
    </>
  );
}
