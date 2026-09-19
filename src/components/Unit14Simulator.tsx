import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'vision-portal'
  | 'apriltag-detection'
  | 'pose-data'
  | 'opencv-zones'
  | 'multi-zone';

const LESSON_PATH: Record<LessonKey, string> = {
  'vision-portal': '/simulator/unit14.1.html',
  'apriltag-detection': '/simulator/unit14.2.html',
  'pose-data': '/simulator/unit14.3.html',
  'opencv-zones': '/simulator/unit14.4.html',
  'multi-zone': '/simulator/unit14.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'vision-portal': 'Telemark Unit 14.1 Simulator',
  'apriltag-detection': 'Telemark Unit 14.2 Simulator',
  'pose-data': 'Telemark Unit 14.3 Simulator',
  'opencv-zones': 'Telemark Unit 14.4 Simulator',
  'multi-zone': 'Telemark Unit 14.5 Simulator',
};

type Unit14SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit14Simulator({lesson}: Unit14SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit14-simulator-wrapper"
        iframeClassName="telemark-simulator unit14-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark computer vision challenge with incomplete starter code for students to complete.</div>
        <div>The simulator editor contains the starter code; use the answer below only after trying the challenge.</div>
      </Admonition>

      <style>{`
        .unit14-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit14-telemark-simulator {
          width: 100%;
          height: 900px;
          min-height: 700px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit14-telemark-simulator {
            height: 920px;
            max-height: 88vh;
          }
        }
        @media (max-width: 640px) {
          .unit14-telemark-simulator {
            height: 720px;
            min-height: 620px;
          }
        }
      `}</style>
    </>
  );
}
