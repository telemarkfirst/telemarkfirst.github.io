import React from 'react';
import Admonition from '@theme/Admonition';
import useBaseUrl from '@docusaurus/useBaseUrl';
import SimulatorFrame from './SimulatorFrame';

type LessonKey =
  | 'imu-initialization'
  | 'yaw-data'
  | 'field-centric'
  | 'pitch-roll'
  | 'imu-turn';

const LESSON_PATH: Record<LessonKey, string> = {
  'imu-initialization': '/simulator/unit12.1.html',
  'yaw-data': '/simulator/unit12.2.html',
  'field-centric': '/simulator/unit12.3.html',
  'pitch-roll': '/simulator/unit12.4.html',
  'imu-turn': '/simulator/unit12.5.html',
};

const LESSON_TITLE: Record<LessonKey, string> = {
  'imu-initialization': 'Telemark Unit 12.1 Simulator',
  'yaw-data': 'Telemark Unit 12.2 Simulator',
  'field-centric': 'Telemark Unit 12.3 Simulator',
  'pitch-roll': 'Telemark Unit 12.4 Simulator',
  'imu-turn': 'Telemark Unit 12.5 Simulator',
};

type Unit12SimulatorProps = {
  lesson: LessonKey;
};

export default function Unit12Simulator({lesson}: Unit12SimulatorProps): React.JSX.Element {
  const simulatorSrc = useBaseUrl(LESSON_PATH[lesson]);
  const simulatorTitle = LESSON_TITLE[lesson];

  return (
    <>
      <SimulatorFrame
        src={simulatorSrc}
        wrapperClassName="simulator-wrapper unit12-simulator-wrapper"
        iframeClassName="telemark-simulator unit12-telemark-simulator"
        title={simulatorTitle}
      />

      <Admonition type="info" title={simulatorTitle}>
        <div>Loads the lesson-specific Telemark IMU challenge with incomplete starter code for students to complete.</div>
        <div>Includes a large 3D viewport, heading feedback, telemetry checks, and validation for each IMU concept.</div>
      </Admonition>

      <style>{`
        .unit12-simulator-wrapper {
          position: relative;
          width: 100%;
          margin: 1.5rem 0;
        }
        .unit12-telemark-simulator {
          width: 100%;
          height: 900px;
          min-height: 700px;
          border: none;
          border-radius: 14px;
          background: var(--tm-bg);
        }
        @media (min-width: 997px) {
          .unit12-telemark-simulator {
            height: 920px;
            max-height: 88vh;
          }
        }
        @media (max-width: 640px) {
          .unit12-telemark-simulator {
            height: 720px;
            min-height: 620px;
          }
        }
      `}</style>
    </>
  );
}
