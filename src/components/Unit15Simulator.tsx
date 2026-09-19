import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'limelight'
  | 'pedro-pathing'
  | 'bezier-curves'
  | 'limelight-fusion'
  | 'full-autonomous';

const LESSON_PATH: Record<LessonKey, string> = {
  limelight: '/simulator/unit15.1.html',
  'pedro-pathing': '/simulator/unit15.2.html',
  'bezier-curves': '/simulator/unit15.3.html',
  'limelight-fusion': '/simulator/unit15.4.html',
  'full-autonomous': '/simulator/unit15.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  limelight: 'Telemark Unit 15.1 Simulator',
  'pedro-pathing': 'Telemark Unit 15.2 Simulator',
  'bezier-curves': 'Telemark Unit 15.3 Simulator',
  'limelight-fusion': 'Telemark Unit 15.4 Simulator',
  'full-autonomous': 'Telemark Unit 15.5 Simulator',
};

type Unit15SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit15Simulator({lesson}: Unit15SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit15-simulator-wrapper"
        iframeClassName="telemark-simulator unit15-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark advanced autonomous challenge with incomplete starter code for students to complete.</div>
        <div>The simulator editor contains the starter code; use the answer below only after trying the challenge.</div>
      </Admonition>

      <style>{`
        .unit15-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit15-telemark-simulator {
          width: 100%;
          height: 940px;
          min-height: 740px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit15-telemark-simulator {
            height: 960px;
            max-height: 90vh;
          }
        }
        @media (max-width: 640px) {
          .unit15-telemark-simulator {
            height: 760px;
            min-height: 660px;
          }
        }
      `}</style>
    </>
  );
}
